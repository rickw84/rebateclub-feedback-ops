"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { updateAssignmentOpportunitySummaryAction } from "@/app/admin/actions";
import {
  AssignmentSetLineItem,
  AssignmentSetPayments,
  normalizeMoneyInput
} from "@/lib/assignment-set";

type AssignmentOpportunitySummaryFormProps = {
  detail: any;
};

type UpdateSummaryState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectTo?: string;
};

type AssignmentDetails = {
  opportunityStatus: string;
  requestDate: string;
  participantName: string;
  participantEmail: string;
  paypalEmail: string;
  newsletterCampaign: string;
  fullPaymentDate: string;
  commissionPaymentDate: string;
  miscNotes: string;
};

const initialState: UpdateSummaryState = {
  status: "idle"
};

function asInputDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function asMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function defaultDetails(detail: any): AssignmentDetails {
  return {
    opportunityStatus: detail.status ?? "DRAFT",
    requestDate: asInputDate(detail.requestDate),
    participantName: detail.participantName ?? "",
    participantEmail: detail.email ?? "",
    paypalEmail: detail.paypalEmail ?? "",
    newsletterCampaign: detail.newsletterCampaign ?? "",
    fullPaymentDate: asInputDate(detail.fullPaymentDate),
    commissionPaymentDate: asInputDate(detail.commissionPaymentDate),
    miscNotes: detail.miscNotes ?? ""
  };
}

function defaultPayments(detail: any): AssignmentSetPayments {
  const commission = (detail.payoutRows ?? [])
    .filter((row: any) => row.payoutType === "bonus_commission")
    .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0)
    .toFixed(2);
  const commissionMisc = (detail.payoutRows ?? [])
    .filter((row: any) => row.payoutType === "commission_misc")
    .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0)
    .toFixed(2);
  const totalProductCost = asMoney(detail.totalProductCost);
  const totalCostWithFee = asMoney(detail.totalCostWithFee);
  const ppFee = (Number(totalCostWithFee) - Number(totalProductCost)).toFixed(2);

  return {
    totalProductCost,
    ppFee,
    totalCostWithFee,
    commission,
    commissionMisc,
    totalCommission: (Number(commission) + Number(commissionMisc)).toFixed(2)
  };
}

function defaultLineItems(detail: any): AssignmentSetLineItem[] {
  if (!detail.assignmentRows?.length) {
    return [
      {
        brand: "",
        productTitle: "",
        productCost: "",
        productLink: "",
        reviewProductLink: ""
      }
    ];
  }

  return detail.assignmentRows.map((row: any) => ({
    brand: row.brandName === "Unknown brand" ? "" : row.brandName ?? "",
    productTitle: row.productTitle === "Unknown product" ? "" : row.productTitle ?? "",
    productCost: asMoney(row.purchaseSubtotal),
    productLink: row.productLink ?? "",
    reviewProductLink: row.reviewLinks?.[0] ?? ""
  }));
}

function emptyLineItem(): AssignmentSetLineItem {
  return {
    brand: "",
    productTitle: "",
    productCost: "",
    productLink: "",
    reviewProductLink: ""
  };
}

