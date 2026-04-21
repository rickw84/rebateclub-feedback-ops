type OpportunitySourceRecord = {
  payout: Record<string, any> | null;
  assignment: Record<string, any> | null;
  participant: Record<string, any> | null;
  user: Record<string, any> | null;
  campaign: Record<string, any> | null;
  product: Record<string, any> | null;
  payoutBatch: Record<string, any> | null;
  submissions?: Array<Record<string, any>>;
};

type OpportunityFilters = {
  q?: string;
  status?: string;
  campaign?: string;
  sort?: string;
  dir?: string;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value ?? 0));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function firstDate(...values: Array<string | Date | null | undefined>) {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return null;
}

function asDateKey(value: string | Date | null | undefined) {
  if (!value) {
    return "undated";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString().slice(0, 10);
}

function deriveOpportunityStatus(statuses: string[], assignmentStatuses: string[]) {
  if (statuses.some((status) => status === "FAILED")) {
    return "FAILED";
  }
  if (statuses.some((status) => status === "CANCELED")) {
    return "CANCELED";
  }
  if (statuses.every((status) => status === "PAID")) {
    return "PAID";
  }
  if (statuses.some((status) => status === "SENT")) {
    return "SENT";
  }
  if (statuses.length === 0) {
    if (assignmentStatuses.some((status) => status === "CANCELED")) {
      return "CANCELED";
    }
    if (assignmentStatuses.some((status) => status === "FAILED")) {
      return "FAILED";
    }
    return "DRAFT";
  }
  return "DRAFT";
}

function sortValues(values: Set<string>) {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function buildPayoutOpportunityRows(
  sourceRecords: OpportunitySourceRecord[],
  filters: OpportunityFilters = {}
) {
  const groups = new Map<string, any>();

  for (const record of sourceRecords) {
    const requestDate = firstDate(
      record.assignment?.deliverableSnapshot?.legacyRequestDate,
      record.assignment?.assignedAt,
      record.payout?.scheduledAt,
      record.payout?.createdAt
    );
    const newsletterCampaign =
      record.assignment?.sourceLabel ??
      record.payoutBatch?.sourceLabel ??
      record.campaign?.name ??
      "Unassigned";
    const groupKey = [
      record.participant?.id ?? record.payout?.participantId ?? "unknown-participant",
      record.campaign?.id ?? record.assignment?.campaignId ?? "unknown-campaign",
      newsletterCampaign,
      asDateKey(requestDate)
    ].join("__");

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        id: `opp_${slugify(groupKey)}`,
        requestDate,
        participantId: record.participant?.id ?? record.payout?.participantId ?? null,
        participantName:
          record.participant?.displayName ??
          record.user?.name ??
          "Unknown participant",
        email: record.user?.email ?? record.payout?.recipientEmail ?? "N/A",
        paypalEmail:
          record.participant?.paypalEmail ??
          record.payout?.recipientEmail ??
          record.user?.email ??
          "N/A",
        campaign: record.campaign?.name ?? newsletterCampaign,
        newsletterCampaign,
        brandNames: new Set<string>(),
        productTitles: new Set<string>(),
        productLinks: new Set<string>(),
        reviewLinks: new Set<string>(),
        payoutIds: [] as string[],
        assignmentIds: [] as string[],
        payoutStatuses: [] as string[],
        assignmentStatuses: [] as string[],
        payoutRows: [] as Array<Record<string, any>>,
        assignmentRows: [] as Array<Record<string, any>>,
        basePaymentDates: [] as Array<string | Date>,
        commissionPaymentDates: [] as Array<string | Date>,
        totalProductCost: 0,
        totalCostWithFee: 0,
        ppFeeTotal: 0,
        commissionTotal: 0
      };
      groups.set(groupKey, group);
    }

    if (record.product?.brandName) {
      group.brandNames.add(String(record.product.brandName));
    }
    if (record.product?.title) {
      group.productTitles.add(String(record.product.title));
    }
    if (record.product?.amazonUrl) {
      group.productLinks.add(String(record.product.amazonUrl));
    }

    const submissionLinks =
      record.submissions
        ?.map((submission) => submission?.externalLinks?.legacyReviewUrl)
        .filter((value): value is string => typeof value === "string" && value.length > 0) ?? [];
    for (const reviewLink of submissionLinks) {
      group.reviewLinks.add(reviewLink);
    }

    if (record.assignment && !group.assignmentIds.includes(record.assignment.id)) {
      group.assignmentIds.push(record.assignment.id);
      group.assignmentStatuses.push(String(record.assignment.status ?? "DRAFT"));
      const purchaseSubtotal = Number(
        record.assignment.purchaseSubtotal ??
          record.assignment.baseRewardAmount ??
          0
      );
      group.totalProductCost += purchaseSubtotal;
      group.assignmentRows.push({
        id: record.assignment.id,
        brandName: record.product?.brandName ?? "Unknown brand",
        productTitle: record.product?.title ?? "Unknown product",
        productLink: record.product?.amazonUrl ?? null,
        purchaseSubtotal,
        purchaseSubtotalLabel: formatMoney(purchaseSubtotal),
        reviewLinks: submissionLinks
      });
    }

    if (record.payout && !group.payoutIds.includes(record.payout.id)) {
      const amount = Number(record.payout.amount ?? 0);
      const fee = Number(record.payout.feeAmount ?? 0);
      const payoutType = String(record.payout.payoutType ?? "");
      const paymentDate = firstDate(
        record.payoutBatch?.fullPaymentDate,
        record.payout?.settledAt,
        record.payout?.sentAt,
        record.payout?.scheduledAt
      );

      group.payoutIds.push(record.payout.id);
      group.payoutStatuses.push(String(record.payout.status ?? "DRAFT"));
      group.ppFeeTotal += fee;
      group.totalCostWithFee += amount + fee;
      if (payoutType.toLowerCase().includes("bonus")) {
        group.commissionTotal += amount;
        if (paymentDate) {
          group.commissionPaymentDates.push(paymentDate);
        }
      } else if (paymentDate) {
        group.basePaymentDates.push(paymentDate);
      }

      group.payoutRows.push({
        id: record.payout.id,
        payoutType,
        payoutTypeLabel: payoutType
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        amount,
        amountLabel: formatMoney(amount),
        feeAmount: fee,
        feeAmountLabel: formatMoney(fee),
        status: record.payout.status,
        paymentDate,
        paymentDateLabel: formatDate(paymentDate),
        assignmentId: record.assignment?.id ?? record.payout.assignmentId,
        productTitle: record.product?.title ?? "Unknown product"
      });
    }
  }

  const rows = Array.from(groups.values()).map((group) => {
    const fullPaymentDate = group.basePaymentDates
      .map((value: string | Date) => new Date(value))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime())
      .at(-1);
    const commissionPaymentDate = group.commissionPaymentDates
      .map((value: string | Date) => new Date(value))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime())
      .at(-1);
    const status = deriveOpportunityStatus(group.payoutStatuses, group.assignmentStatuses);

    return {
      id: group.id,
      requestDate: group.requestDate,
      requestDateLabel: formatDate(group.requestDate),
      participantName: group.participantName,
      email: group.email,
      paypalEmail: group.paypalEmail,
      campaign: group.campaign,
      newsletterCampaign: group.newsletterCampaign,
      brandSummary: sortValues(group.brandNames).join(", ") || "Unknown brand",
      productSummary: sortValues(group.productTitles).join(", ") || "Unknown product",
      productCount: group.assignmentIds.length,
      uniquePaymentIds: [...group.payoutIds],
      uniquePaymentIdSummary: group.payoutIds.join(", "),
      assignmentIds: [...group.assignmentIds],
      reviewLinks: sortValues(group.reviewLinks),
      reviewLinkLabel: group.reviewLinks.size
        ? `${group.reviewLinks.size} review link${group.reviewLinks.size > 1 ? "s" : ""}`
        : "No review links",
      totalProductCost: group.totalProductCost,
      totalProductCostLabel: formatMoney(group.totalProductCost),
      ppFeeTotal: group.ppFeeTotal,
      ppFeeTotalLabel: formatMoney(group.ppFeeTotal),
      totalCostWithFee: group.totalCostWithFee,
      totalCostWithFeeLabel: formatMoney(group.totalCostWithFee),
      commissionTotal: group.commissionTotal,
      commissionTotalLabel: formatMoney(group.commissionTotal),
      fullPaymentDate: fullPaymentDate?.toISOString() ?? null,
      fullPaymentDateLabel: formatDate(fullPaymentDate?.toISOString() ?? null),
      commissionPaymentDate: commissionPaymentDate?.toISOString() ?? null,
      commissionPaymentDateLabel: formatDate(commissionPaymentDate?.toISOString() ?? null),
      status,
      payoutRows: group.payoutRows,
      assignmentRows: group.assignmentRows
    };
  });

  const q = filters.q?.trim().toLowerCase();
  const status = filters.status?.trim().toUpperCase();
  const campaign = filters.campaign?.trim();

  const filteredRows = rows.filter((row) => {
    const matchesQuery =
      !q ||
      row.uniquePaymentIds.some((id: string) => id.toLowerCase().includes(q)) ||
      row.email.toLowerCase().includes(q) ||
      row.paypalEmail.toLowerCase().includes(q) ||
      row.participantName.toLowerCase().includes(q) ||
      row.newsletterCampaign.toLowerCase().includes(q) ||
      row.brandSummary.toLowerCase().includes(q) ||
      row.productSummary.toLowerCase().includes(q);

    const matchesStatus = !status || row.status === status;
    const matchesCampaign = !campaign || row.newsletterCampaign === campaign;

    return matchesQuery && matchesStatus && matchesCampaign;
  });

  const direction = filters.dir === "asc" ? 1 : -1;
  const sortKey = filters.sort ?? "requestDate";
  const sortedRows = [...filteredRows].sort((left, right) => {
    const comparable = (row: Record<string, any>) => {
      switch (sortKey) {
        case "name":
          return row.participantName.toLowerCase();
        case "email":
          return row.email.toLowerCase();
        case "paypal":
          return row.paypalEmail.toLowerCase();
        case "campaign":
          return row.newsletterCampaign.toLowerCase();
        case "brand":
          return row.brandSummary.toLowerCase();
        case "product":
          return row.productSummary.toLowerCase();
        case "totalProductCost":
          return row.totalProductCost;
        case "commission":
          return row.commissionTotal;
        case "status":
          return row.status.toLowerCase();
        case "uniquePaymentIds":
          return row.uniquePaymentIdSummary.toLowerCase();
        case "requestDate":
        default:
          return new Date(String(row.requestDate ?? 0)).getTime();
      }
    };

    const a = comparable(left);
    const b = comparable(right);
    if (a < b) return -1 * direction;
    if (a > b) return 1 * direction;
    return 0;
  });

  return {
    rows: sortedRows,
    campaigns: Array.from(new Set(rows.map((row) => row.newsletterCampaign))).sort((a, b) =>
      a.localeCompare(b)
    ),
    tabs: {
      all: rows.length,
      needsApproval: rows.filter((row) => row.status === "DRAFT").length,
      sent: rows.filter((row) => row.status === "SENT").length,
      paid: rows.filter((row) => row.status === "PAID").length,
      failed: rows.filter((row) => row.status === "FAILED").length,
      canceled: rows.filter((row) => row.status === "CANCELED").length
    }
  };
}

export function findPayoutOpportunityDetail(
  sourceRecords: OpportunitySourceRecord[],
  id: string
) {
  const grouped = buildPayoutOpportunityRows(sourceRecords);
  return grouped.rows.find((row) => row.id === id) ?? null;
}
