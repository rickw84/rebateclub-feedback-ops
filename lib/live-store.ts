import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { importSummary as fallbackImportSummary } from "@/lib/mock-data";
import {
  inferMarketplaceFromUrl,
  mapOpportunityStatusToAssignmentStatus,
  normalizeLineItem,
  normalizePayments,
  parseAmazonAsin,
  slugify
} from "@/lib/assignment-set";
import {
  buildOpportunityGroupId,
  buildPayoutOpportunityRows,
  findPayoutOpportunityDetail
} from "@/lib/payout-opportunities";
const rootDir = process.env.LIVE_STORE_DIR
  ? path.resolve(process.env.LIVE_STORE_DIR)
  : process.cwd();
const seedPath = path.join(rootDir, "outputs", "payment-tracker-import.json");
const livePath = path.join(rootDir, "outputs", "live-data.json");

type LiveStore = {
  metadata?: Record<string, unknown>;
  organizations: Array<Record<string, any>>;
  users: Array<Record<string, any>>;
  participantProfiles: Array<Record<string, any>>;
  campaigns: Array<Record<string, any>>;
  products: Array<Record<string, any>>;
  campaignProducts: Array<Record<string, any>>;
  applications: Array<Record<string, any>>;
  assignments: Array<Record<string, any>>;
  submissions: Array<Record<string, any>>;
  payoutBatches: Array<Record<string, any>>;
  payouts: Array<Record<string, any>>;
  warnings?: string[];
};

function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function productAsinSeed(value: string) {
  return `MAN${slugify(value || randomUUID()).replace(/-/g, "").toUpperCase().slice(0, 7)}`.padEnd(10, "0");
}

async function ensureLiveStore() {
  try {
    await fs.access(livePath);
  } catch {
    const seed = await fs.readFile(seedPath, "utf8");
    await fs.writeFile(livePath, seed, "utf8");
  }
}

export async function readLiveStore(): Promise<LiveStore> {
  await ensureLiveStore();
  return JSON.parse(await fs.readFile(livePath, "utf8")) as LiveStore;
}

export async function writeLiveStore(store: LiveStore) {
  await fs.writeFile(livePath, JSON.stringify(store, null, 2), "utf8");
}

function getPrimaryOrganization(store: LiveStore) {
  return store.organizations[0] ?? null;
}

function getOrCreateSystemUser(store: LiveStore, organizationId: string) {
  const organization = store.organizations.find((item) => item.id === organizationId);
  const email = `ops-admin+${organization?.slug ?? "org"}@feedback-ops.local`;
  let user = store.users.find((item) => item.email === email);
  if (!user) {
    user = {
      id: makeId("usr"),
      organizationId,
      role: "OWNER",
      name: `${organization?.name ?? "Operations"} Ops`,
      email,
      passwordHash: null,
      isActive: true
    };
    store.users.unshift(user);
  }
  return user;
}

function summarizeParticipants(store: LiveStore) {
  return store.participantProfiles
    .map((profile) => {
      const user = store.users.find((item) => item.id === profile.userId);
      const assignmentCount = store.assignments.filter((item) => item.participantId === profile.id).length;
      const payoutTotal = store.payouts
        .filter((item) => item.participantId === profile.id)
        .reduce((sum, payout) => sum + Number(payout.amount ?? 0), 0);

      return {
        name: user?.name ?? profile.displayName,
        marketplace: profile.marketplace ?? "unknown",
        score: profile.score ?? 70,
        status:
          profile.verificationStatus === "VERIFIED"
            ? "Verified"
            : profile.verificationStatus === "PENDING_REVIEW"
              ? "Pending review"
              : profile.verificationStatus,
        assignments: assignmentCount,
        payouts: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD"
        }).format(payoutTotal)
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function summarizePayouts(store: LiveStore) {
  return store.payoutBatches
    .map((batch) => {
      const participant = store.participantProfiles.find((item) => item.id === batch.participantId);
      return {
        source: batch.sourceLabel || "Manual",
        participant: participant?.displayName ?? "Unknown participant",
        batchType: String(batch.batchType ?? "MIXED")
          .toLowerCase()
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        amount: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD"
        }).format(Number(batch.totalAmount ?? 0)),
        status: batch.providerBatchId || batch.fullPaymentDate ? "Paid" : "Pending reconciliation"
      };
    })
    .sort((a, b) => a.source.localeCompare(b.source))
    .slice(0, 8);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value ?? 0));
}

function buildPayoutRecord(store: LiveStore, payout: Record<string, any>) {
  const participant = store.participantProfiles.find((item) => item.id === payout.participantId) ?? null;
  const assignment = store.assignments.find((item) => item.id === payout.assignmentId) ?? null;
  const campaign = assignment
    ? store.campaigns.find((item) => item.id === assignment.campaignId) ?? null
    : null;
  const user = participant ? store.users.find((item) => item.id === participant.userId) ?? null : null;
  const payoutBatch = payout.payoutBatchId
    ? store.payoutBatches.find((item) => item.id === payout.payoutBatchId) ?? null
    : null;
  const requestDate =
    assignment?.deliverableSnapshot?.legacyRequestDate ??
    assignment?.assignedAt ??
    payout.scheduledAt ??
    payout.createdAt ??
    null;

  return {
    id: payout.id,
    uniquePaymentId: payout.id,
    requestDate,
    requestDateLabel: formatDate(requestDate),
    email: payout.recipientEmail ?? participant?.paypalEmail ?? user?.email ?? "N/A",
    campaign: campaign?.name ?? assignment?.sourceLabel ?? payoutBatch?.sourceLabel ?? "Unassigned",
    participantName: participant?.displayName ?? user?.name ?? "Unknown participant",
    amount: payout.amount,
    amountLabel: formatMoney(payout.amount),
    status: payout.status,
    payoutType: payout.payoutType,
    provider: payout.provider ?? "PAYPAL",
    providerReference: payout.providerReference ?? payout.providerItemId ?? payout.providerBatchId ?? null,
    batchId: payout.payoutBatchId ?? null,
    assignmentId: payout.assignmentId,
    createdAt: payout.createdAt ?? null,
    sentAt: payout.sentAt ?? null,
    settledAt: payout.settledAt ?? null,
    internalNotes: assignment?.internalNotes ?? null
  };
}

