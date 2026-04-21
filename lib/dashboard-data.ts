import { prisma } from "@/lib/db";
import {
  adminStats as fallbackAdminStats,
  adminTimeline,
  importSummary as fallbackImportSummary,
  participantRows as fallbackParticipantRows,
  payoutRows as fallbackPayoutRows,
  portalTasks,
  urgentQueue as fallbackUrgentQueue
} from "@/lib/mock-data";
import {
  listParticipantsLive,
  getLiveAssignmentOpportunityDetail,
  getLiveAssignmentOpportunityListingData,
  getLiveDashboardData,
  getLivePayoutDetail,
  getLivePayoutListingData,
  getLivePortalData
} from "@/lib/live-store";
import { getDatabaseUnavailableMessage, isLiveFallbackEnabled } from "@/lib/runtime-config";
import {
  buildPayoutOpportunityRows,
  findPayoutOpportunityDetail
} from "@/lib/payout-opportunities";

type Stat = {
  label: string;
  value: string;
  delta?: string;
};

type QueueItem = {
  title: string;
  detail: string;
  badge: string;
  tone: string;
};

type PayoutListRow = {
  id: string;
  uniquePaymentId: string;
  requestDate: unknown;
  requestDateLabel: string;
  email: string;
  campaign: string;
  participantName: string;
  amount: unknown;
  amountLabel: string;
  status: string;
  payoutType: string;
  provider: string;
  providerReference: string | null;
  batchId: string | null;
  assignmentId: string;
  createdAt: unknown;
  sentAt: unknown;
  settledAt: unknown;
  internalNotes: string | null;
};

function humanizeBatchType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function handleDataAccessFailure(error: unknown): never {
  if (isLiveFallbackEnabled()) {
    throw error;
  }

  throw new Error(getDatabaseUnavailableMessage());
}

