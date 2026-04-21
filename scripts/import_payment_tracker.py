import argparse
import csv
import hashlib
import json
import re
from collections import OrderedDict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import urlparse


HEADER_BILLED_TO = "Billed to the Client?"
HEADER_STATUS = "Status"
HEADER_REQUEST_DATE = "Request Date"
HEADER_NAME = "Name"
HEADER_EMAIL = "Email"
HEADER_PAYPAL = "Paypal"
HEADER_BRAND = "Brand"
HEADER_PRODUCT = "Product"
HEADER_PRODUCT_COST = "Product Cost"
HEADER_PRODUCT_LINK = "Product Link"
HEADER_PP_FEE = "PP Fee"
HEADER_TOTAL_PRODUCT_COST = "Total Product Cost"
HEADER_TOTAL_WITH_FEE = "Total Product Cost + PP Fee"
HEADER_NEWSLETTER = "Newsletter Campaign"
HEADER_FULL_PAYMENT_DATE = "Full Payment Date"
HEADER_COMMISSION = "Commission"
HEADER_TOTAL_COMMISSION = "Total Commission"
HEADER_COMMISSION_PAYMENT_DATE = "Commission Payment Made"
HEADER_REVIEW_LINK = "Review Product Link"
HEADER_COMMENTS = "Comments"

NEW_PARENT_HEADERS = [
    HEADER_STATUS,
    HEADER_REQUEST_DATE,
    HEADER_NAME,
    HEADER_EMAIL,
    HEADER_PAYPAL,
    HEADER_NEWSLETTER,
    HEADER_FULL_PAYMENT_DATE,
    HEADER_COMMISSION_PAYMENT_DATE,
]

DECIMAL_ZERO = Decimal("0.00")


def normalize_cell(value):
    return re.sub(r"\s+", " ", (value or "").replace("\ufeff", "")).strip()