function applyPayoutFilters(
  records: Array<ReturnType<typeof buildPayoutRecord>>,
  filters: { q?: string; status?: string; campaign?: string; sort?: string; dir?: string }
) {
  const q = filters.q?.trim().toLowerCase();
  const status = filters.status?.trim().toUpperCase();
  const campaign = filters.campaign?.trim();

  return records.filter((record) => {
    const matchesQuery =
      !q ||
      record.uniquePaymentId.toLowerCase().includes(q) ||
      record.email.toLowerCase().includes(q) ||
      record.participantName.toLowerCase().includes(q) ||
      record.campaign.toLowerCase().includes(q);

    const matchesStatus = !status || record.status === status;
    const matchesCampaign = !campaign || record.campaign === campaign;

    return matchesQuery && matchesStatus && matchesCampaign;
  });
}

function sortPayoutRecords(
  records: Array<ReturnType<typeof buildPayoutRecord>>,
  sort: string | undefined,
  dir: string | undefined
) {
  const direction = dir === "asc" ? 1 : -1;
  const key = sort ?? "requestDate";

  const getComparable = (record: ReturnType<typeof buildPayoutRecord>) => {
    switch (key) {
      case "uniquePaymentId":
        return record.uniquePaymentId.toLowerCase();
      case "email":
        return record.email.toLowerCase();
      case "campaign":
        return record.campaign.toLowerCase();
      case "participant":
        return record.participantName.toLowerCase();
      case "amount":
        return Number(record.amount ?? 0);
      case "status":
        return record.status.toLowerCase();
      case "requestDate":
      default:
        return new Date(record.requestDate ?? record.createdAt ?? 0).getTime();
    }
  };

  return [...records].sort((left, right) => {
    const a = getComparable(left);
    const b = getComparable(right);
    if (a < b) return -1 * direction;
    if (a > b) return 1 * direction;
    return 0;
  });
}

function parsePage(value: string | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function parsePageSize(value: string | undefined) {
  const allowed = new Set([100, 300, 500, 1000]);
  const parsed = Number(value ?? 100);
  return allowed.has(parsed) ? parsed : 100;
}

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    pagination: {
      page: currentPage,
      pageSize,
      totalItems,
      totalPages
    }
  };
}

export async function getLiveDashboardData() {
  const store = await readLiveStore();
  const pendingSubmissionCount = store.assignments.filter((item) =>
    ["SUBMITTED", "NEEDS_REVISION"].includes(item.status)
  ).length;
  const flaggedParticipantCount = store.participantProfiles.filter((item) =>
    ["HIGH"].includes(item.riskLevel) || ["PENDING_REVIEW", "BLOCKED"].includes(item.verificationStatus)
  ).length;
  const payoutProofGapCount = store.payoutBatches.filter(
    (item) => !item.proofImageUrl || !item.providerBatchId
  ).length;

  return {
    stats: [
      {
        label: "Active Campaigns",
        value: String(store.campaigns.length),
        delta: "Live file-backed data"
      },
      {
        label: "Tracked Participants",
        value: String(store.participantProfiles.length),
        delta: "Imported plus newly created profiles"
      },
      {
        label: "Assignment Records",
        value: String(store.assignments.length),
        delta: "Product-level workflow records"
      },
      {
        label: "Payout Events",
        value: String(store.payoutBatches.length),
        delta: "Live payout batch rows"
      }
    ],
    urgentQueue: [
      {
        title: "Submission review queue",
        detail: `${pendingSubmissionCount} assignments are waiting on review or revision handling.`,
        badge: pendingSubmissionCount ? "Needs review" : "Clear",
        tone: pendingSubmissionCount ? "warn" : "good"
      },
      {
        title: "Risk flags",
        detail: `${flaggedParticipantCount} participant profiles need manual attention or verification cleanup.`,
        badge: flaggedParticipantCount ? "Watchlist" : "Healthy",
        tone: flaggedParticipantCount ? "alert" : "good"
      },
      {
        title: "Unreconciled payouts",
        detail: `${payoutProofGapCount} payout batches are missing proof or provider references.`,
        badge: payoutProofGapCount ? "Ops check" : "Reconciled",
        tone: payoutProofGapCount ? "warn" : "good"
      }
    ],
    participantRows: summarizeParticipants(store),
    payoutRows: summarizePayouts(store),
    importSummary: {
      campaigns: store.campaigns.length,
      participantProfiles: store.participantProfiles.length,
      assignments: store.assignments.length,
      payoutBatches: store.payoutBatches.length,
      payouts: store.payouts.length,
      products: store.products.length
    },
    managementOptions: {
      campaigns: store.campaigns
        .slice(0, 25)
        .map((campaign) => ({ id: campaign.id, name: campaign.name })),
      participants: store.participantProfiles
        .slice(0, 50)
        .map((profile) => ({ id: profile.id, name: profile.displayName })),
      products: store.products
        .slice(0, 50)
        .map((product) => ({ id: product.id, name: product.title })),
      assignments: store.assignments.slice(0, 50).map((assignment) => {
        const participant = store.participantProfiles.find((item) => item.id === assignment.participantId);
        const product = store.products.find((item) => item.id === assignment.productId);
        return {
          id: assignment.id,
          name: `${participant?.displayName ?? "Unknown"} - ${product?.title ?? "Product"}`
        };
      })
    }
  };
}