export async function getDashboardData() {
  try {
    const [
      campaignCount,
      participantCount,
      assignmentCount,
      payoutBatchCount,
      pendingSubmissionCount,
      flaggedParticipantCount,
      payoutProofGapCount,
      participants,
      payoutBatches
    ] = await Promise.all([
      prisma.campaign.count(),
      prisma.participantProfile.count(),
      prisma.assignment.count(),
      prisma.payoutBatch.count(),
      prisma.assignment.count({
        where: {
          status: {
            in: ["SUBMITTED", "NEEDS_REVISION"]
          }
        }
      }),
      prisma.participantProfile.count({
        where: {
          OR: [{ riskLevel: "HIGH" }, { verificationStatus: "PENDING_REVIEW" }]
        }
      }),
      prisma.payoutBatch.count({
        where: {
          OR: [{ proofImageUrl: null }, { providerBatchId: null }]
        }
      }),
      prisma.participantProfile.findMany({
        take: 4,
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        include: {
          user: {
            select: {
              name: true
            }
          },
          _count: {
            select: {
              assignments: true
            }
          },
          payouts: {
            select: {
              amount: true
            }
          }
        }
      }),
      prisma.payoutBatch.findMany({
        take: 6,
        orderBy: [{ fullPaymentDate: "desc" }, { createdAt: "desc" }],
        include: {
          participant: {
            select: {
              displayName: true
            }
          }
        }
      })
    ]);

    const stats: Stat[] = [
      {
        label: "Active Campaigns",
        value: String(campaignCount),
        delta: "Live data from Prisma"
      },
      {
        label: "Tracked Participants",
        value: String(participantCount),
        delta: "Profiles in the database"
      },
      {
        label: "Assignment Records",
        value: String(assignmentCount),
        delta: "Product-level work units"
      },
      {
        label: "Payout Events",
        value: String(payoutBatchCount),
        delta: "Batch-level provider sends"
      }
    ];

    const urgentQueue: QueueItem[] = [
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
    ];

    const participantRows = participants.map((profile) => {
      const payoutTotal = profile.payouts.reduce((sum, payout) => sum + Number(payout.amount), 0);
      return {
        name: profile.user.name || profile.displayName,
        marketplace: profile.marketplace || "unknown",
        score: profile.score,
        status:
          profile.verificationStatus === "VERIFIED"
            ? "Verified"
            : profile.verificationStatus === "PENDING_REVIEW"
              ? "Pending review"
              : profile.verificationStatus,
        assignments: profile._count.assignments,
        payouts: formatCurrency(payoutTotal)
      };
    });

    const payoutRows = payoutBatches.map((batch) => ({
      source: batch.sourceLabel || "Legacy import",
      participant: batch.participant.displayName,
      batchType: humanizeBatchType(batch.batchType),
      amount: formatCurrency(Number(batch.totalAmount)),
      status: batch.providerBatchId ? "Paid" : "Pending reconciliation"
    }));

    return {
      stats,
      urgentQueue,
      participantRows,
      payoutRows,
      adminTimeline,
      importSummary: {
        campaigns: campaignCount,
        participantProfiles: participantCount,
        assignments: assignmentCount,
        payoutBatches: payoutBatchCount,
        payouts: await prisma.payout.count(),
        products: await prisma.product.count()
      },
      managementOptions: {
        campaigns: await prisma.campaign.findMany({
          take: 25,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true }
        }),
        participants: await prisma.participantProfile.findMany({
          take: 50,
          orderBy: { updatedAt: "desc" },
          select: { id: true, displayName: true }
        }).then((rows) => rows.map((row) => ({ id: row.id, name: row.displayName }))),
        products: await prisma.product.findMany({
          take: 50,
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true }
        }).then((rows) => rows.map((row) => ({ id: row.id, name: row.title }))),
        assignments: await prisma.assignment.findMany({
          take: 50,
          orderBy: { assignedAt: "desc" },
          include: {
            participant: { select: { displayName: true } },
            product: { select: { title: true } }
          }
        }).then((rows) =>
          rows.map((row) => ({
            id: row.id,
            name: `${row.participant.displayName} - ${row.product.title}`
          }))
        )
      }
    };
  } catch {
    if (!isLiveFallbackEnabled()) {
      handleDataAccessFailure(new Error(getDatabaseUnavailableMessage()));
    }

    const live = await getLiveDashboardData();
    return {
      stats: live.stats ?? fallbackAdminStats,
      urgentQueue: live.urgentQueue ?? fallbackUrgentQueue,
      participantRows: live.participantRows ?? fallbackParticipantRows,
      payoutRows: live.payoutRows ?? fallbackPayoutRows,
      adminTimeline,
      importSummary: live.importSummary ?? fallbackImportSummary,
      managementOptions: live.managementOptions
    };
  }
}

export async function getPortalData() {
  try {
    const [assignmentCount, payoutCount] = await Promise.all([
      prisma.assignment.count({
        where: {
          status: {
            in: ["ASSIGNED", "IN_PROGRESS", "NEEDS_REVISION", "SUBMITTED"]
          }
        }
      }),
      prisma.payout.count()
    ]);

    return {
      tasks: portalTasks,
      snapshot: {
        assignmentCount,
        payoutCount
      }
    };
  } catch {
    if (!isLiveFallbackEnabled()) {
      handleDataAccessFailure(new Error(getDatabaseUnavailableMessage()));
    }

    const live = await getLivePortalData();
    return {
      tasks: portalTasks,
      snapshot: {
        assignmentCount: live.snapshot.assignmentCount ?? fallbackImportSummary.assignments,
        payoutCount: live.snapshot.payoutCount ?? fallbackImportSummary.payouts
      }
    };
  }
}

function formatDate(value: Date | string | null | undefined) {
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

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value ?? 0));
}

type PayoutListingFilters = {
  q?: string;
  status?: string;
  campaign?: string;
  sort?: string;
  dir?: string;
  page?: string;
  pageSize?: string;
};

