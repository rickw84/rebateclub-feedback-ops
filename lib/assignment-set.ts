export type OpportunityStatus = "DRAFT" | "SENT" | "PAID" | "FAILED" | "CANCELED";

export type AssignmentSetLineItem = {
  brand: string;
  productTitle: string;
  productCost: string;
  productLink: string;
  ppFee: string;
  totalProductCost: string;
  totalCostWithFee: string;
  commission: string;
  reviewProductLink: string;
};

export type AssignmentSetActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAssignmentSetActionState: AssignmentSetActionState = {
  status: "idle"
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function parseAmazonAsin(url: string | undefined) {
  if (!url) {
    return null;
  }

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

export function inferMarketplaceFromUrl(url: string | undefined) {
  if (!url) {
    return "amazon.com";
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("amazon.co.uk")) return "amazon.co.uk";
    if (hostname.includes("amazon.ca")) return "amazon.ca";
    if (hostname.includes("amazon.com.mx")) return "amazon.com.mx";
    if (hostname.includes("amazon.de")) return "amazon.de";
    return "amazon.com";
  } catch {
    return "amazon.com";
  }
}

export function normalizeMoneyInput(value: string | undefined, fallback = "0.00") {
  const raw = (value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed.toFixed(2);
}

export function normalizeLineItem(raw: Partial<AssignmentSetLineItem>) {
  const productCost = normalizeMoneyInput(raw.productCost);
  const ppFee = normalizeMoneyInput(raw.ppFee);
  const totalProductCost = normalizeMoneyInput(raw.totalProductCost, productCost);
  const totalCostWithFee = normalizeMoneyInput(
    raw.totalCostWithFee,
    (Number(totalProductCost) + Number(ppFee)).toFixed(2)
  );
  const commission = normalizeMoneyInput(raw.commission);

  return {
    brand: raw.brand?.trim() ?? "",
    productTitle: raw.productTitle?.trim() ?? "",
    productCost,
    productLink: raw.productLink?.trim() ?? "",
    ppFee,
    totalProductCost,
    totalCostWithFee,
    commission,
    reviewProductLink: raw.reviewProductLink?.trim() ?? ""
  };
}

export function isMeaningfulLineItem(item: AssignmentSetLineItem) {
  return Boolean(item.productTitle || item.brand || item.productLink);
}

export function sumCommission(items: AssignmentSetLineItem[]) {
  return items
    .reduce((sum, item) => sum + Number(item.commission ?? 0), 0)
    .toFixed(2);
}

export function mapOpportunityStatusToAssignmentStatus(status: OpportunityStatus) {
  switch (status) {
    case "SENT":
    case "PAID":
      return "APPROVED";
    case "FAILED":
      return "REJECTED";
    case "CANCELED":
      return "CANCELED";
    case "DRAFT":
    default:
      return "ASSIGNED";
  }
}