def slugify(value):
    text = normalize_cell(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "unlabeled"


def stable_id(prefix, *parts):
    joined = "||".join(normalize_cell(str(part)) for part in parts)
    digest = hashlib.sha1(joined.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"


def parse_decimal(value):
    raw = normalize_cell(value)
    if not raw:
        return None
    raw = raw.replace(",", "")
    raw = raw.replace("$", "")
    raw = raw.replace("USD", "")
    raw = raw.strip()
    if not raw:
        return None
    try:
        return Decimal(raw).quantize(Decimal("0.01"))
    except Exception:
        match = re.search(r"-?\d+(?:\.\d+)?", raw)
        if not match:
            return None
        return Decimal(match.group(0)).quantize(Decimal("0.01"))


def parse_date(value):
    raw = normalize_cell(value)
    if not raw:
        return None
    raw = raw.replace("Sept ", "September ")
    patterns = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ]
    for pattern in patterns:
        try:
            return datetime.strptime(raw, pattern).date().isoformat()
        except ValueError:
            continue
    return None


def extract_asin(url, fallback_seed):
    raw = normalize_cell(url)
    if raw and not raw.startswith("http"):
        raw = f"https://{raw.lstrip('/')}"
    if raw:
        match = re.search(r"/dp/([A-Z0-9]{10})", raw, flags=re.IGNORECASE)
        if not match:
            match = re.search(r"/gp/product/([A-Z0-9]{10})", raw, flags=re.IGNORECASE)
        if match:
            return match.group(1).upper()
    digest = hashlib.sha1(fallback_seed.encode("utf-8")).hexdigest()[:10].upper()
    return f"LEGACY{digest[:4]}{digest[4:10]}"


def decimal_to_str(value):
    if value is None:
        return None
    return format(value.quantize(Decimal("0.01")), "f")


def json_default(value):
    if isinstance(value, Decimal):
        return decimal_to_str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def split_decimal(total, count):
    if count <= 0:
        return []
    total = (total or DECIMAL_ZERO).quantize(Decimal("0.01"))
    base = (total / count).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    shares = [base for _ in range(count)]
    delta = total - sum(shares, DECIMAL_ZERO)
    index = 0
    step = Decimal("0.01") if delta > 0 else Decimal("-0.01")
    while delta != DECIMAL_ZERO:
        shares[index] += step
        delta -= step
        index = (index + 1) % count
    return shares


def is_blank_row(row):
    return all(not normalize_cell(value) for value in row.values())


def is_parent_row(row):
    return any(normalize_cell(row.get(header, "")) for header in NEW_PARENT_HEADERS)


def map_assignment_status(status):
    raw = normalize_cell(status).lower()
    if raw == "complete":
        return "APPROVED"
    if raw == "payment made":
        return "IN_PROGRESS"
    if raw == "reach out":
        return "OVERDUE"
    if raw in {"blacklist/remove", "cancelled", "canceled"}:
        return "CANCELED"
    return "ASSIGNED"


def map_application_status(status):
    raw = normalize_cell(status).lower()
    if raw in {"blacklist/remove", "cancelled", "canceled"}:
        return "REJECTED"
    return "APPROVED"


def map_submission_decision(status, review_link):
    if not normalize_cell(review_link):
        return None
    assignment_status = map_assignment_status(status)
    if assignment_status == "APPROVED":
        return "APPROVED"
    if assignment_status == "CANCELED":
        return "REJECTED"
    return "PENDING"


def participant_verification_status(email, paypal):
    if normalize_cell(email) and normalize_cell(paypal):
        return "VERIFIED"
    return "PENDING_REVIEW"


def participant_risk_level(status):
    raw = normalize_cell(status).lower()
    if raw == "blacklist/remove":
        return "HIGH"
    if raw in {"reach out", "cancelled", "canceled"}:
        return "MEDIUM"
    return "LOW"


def read_rows(csv_path):
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for row in reader:
            normalized = {normalize_cell(k): (v or "") for k, v in row.items()}
            rows.append(normalized)
        return rows


def group_rows(rows, warnings):
    groups = []
    current = None
    for index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        if is_parent_row(row):
            if current:
                groups.append(current)
            current = {"rows": [row], "sourceLine": index}
            continue
        if current is None:
            warnings.append(f"Orphan continuation row at CSV line {index}; skipped.")
            continue
        current["rows"].append(row)
    if current:
        groups.append(current)
    return groups


def ordered_store():
    return OrderedDict()


def ensure_campaign(campaigns, organization_id, label):
    name = normalize_cell(label) or "Unlabeled Legacy Campaign"
    key = slugify(name)
    if key not in campaigns:
        campaign_id = stable_id("cmp", organization_id, name)
        campaigns[key] = {
            "id": campaign_id,
            "organizationId": organization_id,
            "createdById": None,
            "name": name,
            "clientName": None,
            "description": "Imported from legacy payment tracker.",
            "status": "COMPLETED",
            "participantLimit": None,
            "rewardAmount": None,
            "rewardCurrency": "USD",
            "deliverables": {
                "source": "legacy-payment-tracker",
                "note": "Historical import from tracker; deliverables should be reviewed before production use.",
            },
            "eligibilityRules": None,
            "startDate": None,
            "endDate": None,
        }
    return campaigns[key]


def import_tracker(rows, organization_name, organization_slug):
    warnings = []
    groups = group_rows(rows, warnings)

    organization_id = stable_id("org", organization_slug)
    organizations = [
        {
            "id": organization_id,
            "name": organization_name,
            "slug": organization_slug,
        }
    ]

    users = ordered_store()
    participant_profiles = ordered_store()
    campaigns = ordered_store()
    products = ordered_store()
    campaign_products = ordered_store()
    applications = ordered_store()
    assignments = ordered_store()
    submissions = ordered_store()
    payout_batches = ordered_store()
    payouts = ordered_store()

    for group in groups:
        first = group["rows"][0]
        request_date = parse_date(first.get(HEADER_REQUEST_DATE))
        full_payment_date = parse_date(first.get(HEADER_FULL_PAYMENT_DATE))
        commission_payment_date = parse_date(first.get(HEADER_COMMISSION_PAYMENT_DATE))
        status = normalize_cell(first.get(HEADER_STATUS))
        email = normalize_cell(first.get(HEADER_EMAIL)).lower()
        paypal = normalize_cell(first.get(HEADER_PAYPAL)).lower()
        name = normalize_cell(first.get(HEADER_NAME)) or "Unknown Participant"
        participant_key = email or paypal or stable_id("anon", name, group["sourceLine"])
        user_id = stable_id("usr", participant_key)
        participant_id = stable_id("prt", participant_key)

        if user_id not in users:
            users[user_id] = {
                "id": user_id,
                "organizationId": organization_id,
                "role": "PARTICIPANT",
                "name": name,
                "email": email or f"{participant_key}@import.local",
                "passwordHash": None,
                "isActive": normalize_cell(status).lower() != "blacklist/remove",
            }

        if participant_id not in participant_profiles:
            participant_profiles[participant_id] = {
                "id": participant_id,
                "userId": user_id,
                "displayName": name,
                "paypalEmail": paypal or None,
                "country": "US",
                "marketplace": "amazon.com",
                "niches": [],
                "bio": None,
                "avatarUrl": None,
                "amazonProfileUrl": None,
                "verificationScreenshotUrl": None,
                "verificationStatus": participant_verification_status(email, paypal),
                "riskLevel": participant_risk_level(status),
                "score": 70,
                "totalAssignments": 0,
                "completedAssignments": 0,
                "approvedAssignments": 0,
                "onTimeAssignments": 0,
                "noShowCount": 0,
                "disputeCount": 0,
                "notes": None,
                "lastVerifiedAt": request_date,
            }

        campaign = ensure_campaign(campaigns, organization_id, first.get(HEADER_NEWSLETTER))
        client_billing_label = normalize_cell(first.get(HEADER_BILLED_TO)) or None

        line_items = []
        for row in group["rows"]:
            brand = normalize_cell(row.get(HEADER_BRAND))
            product_name = normalize_cell(row.get(HEADER_PRODUCT))
            product_link = normalize_cell(row.get(HEADER_PRODUCT_LINK))
            review_link = normalize_cell(row.get(HEADER_REVIEW_LINK))
            if not any([brand, product_name, product_link, review_link]):
                continue
            line_items.append(
                {
                    "billedTo": normalize_cell(row.get(HEADER_BILLED_TO)) or None,
                    "brand": brand or None,
                    "productName": product_name or "Unknown Product",
                    "productCost": parse_decimal(row.get(HEADER_PRODUCT_COST)),
                    "productLink": product_link or None,
                    "reviewLink": review_link or None,
                    "comments": normalize_cell(row.get(HEADER_COMMENTS)) or None,
                }
            )

        if not line_items:
            warnings.append(
                f"No line items found for participant '{name}' at CSV line {group['sourceLine']}."
            )
            continue

        subtotal_from_rows = sum(
            (item["productCost"] or DECIMAL_ZERO for item in line_items),
            DECIMAL_ZERO,
        ).quantize(Decimal("0.01"))
        subtotal_from_sheet = parse_decimal(first.get(HEADER_TOTAL_PRODUCT_COST))
        subtotal_delta = None
        if subtotal_from_sheet:
            subtotal_delta = (subtotal_from_sheet - subtotal_from_rows).quantize(Decimal("0.01"))

        assignment_ids = []
        assignment_review_targets = []

        for index, item in enumerate(line_items, start=1):
            product_seed = " ".join(
                [
                    item["brand"] or "",
                    item["productName"],
                    item["productLink"] or "",
                ]
            )
            product_id = stable_id("prd", organization_id, product_seed)
            asin = extract_asin(item["productLink"], product_seed)

            if product_id not in products:
                parsed_url = None
                raw_link = item["productLink"]
                if raw_link and raw_link.startswith("http"):
                    parsed_url = raw_link
                elif raw_link:
                    parsed_url = f"https://{raw_link.lstrip('/')}"
                products[product_id] = {
                    "id": product_id,
                    "organizationId": organization_id,
                    "brandName": item["brand"],
                    "asin": asin,
                    "title": item["productName"],
                    "amazonUrl": parsed_url,
                    "marketplace": "amazon.com",
                    "imageUrl": None,
                    "category": None,
                    "isActive": True,
                }

            campaign_product_id = stable_id("cprd", campaign["id"], product_id)
            if campaign_product_id not in campaign_products:
                campaign_products[campaign_product_id] = {
                    "id": campaign_product_id,
                    "campaignId": campaign["id"],
                    "productId": product_id,
                    "basketCode": None,
                    "quantityTarget": None,
                    "assignmentLimit": None,
                }

            application_id = stable_id(
                "app",
                participant_id,
                campaign["id"],
                product_id,
                request_date or group["sourceLine"],
            )
            applications[application_id] = {
                "id": application_id,
                "campaignId": campaign["id"],
                "productId": product_id,
                "participantId": participant_id,
                "status": map_application_status(status),
                "selectionNotes": "Imported from legacy payment tracker.",
                "adminNotes": item["comments"],
                "appliedAt": request_date,
                "decisionAt": full_payment_date or request_date,
                "decidedById": None,
            }

            assignment_id = stable_id(
                "asn",
                participant_id,
                campaign["id"],
                product_id,
                request_date or group["sourceLine"],
            )
            assignments[assignment_id] = {
                "id": assignment_id,
                "campaignId": campaign["id"],
                "productId": product_id,
                "participantId": participant_id,
                "applicationId": application_id,
                "assignedById": None,
                "status": map_assignment_status(status),
                "baseRewardAmount": decimal_to_str(item["productCost"]),
                "bonusRewardAmount": None,
                "rewardCurrency": "USD",
                "assignedAt": full_payment_date or request_date,
                "acceptedAt": None,
                "dueAt": None,
                "submittedAt": commission_payment_date if item["reviewLink"] else None,
                "approvedAt": commission_payment_date if map_assignment_status(status) == "APPROVED" else None,
                "lastFollowUpAt": None,
                "followUpCount": 0,
                "sourceLabel": normalize_cell(first.get(HEADER_NEWSLETTER)) or None,
                "clientBillingLabel": item["billedTo"] or client_billing_label,
                "purchaseSubtotal": decimal_to_str(item["productCost"]),
                "taxAdjustmentAmount": None,
                "miscAdjustmentAmount": None,
                "internalNotes": item["comments"],
                "deliverableSnapshot": {
                    "source": "legacy-payment-tracker",
                    "legacyStatus": status,
                    "legacyReviewUrl": item["reviewLink"],
                    "legacyRequestDate": request_date,
                },
            }
            assignment_ids.append(assignment_id)

            decision = map_submission_decision(status, item["reviewLink"])
            if decision:
                submission_id = stable_id("sub", assignment_id, item["reviewLink"])
                submissions[submission_id] = {
                    "id": submission_id,
                    "assignmentId": assignment_id,
                    "submittedById": participant_id,
                    "version": 1,
                    "questionnaireData": None,
                    "attachmentUrls": None,
                    "externalLinks": {"legacyReviewUrl": item["reviewLink"]},
                    "adminNotes": item["comments"],
                    "decision": decision,
                    "reviewedAt": commission_payment_date if decision == "APPROVED" else None,
                    "reviewedById": None,
                    "submittedAt": commission_payment_date or full_payment_date or request_date,
                }
                assignment_review_targets.append(assignment_id)

        profile = participant_profiles[participant_id]
        profile["totalAssignments"] += len(assignment_ids)
        approved_count = sum(
            1
            for assignment_id in assignment_ids
            if assignments[assignment_id]["status"] == "APPROVED"
        )
        profile["completedAssignments"] += approved_count
        profile["approvedAssignments"] += approved_count
        if map_assignment_status(status) == "CANCELED":
            profile["noShowCount"] += len(assignment_ids)

        if subtotal_delta and subtotal_delta != DECIMAL_ZERO and assignment_ids:
            adjustment_shares = split_decimal(subtotal_delta, len(assignment_ids))
            for assignment_id, adjustment_share in zip(assignment_ids, adjustment_shares):
                assignments[assignment_id]["taxAdjustmentAmount"] = decimal_to_str(adjustment_share)
        elif subtotal_delta and subtotal_delta != DECIMAL_ZERO:
            warnings.append(
                f"Subtotal mismatch for '{name}' on {request_date or 'unknown date'}: "
                f"rows={decimal_to_str(subtotal_from_rows)} sheet={decimal_to_str(subtotal_from_sheet)}."
            )

        total_with_fee = parse_decimal(first.get(HEADER_TOTAL_WITH_FEE))
        total_fee = parse_decimal(first.get(HEADER_PP_FEE))
        if total_with_fee or full_payment_date:
            payout_batch_id = stable_id(
                "pbt",
                participant_id,
                "base",
                full_payment_date or request_date,
                normalize_cell(first.get(HEADER_NEWSLETTER)),
                decimal_to_str(total_with_fee or subtotal_from_rows),
            )
            payout_batches[payout_batch_id] = {
                "id": payout_batch_id,
                "campaignId": campaign["id"],
                "participantId": participant_id,
                "createdById": None,
                "batchType": "BASE_REIMBURSEMENT",
                "provider": "PAYPAL",
                "providerBatchId": None,
                "recipientEmail": paypal or None,
                "sourceLabel": normalize_cell(first.get(HEADER_NEWSLETTER)) or None,
                "fullPaymentDate": full_payment_date,
                "totalAmount": decimal_to_str(total_with_fee or subtotal_from_rows),
                "totalFeeAmount": decimal_to_str(total_fee),
                "proofImageUrl": None,
                "notes": normalize_cell(first.get(HEADER_COMMENTS)) or None,
            }
            fee_shares = split_decimal(total_fee or DECIMAL_ZERO, len(assignment_ids))
            for assignment_id, fee_share in zip(assignment_ids, fee_shares):
                payout_amount = (
                    (parse_decimal(assignments[assignment_id]["purchaseSubtotal"]) or DECIMAL_ZERO)
                    + (parse_decimal(assignments[assignment_id]["taxAdjustmentAmount"]) or DECIMAL_ZERO)
                    + (parse_decimal(assignments[assignment_id]["miscAdjustmentAmount"]) or DECIMAL_ZERO)
                ).quantize(Decimal("0.01"))
                payout_id = stable_id("pay", payout_batch_id, assignment_id, "base")
                payouts[payout_id] = {
                    "id": payout_id,
                    "payoutBatchId": payout_batch_id,
                    "assignmentId": assignment_id,
                    "participantId": participant_id,
                    "createdById": None,
                    "status": "PAID" if full_payment_date else "SENT",
                    "payoutType": "base_reimbursement",
                    "amount": decimal_to_str(payout_amount),
                    "feeAmount": decimal_to_str(fee_share),
                    "currency": "USD",
                    "recipientEmail": paypal or None,
                    "provider": "PAYPAL",
                    "providerBatchId": None,
                    "providerItemId": None,
                    "providerReference": None,
                    "proofImageUrl": None,
                    "failureReason": None,
                    "scheduledAt": full_payment_date,
                    "sentAt": full_payment_date,
                    "settledAt": full_payment_date,
                }

        total_commission = parse_decimal(first.get(HEADER_TOTAL_COMMISSION))
        if (total_commission and total_commission > DECIMAL_ZERO) or commission_payment_date:
            review_targets = assignment_review_targets or assignment_ids
            payout_batch_id = stable_id(
                "pbt",
                participant_id,
                "bonus",
                commission_payment_date or request_date,
                normalize_cell(first.get(HEADER_NEWSLETTER)),
                decimal_to_str(total_commission or DECIMAL_ZERO),
            )
            payout_batches[payout_batch_id] = {
                "id": payout_batch_id,
                "campaignId": campaign["id"],
                "participantId": participant_id,
                "createdById": None,
                "batchType": "BONUS",
                "provider": "PAYPAL",
                "providerBatchId": None,
                "recipientEmail": paypal or None,
                "sourceLabel": normalize_cell(first.get(HEADER_NEWSLETTER)) or None,
                "fullPaymentDate": commission_payment_date,
                "totalAmount": decimal_to_str(total_commission or DECIMAL_ZERO),
                "totalFeeAmount": None,
                "proofImageUrl": None,
                "notes": normalize_cell(first.get(HEADER_COMMENTS)) or None,
            }
            bonus_shares = split_decimal(total_commission or DECIMAL_ZERO, len(review_targets))
            for assignment_id, bonus_share in zip(review_targets, bonus_shares):
                payout_id = stable_id("pay", payout_batch_id, assignment_id, "bonus")
                payouts[payout_id] = {
                    "id": payout_id,
                    "payoutBatchId": payout_batch_id,
                    "assignmentId": assignment_id,
                    "participantId": participant_id,
                    "createdById": None,
                    "status": "PAID" if commission_payment_date else "DRAFT",
                    "payoutType": "bonus",
                    "amount": decimal_to_str(bonus_share),
                    "feeAmount": None,
                    "currency": "USD",
                    "recipientEmail": paypal or None,
                    "provider": "PAYPAL",
                    "providerBatchId": None,
                    "providerItemId": None,
                    "providerReference": None,
                    "proofImageUrl": None,
                    "failureReason": None,
                    "scheduledAt": commission_payment_date,
                    "sentAt": commission_payment_date,
                    "settledAt": commission_payment_date,
                }
                bonus_value = parse_decimal(assignments[assignment_id]["bonusRewardAmount"] or "0")
                assignments[assignment_id]["bonusRewardAmount"] = decimal_to_str(
                    (bonus_value or DECIMAL_ZERO) + bonus_share
                )

    summary = {
        "groupCount": len(groups),
        "organizationCount": len(organizations),
        "userCount": len(users),
        "participantProfileCount": len(participant_profiles),
        "campaignCount": len(campaigns),
        "productCount": len(products),
        "campaignProductCount": len(campaign_products),
        "applicationCount": len(applications),
        "assignmentCount": len(assignments),
        "submissionCount": len(submissions),
        "payoutBatchCount": len(payout_batches),
        "payoutCount": len(payouts),
        "warningCount": len(warnings),
    }

    return {
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "source": "legacy-payment-tracker",
            "summary": summary,
        },
        "organizations": organizations,
        "users": list(users.values()),
        "participantProfiles": list(participant_profiles.values()),
        "campaigns": list(campaigns.values()),
        "products": list(products.values()),
        "campaignProducts": list(campaign_products.values()),
        "applications": list(applications.values()),
        "assignments": list(assignments.values()),
        "submissions": list(submissions.values()),
        "payoutBatches": list(payout_batches.values()),
        "payouts": list(payouts.values()),
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser(description="Import the legacy payment tracker CSV into normalized JSON.")
    parser.add_argument("--input", required=True, help="Path to the CSV export from Google Sheets.")
    parser.add_argument("--output", required=True, help="Path to write the normalized JSON bundle.")
    parser.add_argument("--org-name", default="RebateClub", help="Organization name for imported records.")
    parser.add_argument("--org-slug", default="rebateclub", help="Organization slug for imported records.")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    rows = read_rows(input_path)
    payload = import_tracker(rows, args.org_name, slugify(args.org_slug))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, default=json_default), encoding="utf-8")

    print(json.dumps(payload["metadata"]["summary"], indent=2))
    if payload["warnings"]:
        print(f"Warnings: {len(payload['warnings'])}")


if __name__ == "__main__":
    main()