type ParticipantListingFilters = {
  page?: string;
  pageSize?: string;
};

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
  const pagedRows = rows.slice(start, start + pageSize);

  return {
    rows: pagedRows,
    pagination: {
      page: currentPage,
      pageSize,
      totalItems,
      totalPages
    }
  };
}

function sortPayoutRows(
  rows: PayoutListRow[],
  sort: string | undefined,
  dir: string | undefined
) {
  const direction = dir === "asc" ? 1 : -1;
  const key = sort ?? "requestDate";
  const comparable = (row: PayoutListRow) => {
    switch (key) {
      case "uniquePaymentId":
        return row.uniquePaymentId.toLowerCase();
      case "email":
        return row.email.toLowerCase();
      case "campaign":
        return row.campaign.toLowerCase();
      case "participant":
        return row.participantName.toLowerCase();
      case "amount":
        return Number(row.amount ?? 0);
      case "status":
        return row.status.toLowerCase();
      case "requestDate":
      default:
        return new Date(String(row.requestDate ?? row.createdAt ?? 0)).getTime();
    }
  };

  return [...rows].sort((left, right) => {
    const a = comparable(left);
    const b = comparable(right);
    if (a < b) return -1 * direction;
    if (a > b) return 1 * direction;
    return 0;
  });
}

export async function getPayoutListingData(filters: PayoutListingFilters = {}) {
  try {
    const payouts = await prisma.payout.findMany({
      include: {
        assignment: {
          include: {
            campaign: true,
            participant: {
              include: {
                user: true
              }
            }
          }
        },
        payoutBatch: true,
        participant: {
          include: {
            user: true
          }
        }
      }
    });

    const rows: PayoutListRow[] = payouts.map((payout) => {
      const requestDate =
        (payout.assignment.deliverableSnapshot as Record<string, unknown> | null)?.legacyRequestDate ??
        payout.assignment.assignedAt ??
        payout.scheduledAt ??
        payout.createdAt;
      return {
        id: payout.id,
        uniquePaymentId: payout.id,
        requestDate,
        requestDateLabel: formatDate(requestDate as string | Date | null | undefined),
        email:
          payout.recipientEmail ??
          payout.participant.paypalEmail ??
          payout.participant.user.email ??
          "N/A",
        campaign:
          payout.assignment.campaign.name ??
          payout.assignment.sourceLabel ??
          payout.payoutBatch?.sourceLabel ??
          "Unassigned",
        participantName: payout.participant.displayName ?? payout.participant.user.name,
        amount: payout.amount,
        amountLabel: formatCurrency(payout.amount),
        status: payout.status,
        payoutType: payout.payoutType,
        provider: payout.provider,
        providerReference:
          payout.providerReference ?? payout.providerItemId ?? payout.providerBatchId ?? null,
        batchId: payout.payoutBatchId ?? null,
        assignmentId: payout.assignmentId,
        createdAt: payout.createdAt,
        sentAt: payout.sentAt,
        settledAt: payout.settledAt,
        internalNotes: payout.assignment.internalNotes ?? null
      };
    });

    const filteredRows = rows.filter((row) => {
      const q = filters.q?.trim().toLowerCase();
      const status = filters.status?.trim().toUpperCase();
      const campaign = filters.campaign?.trim();

      const matchesQuery =
        !q ||
        row.uniquePaymentId.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.participantName.toLowerCase().includes(q) ||
        row.campaign.toLowerCase().includes(q);
      const matchesStatus = !status || row.status === status;
      const matchesCampaign = !campaign || row.campaign === campaign;
      return matchesQuery && matchesStatus && matchesCampaign;
    });
    const filtered = sortPayoutRows(filteredRows, filters.sort, filters.dir);
    const tabs = {
      all: rows.length,
      needsApproval: rows.filter((row) => ["DRAFT", "QUEUED"].includes(row.status)).length,
      sent: rows.filter((row) => row.status === "SENT").length,
      paid: rows.filter((row) => row.status === "PAID").length,
      failed: rows.filter((row) => row.status === "FAILED").length,
      canceled: rows.filter((row) => row.status === "CANCELED").length
    };

    const page = parsePage(filters.page);
    const pageSize = parsePageSize(filters.pageSize);
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
      campaigns: Array.from(new Set(rows.map((row) => row.campaign))).sort((a, b) => a.localeCompare(b)),
      rows: paged.rows,
      tabs,
      pagination: paged.pagination
    };
  } catch {
    if (!isLiveFallbackEnabled()) {
      handleDataAccessFailure(new Error(getDatabaseUnavailableMessage()));
    }

    return getLivePayoutListingData(filters);
  }
}