export function AssignmentOpportunitySummaryForm({ detail }: AssignmentOpportunitySummaryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [details, setDetails] = useState<AssignmentDetails>(() => defaultDetails(detail));
  const [payments, setPayments] = useState<AssignmentSetPayments>(() => defaultPayments(detail));
  const [lineItems, setLineItems] = useState<AssignmentSetLineItem[]>(() => defaultLineItems(detail));
  const [state, formAction, pending] = useActionState(
    updateAssignmentOpportunitySummaryAction,
    initialState
  );

  const derivedPayments = useMemo(() => {
    const totalProductCost = lineItems
      .reduce((sum, item) => sum + Number(normalizeMoneyInput(item.productCost)), 0)
      .toFixed(2);
    const ppFee = normalizeMoneyInput(payments.ppFee);
    const commission = normalizeMoneyInput(payments.commission);
    const commissionMisc = normalizeMoneyInput(payments.commissionMisc);

    return {
      totalProductCost,
      ppFee,
      totalCostWithFee: (Number(totalProductCost) + Number(ppFee)).toFixed(2),
      commission,
      commissionMisc,
      totalCommission: (Number(commission) + Number(commissionMisc)).toFixed(2)
    };
  }, [lineItems, payments]);

  useEffect(() => {
    if (state.status === "success") {
      setIsRedirecting(true);
      router.replace(state.redirectTo ?? pathname, { scroll: false });
      router.refresh();
    }
  }, [pathname, router, state.redirectTo, state.status]);

  const isBusy = pending || isRedirecting;

  const updateDetail = (key: keyof AssignmentDetails, value: string) => {
    setDetails((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updatePayment = (key: keyof AssignmentSetPayments, value: string) => {
    setPayments((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateLineItem = (index: number, key: keyof AssignmentSetLineItem, value: string) => {
    setLineItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value
            }
          : item
      )
    );
  };

  const addLineItem = () => {
    setLineItems((current) => [...current, emptyLineItem()]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((current) =>
      current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  return (
    <ActionForm action={formAction} className="rk-modal-form rk-detail-edit-form">
      {isRedirecting ? (
        <div className="page-loading-shell">
          <div className="page-loading-card">
            <span className="global-spinner" aria-hidden="true" />
            <div className="page-loading-copy">
              <strong>Saving assignment set</strong>
              <span>Returning to the Assignment Queue...</span>
            </div>
          </div>
        </div>
      ) : null}
      <input name="participantId" type="hidden" value={detail.participantId ?? ""} />
      <input name="campaignId" type="hidden" value={detail.campaignId ?? ""} />
      <input name="assignmentIds" type="hidden" value={JSON.stringify(detail.assignmentRows.map((row: any) => row.id))} />
      <input name="payoutIds" type="hidden" value={JSON.stringify(detail.payoutRows.map((row: any) => row.id))} />
      <input name="lineItems" type="hidden" value={JSON.stringify(lineItems)} />
      <input name="payments" type="hidden" value={JSON.stringify(derivedPayments)} />

      <div className="rk-modal-top-row">
        <div className="rk-modal-section rk-modal-section--top">
          <div className="rk-modal-section-title">Assignment details</div>
          <div className="rk-modal-grid rk-modal-grid--assignment">
            <label className="field">
              Status
              <select
                name="opportunityStatus"
                onChange={(event) => updateDetail("opportunityStatus", event.target.value)}
                value={details.opportunityStatus}
              >
                <option value="DRAFT">Not Paid</option>
                <option value="FAILED">Assignment Not Completed (Block/Blacklist)</option>
                <option value="SENT">Product Payment Made</option>
                <option value="PAID">Assignment Completed (Review+Commission)</option>
              </select>
            </label>
            <label className="field">
              Request Date
              <input
                name="requestDate"
                onChange={(event) => updateDetail("requestDate", event.target.value)}
                type="date"
                value={details.requestDate}
              />
            </label>
            <label className="field">
              Name
              <input
                name="participantName"
                onChange={(event) => updateDetail("participantName", event.target.value)}
                required
                value={details.participantName}
              />
            </label>
            <label className="field">
              Email
              <input
                name="participantEmail"
                onChange={(event) => updateDetail("participantEmail", event.target.value)}
                required
                type="email"
                value={details.participantEmail}
              />
            </label>
            <label className="field">
              Paypal
              <input
                name="paypalEmail"
                onChange={(event) => updateDetail("paypalEmail", event.target.value)}
                value={details.paypalEmail}
              />
            </label>
            <label className="field">
              Newsletter Campaign
              <input
                name="newsletterCampaign"
                onChange={(event) => updateDetail("newsletterCampaign", event.target.value)}
                required
                value={details.newsletterCampaign}
              />
            </label>
            <label className="field rk-modal-grid-span">
              Misc Notes
              <textarea
                name="miscNotes"
                onChange={(event) => updateDetail("miscNotes", event.target.value)}
                placeholder="Add any assignment notes, exceptions, or follow-up context."
                value={details.miscNotes}
              />
            </label>
          </div>
        </div>

        <div className="rk-modal-section rk-modal-section--top">
          <div className="rk-modal-section-title">Payments</div>
          <div className="rk-modal-grid rk-modal-grid--payments">
            <div className="rk-payment-group">
              <div className="rk-payment-group__title">Product Payments</div>
              <div className="rk-payment-group__fields">
                <label className="field">
                  Full Payment Date
                  <input
                    name="fullPaymentDate"
                    onChange={(event) => updateDetail("fullPaymentDate", event.target.value)}
                    type="date"
                    value={details.fullPaymentDate}
                  />
                </label>
                <label className="field">
                  Total Product Cost
                  <input readOnly value={derivedPayments.totalProductCost} />
                </label>
                <label className="field">
                  PP Fee
                  <input
                    onChange={(event) => updatePayment("ppFee", event.target.value)}
                    value={payments.ppFee}
                  />
                </label>
                <label className="field">
                  Total Product Cost + PP Fee
                  <input readOnly value={derivedPayments.totalCostWithFee} />
                </label>
              </div>
            </div>
            <div className="rk-payment-group">
              <div className="rk-payment-group__title">Commission Payments</div>
              <div className="rk-payment-group__fields">
                <label className="field">
                  Commission Payment Made
                  <input
                    name="commissionPaymentDate"
                    onChange={(event) => updateDetail("commissionPaymentDate", event.target.value)}
                    type="date"
                    value={details.commissionPaymentDate}
                  />
                </label>
                <label className="field">
                  Commission
                  <input
                    onChange={(event) => updatePayment("commission", event.target.value)}
                    value={payments.commission}
                  />
                </label>
                <label className="field">
                  Commission Misc
                  <input
                    onChange={(event) => updatePayment("commissionMisc", event.target.value)}
                    value={payments.commissionMisc}
                  />
                </label>
                <label className="field">
                  Total Commission
                  <input readOnly value={derivedPayments.totalCommission} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rk-modal-section">
        <div className="rk-modal-section-title">Products</div>
        <div className="rk-product-actions">
          <button className="button-link" disabled={isBusy} onClick={addLineItem} type="button">
            + Add product
          </button>
        </div>

        <div className="rk-product-stack">
          {lineItems.map((item, index) => (
            <div className="rk-product-card" key={`detail-product-row-${index}`}>
              <div className="rk-product-card__header">
                <strong>Product {index + 1}</strong>
                <button
                  className="button-link"
                  disabled={lineItems.length === 1 || isBusy}
                  onClick={() => removeLineItem(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              <div className="rk-modal-grid rk-modal-grid--product">
                <label className="field">
                  Brand
                  <input
                    onChange={(event) => updateLineItem(index, "brand", event.target.value)}
                    value={item.brand}
                  />
                </label>
                <label className="field">
                  Product
                  <input
                    onChange={(event) => updateLineItem(index, "productTitle", event.target.value)}
                    value={item.productTitle}
                  />
                </label>
                <label className="field">
                  Product Cost
                  <input
                    onChange={(event) => updateLineItem(index, "productCost", event.target.value)}
                    value={item.productCost}
                  />
                </label>
                <label className="field rk-product-grid-span">
                  Product Link
                  <input
                    onChange={(event) => updateLineItem(index, "productLink", event.target.value)}
                    value={item.productLink}
                  />
                </label>
                <label className="field rk-product-grid-span">
                  Review Product Link
                  <input
                    onChange={(event) => updateLineItem(index, "reviewProductLink", event.target.value)}
                    value={item.reviewProductLink}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {state.status === "error" ? <div className="rk-form-error">{state.message}</div> : null}

      <div className="rk-detail-actions">
        <SubmitButton
          className="hero-link primary"
          pendingLabel={isRedirecting ? "Returning to queue..." : "Saving changes..."}
        >
          Save assignment set
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