export async function getLivePortalData() {
  const store = await readLiveStore();
  return {
    snapshot: {
      assignmentCount: store.assignments.length,
      payoutCount: store.payouts.length
    }
  };
}

export async function getLivePayoutListingData(
  filters: { q?: string; status?: string; campaign?: string; sort?: string; dir?: string } = {}
) {
  const store = await readLiveStore();
  const records = store.payouts.map((payout) => buildPayoutRecord(store, payout));
  const campaigns = Array.from(new Set(records.map((record) => record.campaign))).sort((a, b) =>
    a.localeCompare(b)
  );
  const filtered = sortPayoutRecords(applyPayoutFilters(records, filters), filters.sort, filters.dir);
  const tabs = {
    all: records.length,
    needsApproval: records.filter((record) => ["DRAFT", "QUEUED"].includes(record.status)).length,
    sent: records.filter((record) => record.status === "SENT").length,
    paid: records.filter((record) => record.status === "PAID").length,
    failed: records.filter((record) => record.status === "FAILED").length,
    canceled: records.filter((record) => record.status === "CANCELED").length
  };

  const page = parsePage((filters as { page?: string }).page);
  const pageSize = parsePageSize((filters as { pageSize?: string }).pageSize);
  const paged = paginateRows(filtered, page, pageSize);

  return {
    filters: {
      q: filters.q ?? "",
      status: filters.status ?? "",
      campaign: filters.campaign ?? "",
      sort: filters.sort ?? "requestDate",
      dir: filters.dir ?? "desc",
      page: String(paged.pagination.page),
      pageSize: String(paged.pagination.pageSize)
    },
    campaigns,
    rows: paged.rows,
    tabs,
    pagination: paged.pagination
  };
}

export async function getLivePayoutDetail(id: string) {
  const store = await readLiveStore();
  const payout = store.payouts.find((item) => item.id === id);
  if (!payout) {
    return null;
  }

  const record = buildPayoutRecord(store, payout);
  const assignment = store.assignments.find((item) => item.id === payout.assignmentId) ?? null;
  const participant = store.participantProfiles.find((item) => item.id === payout.participantId) ?? null;
  const user = participant ? store.users.find((item) => item.id === participant.userId) ?? null : null;
  const campaign = assignment
    ? store.campaigns.find((item) => item.id === assignment.campaignId) ?? null
    : null;
  const product = assignment
    ? store.products.find((item) => item.id === assignment.productId) ?? null
    : null;

  return {
    record,
    assignment,
    participant,
    user,
    campaign,
    product
  };
}

function buildLiveOpportunitySourceRecords(store: LiveStore) {
  const assignmentRecords = store.assignments.map((assignment) => {
    const participant = store.participantProfiles.find((item) => item.id === assignment.participantId) ?? null;
    const user = participant ? store.users.find((item) => item.id === participant.userId) ?? null : null;
    const campaign = store.campaigns.find((item) => item.id === assignment.campaignId) ?? null;
    const product = store.products.find((item) => item.id === assignment.productId) ?? null;
    const submissions = store.submissions.filter((item) => item.assignmentId === assignment.id);

    return {
      payout: null,
      assignment,
      participant,
      user,
      campaign,
      product,
      payoutBatch: null,
      submissions
    };
  });

  const payoutRecords = store.payouts.map((payout) => {
    const assignment = store.assignments.find((item) => item.id === payout.assignmentId) ?? null;
    const participant = store.participantProfiles.find((item) => item.id === payout.participantId) ?? null;
    const user = participant ? store.users.find((item) => item.id === participant.userId) ?? null : null;
    const campaign = assignment
      ? store.campaigns.find((item) => item.id === assignment.campaignId) ?? null
      : null;
    const product = assignment
      ? store.products.find((item) => item.id === assignment.productId) ?? null
      : null;
    const payoutBatch = payout.payoutBatchId
      ? store.payoutBatches.find((item) => item.id === payout.payoutBatchId) ?? null
      : null;
    const submissions = assignment
      ? store.submissions.filter((item) => item.assignmentId === assignment.id)
      : [];

    return {
      payout,
      assignment,
      participant,
      user,
      campaign,
      product,
      payoutBatch,
      submissions
    };
  });

  return [...assignmentRecords, ...payoutRecords];
}

export async function getLiveAssignmentOpportunityListingData(
  filters: { q?: string; status?: string; campaign?: string; sort?: string; dir?: string } = {}
) {
  const store = await readLiveStore();
  return buildPayoutOpportunityRows(buildLiveOpportunitySourceRecords(store), filters);
}

export async function getLiveAssignmentOpportunityDetail(id: string) {
  const store = await readLiveStore();
  return findPayoutOpportunityDetail(buildLiveOpportunitySourceRecords(store), id);
}