export async function getPayoutDetailData(id: string) {
  try {
    const payout = await prisma.payout.findUnique({
      where: { id },
      include: {
        payoutBatch: true,
        participant: {
          include: {
            user: true
          }
        },
        assignment: {
          include: {
            campaign: true,
            product: true
          }
        }
      }
    });

    if (!payout) {
      return null;
    }

    const requestDate =
      (payout.assignment.deliverableSnapshot as Record<string, unknown> | null)?.legacyRequestDate ??
      payout.assignment.assignedAt ??
      payout.scheduledAt ??
      payout.createdAt;

    return {
      record: {
        id: payout.id,
        uniquePaymentId: payout.id,
        requestDate,
        requestDateLabel: formatDate(requestDate as string | Date | null | undefined),
        email:
          payout.recipientEmail ??
          payout.participant.paypalEmail ??
          payout.participant.user.email ??
          "N/A",
        campaign:
          payout.assignment.campaign.name ??
          payout.assignment.sourceLabel ??
          payout.payoutBatch?.sourceLabel ??
          "Unassigned",
        participantName: payout.participant.displayName ?? payout.participant.user.name,
        amount: payout.amount,
        amountLabel: formatCurrency(payout.amount),
        status: payout.status,
        payoutType: payout.payoutType,
        provider: payout.provider,
        providerReference:
          payout.providerReference ?? payout.providerItemId ?? payout.providerBatchId ?? null,
        batchId: payout.payoutBatchId ?? null,
        assignmentId: payout.assignmentId,
        createdAt: payout.createdAt,
        sentAt: payout.sentAt,
        settledAt: payout.settledAt,
        internalNotes: payout.assignment.internalNotes ?? null
      },
      assignment: payout.assignment,
      participant: payout.participant,
      user: payout.participant.user,
      campaign: payout.assignment.campaign,
      product: payout.assignment.product
    };
  } catch {
    if (!isLiveFallbackEnabled()) {
      handleDataAccessFailure(new Error(getDatabaseUnavailableMessage()));
    }

    return getLivePayoutDetail(id);
  }
}

export async function getAssignmentOpportunityListingData(filters: PayoutListingFilters = {}) {
  try {
    const [assignments, payouts] = await Promise.all([
      prisma.assignment.findMany({
        include: {
          campaign: true,
          product: true,
          submissions: true,
          participant: {
            include: {
              user: true
            }
          }
        }
      }),
      prisma.payout.findMany({
        include: {
          assignment: {
            include: {
              campaign: true,
              product: true,
              submissions: true,
              participant: {
                include: {
                  user: true
                }
              }
            }
          },
          payoutBatch: true,
          participant: {
            include: {
              user: true
            }
          }
        }
      })
    ]);

    const sourceRecords = [
      ...assignments.map((assignment) => ({
        payout: null,
        assignment,
        participant: assignment.participant,
        user: assignment.participant.user,
        campaign: assignment.campaign,
        product: assignment.product,
        payoutBatch: null,
        submissions: assignment.submissions
      })),
      ...payouts.map((payout) => ({
        payout,
        assignment: payout.assignment,
        participant: payout.participant,
        user: payout.participant.user,
        campaign: payout.assignment.campaign,
        product: payout.assignment.product,
        payoutBatch: payout.payoutBatch,
        submissions: payout.assignment.submissions
      }))
    ];

    const grouped = buildPayoutOpportunityRows(sourceRecords, filters);
    const page = parsePage(filters.page);
    const pageSize = parsePageSize(filters.pageSize);
    const paged = paginateRows(grouped.rows, page, pageSize);

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
      campaigns: grouped.campaigns,
      rows: paged.rows,
      tabs: grouped.tabs,
      pagination: paged.pagination
    };
  } catch {
    if (!isLiveFallbackEnabled()) {
      handleDataAccessFailure(new Error(getDatabaseUnavailableMessage()));
    }

    const grouped = await getLiveAssignmentOpportunityListingData(filters);
    const page = parsePage(filters.page);
    const pageSize = parsePageSize(filters.pageSize);
    const paged = paginateRows(grouped.rows, page, pageSize);
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
      campaigns: grouped.campaigns,
      rows: paged.rows,
      tabs: grouped.tabs,
      pagination: paged.pagination
    };
  }
}

export async function getAssignmentOpportunityDetailData(id: string) {
  try {
    const [assignments, payouts] = await Promise.all([
      prisma.assignment.findMany({
        include: {
          campaign: true,
          product: true,
          submissions: true,
          participant: {
            include: {
              user: true
            }
          }
        }
      }),
      prisma.payout.findMany({
        include: {
          assignment: {
            include: {
              campaign: true,
              product: true,
              submissions: true,
              participant: {
                include: {
                  user: true
                }
              }
            }
          },
          payoutBatch: true,
          participant: {
            include: {
              user: true
            }
          }
        }
      })
    ]);

    const sourceRecords = [
      ...assignments.map((assignment) => ({
        payout: null,
        assignment,
        participant: assignment.participant,
        user: assignment.participant.user,
        campaign: assignment.campaign,
        product: assignment.product,
        payoutBatch: null,
        submissions: assignment.submissions
      })),
      ...payouts.map((payout) => ({
        payout,
        assignment: payout.assignment,
        participant: payout.participant,
        user: payout.participant.user,
        campaign: payout.assignment.campaign,
        product: payout.assignment.product,
        payoutBatch: payout.payoutBatch,
        submissions: payout.assignment.submissions
      }))
    ];

    return findPayoutOpportunityDetail(sourceRecords, id);
  } catch {
    if (!isLiveFallbackEnabled()) {
      handleDataAccessFailure(new Error(getDatabaseUnavailableMessage()));
    }

    return getLiveAssignmentOpportunityDetail(id);
  }
}

export async function getParticipantListingData(filters: ParticipantListingFilters = {}) {
  const page = parsePage(filters.page);
  const pageSize = parsePageSize(filters.pageSize);

  try {
    const [totalItems, rows] = await Promise.all([
      prisma.participantProfile.count(),
      prisma.participantProfile.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        include: {
          user: true,
          _count: {
            select: {
              assignments: true,
              payouts: true
            }
          }
        }
      })
    ]);

    return {
      rows: rows.map((row) => ({
        id: row.id,
        name: row.user.name || row.displayName,
        marketplace: row.marketplace || "unknown",
        status: row.verificationStatus,
        score: row.score,
        assignments: row._count.assignments,
        payouts: row._count.payouts
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  } catch {
    if (!isLiveFallbackEnabled()) {
      handleDataAccessFailure(new Error(getDatabaseUnavailableMessage()));
    }

    const normalized = (await listParticipantsLive()).map((row: any) => ({
      id: row.id,
      name: row.user?.name || row.displayName,
      marketplace: row.marketplace || "unknown",
      status: row.verificationStatus,
      score: row.score,
      assignments: row.assignments?.length ?? 0,
      payouts: row.payouts?.length ?? 0
    }));
    const paged = paginateRows(normalized, page, pageSize);

    return {
      rows: paged.rows,
      pagination: paged.pagination
    };
  }
}