export async function listCampaignsLive() {
  const store = await readLiveStore();
  return store.campaigns;
}

export async function createCampaignLive(input: Record<string, any>) {
  const store = await readLiveStore();
  const organization = getPrimaryOrganization(store);
  if (!organization) {
    throw new Error("No organization found in live store.");
  }

  const systemUser = getOrCreateSystemUser(store, organization.id);
  const campaign = {
    id: makeId("cmp"),
    organizationId: organization.id,
    createdById: systemUser.id,
    name: input.name,
    clientName: input.clientName ?? null,
    description: input.description ?? null,
    status: input.status ?? "DRAFT",
    participantLimit: input.participantLimit ?? null,
    rewardAmount: input.rewardAmount ?? null,
    rewardCurrency: input.rewardCurrency ?? "USD",
    deliverables: input.deliverables ?? { checklist: [], source: "live-create" },
    eligibilityRules: input.eligibilityRules ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.campaigns.unshift(campaign);
  await writeLiveStore(store);
  return campaign;
}

export async function getCampaignLive(id: string) {
  const store = await readLiveStore();
  return store.campaigns.find((item) => item.id === id) ?? null;
}

export async function updateCampaignLive(id: string, patch: Record<string, any>) {
  const store = await readLiveStore();
  const campaign = store.campaigns.find((item) => item.id === id);
  if (!campaign) {
    return null;
  }
  Object.assign(campaign, patch, { updatedAt: new Date().toISOString() });
  await writeLiveStore(store);
  return campaign;
}

export async function listParticipantsLive() {
  const store = await readLiveStore();
  return store.participantProfiles.map((profile) => ({
    ...profile,
    user: store.users.find((user) => user.id === profile.userId) ?? null
  }));
}

export async function createParticipantLive(input: Record<string, any>) {
  const store = await readLiveStore();
  const organization = getPrimaryOrganization(store);
  if (!organization) {
    throw new Error("No organization found in live store.");
  }
  const user = {
    id: makeId("usr"),
    organizationId: organization.id,
    role: "PARTICIPANT",
    name: input.name,
    email: input.email,
    passwordHash: null,
    isActive: true
  };
  const profile = {
    id: makeId("prt"),
    userId: user.id,
    displayName: input.displayName ?? input.name,
    paypalEmail: input.paypalEmail ?? null,
    country: input.country ?? null,
    marketplace: input.marketplace ?? "amazon.com",
    niches: input.niches ?? [],
    bio: input.bio ?? null,
    avatarUrl: null,
    amazonProfileUrl: input.amazonProfileUrl ?? null,
    verificationScreenshotUrl: null,
    verificationStatus: input.verificationStatus ?? "NEW",
    riskLevel: input.riskLevel ?? "MEDIUM",
    score: 70,
    totalAssignments: 0,
    completedAssignments: 0,
    approvedAssignments: 0,
    onTimeAssignments: 0,
    noShowCount: 0,
    disputeCount: 0,
    notes: input.notes ?? null,
    lastVerifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.users.unshift(user);
  store.participantProfiles.unshift(profile);
  await writeLiveStore(store);
  return { user, profile };
}

export async function getParticipantLive(id: string) {
  const store = await readLiveStore();
  const profile = store.participantProfiles.find((item) => item.id === id);
  if (!profile) {
    return null;
  }
  return {
    ...profile,
    user: store.users.find((user) => user.id === profile.userId) ?? null,
    assignments: store.assignments.filter((assignment) => assignment.participantId === id),
    payouts: store.payouts.filter((payout) => payout.participantId === id)
  };
}

export async function updateParticipantLive(id: string, patch: Record<string, any>) {
  const store = await readLiveStore();
  const profile = store.participantProfiles.find((item) => item.id === id);
  if (!profile) {
    return null;
  }
  Object.assign(profile, patch, { updatedAt: new Date().toISOString() });
  const user = store.users.find((item) => item.id === profile.userId);
  if (user) {
    if (patch.name) user.name = patch.name;
    if (patch.email) user.email = patch.email;
    if (typeof patch.isActive === "boolean") user.isActive = patch.isActive;
  }
  await writeLiveStore(store);
  return profile;
}

export async function listAssignmentsLive() {
  const store = await readLiveStore();
  return store.assignments.map((assignment) => ({
    ...assignment,
    participant: store.participantProfiles.find((item) => item.id === assignment.participantId) ?? null,
    product: store.products.find((item) => item.id === assignment.productId) ?? null,
    campaign: store.campaigns.find((item) => item.id === assignment.campaignId) ?? null
  }));
}

export async function createAssignmentLive(input: Record<string, any>) {
  const store = await readLiveStore();
  const assignment = {
    id: makeId("asn"),
    campaignId: input.campaignId,
    productId: input.productId,
    participantId: input.participantId,
    applicationId: input.applicationId ?? null,
    assignedById: input.assignedById ?? null,
    status: input.status ?? "ASSIGNED",
    baseRewardAmount: input.baseRewardAmount ?? "0.00",
    bonusRewardAmount: input.bonusRewardAmount ?? null,
    rewardCurrency: input.rewardCurrency ?? "USD",
    assignedAt: input.assignedAt ?? new Date().toISOString(),
    acceptedAt: input.acceptedAt ?? null,
    dueAt: input.dueAt ?? null,
    submittedAt: null,
    approvedAt: null,
    lastFollowUpAt: null,
    followUpCount: 0,
    sourceLabel: input.sourceLabel ?? null,
    clientBillingLabel: input.clientBillingLabel ?? null,
    purchaseSubtotal: input.purchaseSubtotal ?? input.baseRewardAmount ?? "0.00",
    taxAdjustmentAmount: input.taxAdjustmentAmount ?? null,
    miscAdjustmentAmount: input.miscAdjustmentAmount ?? null,
    internalNotes: input.internalNotes ?? null,
    deliverableSnapshot: input.deliverableSnapshot ?? { checklist: [], source: "live-create" }
  };
  store.assignments.unshift(assignment);
  const participant = store.participantProfiles.find((item) => item.id === input.participantId);
  if (participant) {
    participant.totalAssignments = Number(participant.totalAssignments ?? 0) + 1;
    participant.updatedAt = new Date().toISOString();
  }
  await writeLiveStore(store);
  return assignment;
}

export async function createAssignmentSetLive(input: {
  opportunityStatus: string;
  requestDate?: string;
  fullPaymentDate?: string;
  commissionPaymentDate?: string;
  participantName: string;
  participantEmail: string;
  paypalEmail?: string;
  newsletterCampaign: string;
  lineItems: Array<Record<string, any>>;
  payments: Record<string, any>;
}) {
  const store = await readLiveStore();
  const organization = getPrimaryOrganization(store);
  if (!organization) {
    throw new Error("No organization found in live store.");
  }

  let user = store.users.find(
    (item) => String(item.email).toLowerCase() === input.participantEmail.toLowerCase()
  );
  let participant = user
    ? store.participantProfiles.find((item) => item.userId === user?.id) ?? null
    : null;

  if (!user) {
    user = {
      id: makeId("usr"),
      organizationId: organization.id,
      role: "PARTICIPANT",
      name: input.participantName,
      email: input.participantEmail.toLowerCase(),
      passwordHash: null,
      isActive: true
    };
    store.users.unshift(user);
  } else {
    user.name = input.participantName;
  }

  if (!participant) {
    participant = {
      id: makeId("prt"),
      userId: user.id,
      displayName: input.participantName,
      paypalEmail: input.paypalEmail ?? input.participantEmail,
      country: null,
      marketplace: "amazon.com",
      niches: [],
      bio: null,
      avatarUrl: null,
      amazonProfileUrl: null,
      verificationScreenshotUrl: null,
      verificationStatus: "NEW",
      riskLevel: "MEDIUM",
      score: 70,
      totalAssignments: 0,
      completedAssignments: 0,
      approvedAssignments: 0,
      onTimeAssignments: 0,
      noShowCount: 0,
      disputeCount: 0,
      notes: null,
      lastVerifiedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.participantProfiles.unshift(participant);
  } else {
    participant.displayName = input.participantName;
    participant.paypalEmail = input.paypalEmail ?? participant.paypalEmail ?? input.participantEmail;
    participant.updatedAt = new Date().toISOString();
  }

  const payments = normalizePayments(input.payments ?? {});
  const systemUser = getOrCreateSystemUser(store, organization.id);
  const campaign = {
    id: makeId("cmp"),
    organizationId: organization.id,
    createdById: systemUser.id,
    name: input.newsletterCampaign,
    clientName: null,
    description: `Assignment set created from the assignments popup for ${input.participantName}.`,
    status: "ACTIVE",
    participantLimit: null,
    rewardAmount: null,
    rewardCurrency: "USD",
    deliverables: {
      source: "assignment-set-form",
      requestDate: input.requestDate ?? null,
      payments
    },
    eligibilityRules: null,
    startDate: input.requestDate ?? null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.campaigns.unshift(campaign);

  let primaryAssignmentId: string | null = null;

  for (const rawLineItem of input.lineItems) {
    const lineItem = normalizeLineItem(rawLineItem);
    const marketplace = inferMarketplaceFromUrl(lineItem.productLink);
    const asin =
      parseAmazonAsin(lineItem.productLink) ??
      productAsinSeed(`${lineItem.brand}-${lineItem.productTitle}-${Date.now()}-${randomUUID()}`);

    let product = store.products.find(
      (item) => item.organizationId === organization.id && item.asin === asin && item.marketplace === marketplace
    );
    if (!product) {
      product = {
        id: makeId("prd"),
        organizationId: organization.id,
        brandName: lineItem.brand || null,
        asin,
        title: lineItem.productTitle || "Untitled product",
        amazonUrl: lineItem.productLink || null,
        marketplace,
        imageUrl: null,
        category: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.products.unshift(product);
    }

    if (!store.campaignProducts.find((item) => item.campaignId === campaign.id && item.productId === product.id)) {
      store.campaignProducts.unshift({
        id: makeId("cpr"),
        campaignId: campaign.id,
        productId: product.id,
        basketCode: null,
        quantityTarget: null,
        assignmentLimit: null,
        createdAt: new Date().toISOString()
      });
    }

    const assignment = {
      id: makeId("asn"),
      campaignId: campaign.id,
      productId: product.id,
      participantId: participant.id,
      applicationId: null,
      assignedById: systemUser.id,
      status: mapOpportunityStatusToAssignmentStatus(input.opportunityStatus as any),
      baseRewardAmount: lineItem.productCost,
      bonusRewardAmount: null,
      rewardCurrency: "USD",
      assignedAt: input.requestDate || new Date().toISOString(),
      acceptedAt: null,
      dueAt: null,
      submittedAt: lineItem.reviewProductLink ? input.requestDate || new Date().toISOString() : null,
      approvedAt: ["SENT", "PAID"].includes(input.opportunityStatus) ? input.fullPaymentDate || new Date().toISOString() : null,
      lastFollowUpAt: null,
      followUpCount: 0,
      sourceLabel: input.newsletterCampaign,
      clientBillingLabel: null,
      purchaseSubtotal: lineItem.productCost,
      taxAdjustmentAmount: null,
      miscAdjustmentAmount: null,
      internalNotes: null,
      deliverableSnapshot: {
        source: "assignment-set-form",
        legacyRequestDate: input.requestDate ?? null,
        productLink: lineItem.productLink || null,
        reviewProductLink: lineItem.reviewProductLink || null,
        payments
      }
    };
    store.assignments.unshift(assignment);

    if (!primaryAssignmentId) {
      primaryAssignmentId = assignment.id;
    }

    participant.totalAssignments = Number(participant.totalAssignments ?? 0) + 1;
    participant.updatedAt = new Date().toISOString();

    if (lineItem.reviewProductLink) {
      store.submissions.unshift({
        id: makeId("sub"),
        assignmentId: assignment.id,
        submittedById: participant.id,
        version: 1,
        questionnaireData: null,
        attachmentUrls: [],
        externalLinks: {
          legacyReviewUrl: lineItem.reviewProductLink
        },
        adminNotes: null,
        decision: ["SENT", "PAID"].includes(input.opportunityStatus) ? "APPROVED" : "PENDING",
        reviewedAt: ["SENT", "PAID"].includes(input.opportunityStatus) ? input.fullPaymentDate ?? null : null,
        reviewedById: ["SENT", "PAID"].includes(input.opportunityStatus) ? systemUser.id : null,
        submittedAt: input.requestDate || new Date().toISOString()
      });
    }
  }

  if (!primaryAssignmentId) {
    throw new Error("No assignment records were created.");
  }

  if (Number(payments.totalProductCost) > 0 || Number(payments.ppFee) > 0) {
    store.payouts.unshift({
      id: makeId("pay"),
      payoutBatchId: null,
      assignmentId: primaryAssignmentId,
      participantId: participant.id,
      createdById: systemUser.id,
      status: input.opportunityStatus,
      payoutType: "base_reimbursement",
      amount: payments.totalProductCost,
      feeAmount: payments.ppFee,
      currency: "USD",
      recipientEmail: participant.paypalEmail ?? user.email,
      provider: "PAYPAL",
      providerBatchId: null,
      providerItemId: null,
      providerReference: null,
      proofImageUrl: null,
      failureReason: input.opportunityStatus === "FAILED" ? "Marked failed from assignment popup." : null,
      scheduledAt: input.fullPaymentDate ?? input.requestDate ?? new Date().toISOString(),
      sentAt: ["SENT", "PAID"].includes(input.opportunityStatus) ? input.fullPaymentDate ?? new Date().toISOString() : null,
      settledAt: input.opportunityStatus === "PAID" ? input.fullPaymentDate ?? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  if (Number(payments.commission) > 0) {
    store.payouts.unshift({
      id: makeId("pay"),
      payoutBatchId: null,
      assignmentId: primaryAssignmentId,
      participantId: participant.id,
      createdById: systemUser.id,
      status: input.opportunityStatus,
      payoutType: "bonus_commission",
      amount: payments.commission,
      feeAmount: null,
      currency: "USD",
      recipientEmail: participant.paypalEmail ?? user.email,
      provider: "PAYPAL",
      providerBatchId: null,
      providerItemId: null,
      providerReference: null,
      proofImageUrl: null,
      failureReason: input.opportunityStatus === "FAILED" ? "Marked failed from assignment popup." : null,
      scheduledAt: input.commissionPaymentDate ?? input.fullPaymentDate ?? input.requestDate ?? new Date().toISOString(),
      sentAt: ["SENT", "PAID"].includes(input.opportunityStatus) ? input.commissionPaymentDate ?? input.fullPaymentDate ?? new Date().toISOString() : null,
      settledAt: input.opportunityStatus === "PAID" ? input.commissionPaymentDate ?? input.fullPaymentDate ?? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  if (Number(payments.commissionMisc) > 0) {
    store.payouts.unshift({
      id: makeId("pay"),
      payoutBatchId: null,
      assignmentId: primaryAssignmentId,
      participantId: participant.id,
      createdById: systemUser.id,
      status: input.opportunityStatus,
      payoutType: "commission_misc",
      amount: payments.commissionMisc,
      feeAmount: null,
      currency: "USD",
      recipientEmail: participant.paypalEmail ?? user.email,
      provider: "PAYPAL",
      providerBatchId: null,
      providerItemId: null,
      providerReference: null,
      proofImageUrl: null,
      failureReason: input.opportunityStatus === "FAILED" ? "Marked failed from assignment popup." : null,
      scheduledAt: input.commissionPaymentDate ?? input.fullPaymentDate ?? input.requestDate ?? new Date().toISOString(),
      sentAt: ["SENT", "PAID"].includes(input.opportunityStatus) ? input.commissionPaymentDate ?? input.fullPaymentDate ?? new Date().toISOString() : null,
      settledAt: input.opportunityStatus === "PAID" ? input.commissionPaymentDate ?? input.fullPaymentDate ?? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  await writeLiveStore(store);
  return { campaignId: campaign.id, assignmentId: primaryAssignmentId };
}

export async function updateAssignmentOpportunitySummaryLive(input: {
  participantId: string;
  campaignId: string;
  assignmentIds: string[];
  payoutIds: string[];
  requestDate: string;
  participantName: string;
  participantEmail: string;
  paypalEmail?: string;
  newsletterCampaign: string;
  opportunityStatus: string;
  fullPaymentDate?: string;
  totalProductCost: string;
  totalCostWithFee: string;
  ppFee: string;
  commissionTotal: string;
}) {
  const store = await readLiveStore();
  const participant = store.participantProfiles.find((item) => item.id === input.participantId);
  if (!participant) {
    throw new Error("Participant not found.");
  }

  const user = store.users.find((item) => item.id === participant.userId);
  if (!user) {
    throw new Error("Participant user not found.");
  }

  const campaign = store.campaigns.find((item) => item.id === input.campaignId);
  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  user.name = input.participantName;
  user.email = input.participantEmail.toLowerCase();
  user.isActive = true;

  participant.displayName = input.participantName;
  participant.paypalEmail = input.paypalEmail ?? input.participantEmail;
  participant.updatedAt = new Date().toISOString();

  campaign.name = input.newsletterCampaign;
  campaign.description = `Assignment opportunity updated for ${input.participantName}.`;
  campaign.deliverables = {
    ...(campaign.deliverables ?? {}),
    requestDate: input.requestDate,
    payments: {
      totalProductCost: input.totalProductCost,
      ppFee: input.ppFee,
      totalCostWithFee: input.totalCostWithFee,
      commission: input.commissionTotal,
      commissionMisc: "0.00",
      totalCommission: input.commissionTotal
    }
  };
  campaign.startDate = input.requestDate;
  campaign.updatedAt = new Date().toISOString();

  const assignments = store.assignments.filter((item) => input.assignmentIds.includes(item.id));
  if (!assignments.length) {
    throw new Error("Assignment records not found.");
  }

  for (const assignment of assignments) {
    assignment.status = mapOpportunityStatusToAssignmentStatus(input.opportunityStatus as any);
    assignment.assignedAt = input.requestDate;
    assignment.approvedAt = ["SENT", "PAID"].includes(input.opportunityStatus)
      ? input.fullPaymentDate ?? null
      : null;
    assignment.sourceLabel = input.newsletterCampaign;
    assignment.deliverableSnapshot = {
      ...(assignment.deliverableSnapshot ?? {}),
      legacyRequestDate: input.requestDate,
      payments: {
        totalProductCost: input.totalProductCost,
        ppFee: input.ppFee,
        totalCostWithFee: input.totalCostWithFee,
        commission: input.commissionTotal,
        commissionMisc: "0.00",
        totalCommission: input.commissionTotal
      }
    };

    const submissions = store.submissions.filter((item) => item.assignmentId === assignment.id);
    if (submissions.length) {
      assignment.submittedAt = input.requestDate;
    }

    for (const submission of submissions) {
      submission.decision = ["SENT", "PAID"].includes(input.opportunityStatus) ? "APPROVED" : "PENDING";
      submission.reviewedAt = ["SENT", "PAID"].includes(input.opportunityStatus)
        ? input.fullPaymentDate ?? null
        : null;
      submission.submittedAt = input.requestDate;
    }
  }

  const basePaymentDate = input.fullPaymentDate ?? input.requestDate;
  const payouts = store.payouts.filter((item) => input.payoutIds.includes(item.id));
  const reimbursementPayouts = payouts.filter((item) => item.payoutType === "base_reimbursement");
  const commissionPayouts = payouts.filter((item) => ["bonus_commission", "commission_misc"].includes(String(item.payoutType ?? "")));

  if (reimbursementPayouts.length) {
    const [first, ...rest] = reimbursementPayouts;
    first.status = input.opportunityStatus;
    first.amount = input.totalProductCost;
    first.feeAmount = input.ppFee;
    first.recipientEmail = input.paypalEmail ?? input.participantEmail;
    first.scheduledAt = basePaymentDate;
    first.sentAt = ["SENT", "PAID"].includes(input.opportunityStatus) ? basePaymentDate : null;
    first.settledAt = input.opportunityStatus === "PAID" ? basePaymentDate : null;
    first.failureReason = input.opportunityStatus === "FAILED" ? "Updated from assignment detail." : null;
    first.updatedAt = new Date().toISOString();

    for (const payout of rest) {
      payout.status = input.opportunityStatus;
      payout.amount = "0.00";
      payout.feeAmount = "0.00";
      payout.recipientEmail = input.paypalEmail ?? input.participantEmail;
      payout.sentAt = ["SENT", "PAID"].includes(input.opportunityStatus) ? basePaymentDate : null;
      payout.settledAt = input.opportunityStatus === "PAID" ? basePaymentDate : null;
      payout.failureReason = input.opportunityStatus === "FAILED" ? "Merged into grouped assignment total." : null;
      payout.updatedAt = new Date().toISOString();
    }
  } else if (Number(input.totalProductCost) > 0 || Number(input.ppFee) > 0) {
    store.payouts.unshift({
      id: makeId("pay"),
      payoutBatchId: null,
      assignmentId: assignments[0].id,
      participantId: input.participantId,
      createdById: null,
      status: input.opportunityStatus,
      payoutType: "base_reimbursement",
      amount: input.totalProductCost,
      feeAmount: input.ppFee,
      currency: "USD",
      recipientEmail: input.paypalEmail ?? input.participantEmail,
      provider: "PAYPAL",
      providerBatchId: null,
      providerItemId: null,
      providerReference: null,
      proofImageUrl: null,
      failureReason: input.opportunityStatus === "FAILED" ? "Created from assignment detail." : null,
      scheduledAt: basePaymentDate,
      sentAt: ["SENT", "PAID"].includes(input.opportunityStatus) ? basePaymentDate : null,
      settledAt: input.opportunityStatus === "PAID" ? basePaymentDate : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  if (commissionPayouts.length) {
    const [firstCommission, ...restCommission] = commissionPayouts;
    firstCommission.status = input.opportunityStatus;
    firstCommission.amount = input.commissionTotal;
    firstCommission.recipientEmail = input.paypalEmail ?? input.participantEmail;
    firstCommission.sentAt = ["SENT", "PAID"].includes(input.opportunityStatus) ? basePaymentDate : null;
    firstCommission.settledAt = input.opportunityStatus === "PAID" ? basePaymentDate : null;
    firstCommission.failureReason = input.opportunityStatus === "FAILED" ? "Updated from assignment detail." : null;
    firstCommission.updatedAt = new Date().toISOString();

    for (const payout of restCommission) {
      payout.status = input.opportunityStatus;
      payout.amount = "0.00";
      payout.recipientEmail = input.paypalEmail ?? input.participantEmail;
      payout.sentAt = ["SENT", "PAID"].includes(input.opportunityStatus) ? basePaymentDate : null;
      payout.settledAt = input.opportunityStatus === "PAID" ? basePaymentDate : null;
      payout.failureReason = input.opportunityStatus === "FAILED" ? "Merged into grouped assignment total." : null;
      payout.updatedAt = new Date().toISOString();
    }
  } else if (Number(input.commissionTotal) > 0) {
    store.payouts.unshift({
      id: makeId("pay"),
      payoutBatchId: null,
      assignmentId: assignments[0].id,
      participantId: input.participantId,
      createdById: null,
      status: input.opportunityStatus,
      payoutType: "bonus_commission",
      amount: input.commissionTotal,
      feeAmount: null,
      currency: "USD",
      recipientEmail: input.paypalEmail ?? input.participantEmail,
      provider: "PAYPAL",
      providerBatchId: null,
      providerItemId: null,
      providerReference: null,
      proofImageUrl: null,
      failureReason: input.opportunityStatus === "FAILED" ? "Created from assignment detail." : null,
      scheduledAt: basePaymentDate,
      sentAt: ["SENT", "PAID"].includes(input.opportunityStatus) ? basePaymentDate : null,
      settledAt: input.opportunityStatus === "PAID" ? basePaymentDate : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  await writeLiveStore(store);
  return {
    assignmentId: buildOpportunityGroupId(input.participantId, input.campaignId, input.newsletterCampaign, input.requestDate)
  };
}

export async function getAssignmentLive(id: string) {
  const store = await readLiveStore();
  return store.assignments.find((item) => item.id === id) ?? null;
}

export async function updateAssignmentLive(id: string, patch: Record<string, any>) {
  const store = await readLiveStore();
  const assignment = store.assignments.find((item) => item.id === id);
  if (!assignment) {
    return null;
  }
  Object.assign(assignment, patch);
  await writeLiveStore(store);
  return assignment;
}

export async function listPayoutsLive() {
  const store = await readLiveStore();
  return store.payouts.map((payout) => ({
    ...payout,
    payoutBatch: store.payoutBatches.find((batch) => batch.id === payout.payoutBatchId) ?? null,
    participant: store.participantProfiles.find((item) => item.id === payout.participantId) ?? null,
    assignment: store.assignments.find((item) => item.id === payout.assignmentId) ?? null
  }));
}

export async function createPayoutLive(input: Record<string, any>) {
  const store = await readLiveStore();
  const payout = {
    id: makeId("pay"),
    payoutBatchId: input.payoutBatchId ?? null,
    assignmentId: input.assignmentId,
    participantId: input.participantId,
    createdById: input.createdById ?? null,
    status: input.status ?? "DRAFT",
    payoutType: input.payoutType ?? "manual_adjustment",
    amount: input.amount ?? "0.00",
    feeAmount: input.feeAmount ?? null,
    currency: input.currency ?? "USD",
    recipientEmail: input.recipientEmail ?? null,
    provider: input.provider ?? "PAYPAL",
    providerBatchId: input.providerBatchId ?? null,
    providerItemId: input.providerItemId ?? null,
    providerReference: input.providerReference ?? null,
    proofImageUrl: input.proofImageUrl ?? null,
    failureReason: input.failureReason ?? null,
    scheduledAt: input.scheduledAt ?? null,
    sentAt: input.sentAt ?? null,
    settledAt: input.settledAt ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.payouts.unshift(payout);
  await writeLiveStore(store);
  return payout;
}

export async function getPayoutLive(id: string) {
  const store = await readLiveStore();
  return store.payouts.find((item) => item.id === id) ?? null;
}

export async function updatePayoutLive(id: string, patch: Record<string, any>) {
  const store = await readLiveStore();
  const payout = store.payouts.find((item) => item.id === id);
  if (!payout) {
    return null;
  }
  Object.assign(payout, patch, { updatedAt: new Date().toISOString() });
  await writeLiveStore(store);
  return payout;
}

export async function ensureLiveSeedFile() {
  await ensureLiveStore();
  return {
    campaigns: fallbackImportSummary.campaigns
  };
}







