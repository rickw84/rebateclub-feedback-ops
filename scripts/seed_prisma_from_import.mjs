import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const DEFAULT_INPUT = path.resolve(
  "C:/Users/ricw5/Documents/Codex/2026-04-20-i-want-to-create-a-project/outputs/payment-tracker-import.json",
);
const DEFAULT_BATCH_SIZE = 200;

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") {
      args.input = path.resolve(argv[index + 1]);
      index += 1;
    } else if (token === "--batch-size") {
      args.batchSize = Number(argv[index + 1] || DEFAULT_BATCH_SIZE);
      index += 1;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/seed_prisma_from_import.mjs [--input path/to/payment-tracker-import.json] [--batch-size 200]

Environment:
  DATABASE_URL must point to the Postgres database used by Prisma.

Notes:
  Run prisma generate first so @prisma/client matches prisma/schema.prisma.
  The seeder uses createMany with skipDuplicates enabled, so it is safe to rerun.
`);
}

function chunk(list, size) {
  const output = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

function toDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function transformOrganizations(records) {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    slug: record.slug,
  }));
}

function transformUsers(records) {
  return records.map((record) => ({
    id: record.id,
    organizationId: record.organizationId,
    role: record.role,
    name: record.name,
    email: record.email,
    passwordHash: record.passwordHash ?? null,
    isActive: record.isActive ?? true,
  }));
}

function buildSystemUsers(organizations) {
  return organizations.map((organization) => ({
    id: `sys_${organization.id}`,
    organizationId: organization.id,
    role: "OWNER",
    name: `${organization.name} Ops`,
    email: `ops-admin+${organization.slug}@feedback-ops.local`,
    passwordHash: null,
    isActive: true
  }));
}

function transformParticipantProfiles(records) {
  return records.map((record) => ({
    id: record.id,
    userId: record.userId,
    displayName: record.displayName,
    paypalEmail: record.paypalEmail ?? null,
    country: record.country ?? null,
    marketplace: record.marketplace ?? null,
    niches: Array.isArray(record.niches) ? record.niches : [],
    bio: record.bio ?? null,
    avatarUrl: record.avatarUrl ?? null,
    amazonProfileUrl: record.amazonProfileUrl ?? null,
    verificationScreenshotUrl: record.verificationScreenshotUrl ?? null,
    verificationStatus: record.verificationStatus,
    riskLevel: record.riskLevel,
    score: record.score ?? 70,
    totalAssignments: record.totalAssignments ?? 0,
    completedAssignments: record.completedAssignments ?? 0,
    approvedAssignments: record.approvedAssignments ?? 0,
    onTimeAssignments: record.onTimeAssignments ?? 0,
    noShowCount: record.noShowCount ?? 0,
    disputeCount: record.disputeCount ?? 0,
    notes: record.notes ?? null,
    lastVerifiedAt: toDate(record.lastVerifiedAt),
  }));
}

function transformCampaigns(records) {
  return records.map((record) => ({
    id: record.id,
    organizationId: record.organizationId,
    createdById: record.createdById ?? `sys_${record.organizationId}`,
    name: record.name,
    clientName: record.clientName ?? null,
    description: record.description ?? null,
    status: record.status,
    participantLimit: record.participantLimit ?? null,
    rewardAmount: record.rewardAmount ?? null,
    rewardCurrency: record.rewardCurrency ?? "USD",
    deliverables: record.deliverables ?? null,
    eligibilityRules: record.eligibilityRules ?? null,
    startDate: toDate(record.startDate),
    endDate: toDate(record.endDate),
  }));
}

function transformProducts(records) {
  return records.map((record) => ({
    id: record.id,
    organizationId: record.organizationId,
    brandName: record.brandName ?? null,
    asin: record.asin,
    title: record.title,
    amazonUrl: record.amazonUrl ?? null,
    marketplace: record.marketplace,
    imageUrl: record.imageUrl ?? null,
    category: record.category ?? null,
    isActive: record.isActive ?? true,
  }));
}

function transformCampaignProducts(records) {
  return records.map((record) => ({
    id: record.id,
    campaignId: record.campaignId,
    productId: record.productId,
    basketCode: record.basketCode ?? null,
    quantityTarget: record.quantityTarget ?? null,
    assignmentLimit: record.assignmentLimit ?? null,
  }));
}

function transformApplications(records) {
  return records.map((record) => ({
    id: record.id,
    campaignId: record.campaignId,
    productId: record.productId,
    participantId: record.participantId,
    status: record.status,
    selectionNotes: record.selectionNotes ?? null,
    adminNotes: record.adminNotes ?? null,
    appliedAt: toDate(record.appliedAt),
    decisionAt: toDate(record.decisionAt),
    decidedById: record.decidedById ?? null,
  }));
}

function transformAssignments(records) {
  return records.map((record) => ({
    id: record.id,
    campaignId: record.campaignId,
    productId: record.productId,
    participantId: record.participantId,
    applicationId: record.applicationId ?? null,
    assignedById: record.assignedById ?? null,
    status: record.status,
    baseRewardAmount: record.baseRewardAmount ?? null,
    bonusRewardAmount: record.bonusRewardAmount ?? null,
    rewardCurrency: record.rewardCurrency ?? "USD",
    assignedAt: toDate(record.assignedAt),
    acceptedAt: toDate(record.acceptedAt),
    dueAt: toDate(record.dueAt),
    submittedAt: toDate(record.submittedAt),
    approvedAt: toDate(record.approvedAt),
    lastFollowUpAt: toDate(record.lastFollowUpAt),
    followUpCount: record.followUpCount ?? 0,
    sourceLabel: record.sourceLabel ?? null,
    clientBillingLabel: record.clientBillingLabel ?? null,
    purchaseSubtotal: record.purchaseSubtotal ?? null,
    taxAdjustmentAmount: record.taxAdjustmentAmount ?? null,
    miscAdjustmentAmount: record.miscAdjustmentAmount ?? null,
    internalNotes: record.internalNotes ?? null,
    deliverableSnapshot: record.deliverableSnapshot ?? null,
  }));
}

function transformSubmissions(records) {
  return records.map((record) => ({
    id: record.id,
    assignmentId: record.assignmentId,
    submittedById: record.submittedById,
    version: record.version ?? 1,
    questionnaireData: record.questionnaireData ?? null,
    attachmentUrls: record.attachmentUrls ?? null,
    externalLinks: record.externalLinks ?? null,
    adminNotes: record.adminNotes ?? null,
    decision: record.decision,
    reviewedAt: toDate(record.reviewedAt),
    reviewedById: record.reviewedById ?? null,
    submittedAt: toDate(record.submittedAt),
  }));
}

function transformPayoutBatches(records) {
  return records.map((record) => ({
    id: record.id,
    campaignId: record.campaignId ?? null,
    participantId: record.participantId,
    createdById: record.createdById ?? null,
    batchType: record.batchType,
    provider: record.provider ?? "PAYPAL",
    providerBatchId: record.providerBatchId ?? null,
    recipientEmail: record.recipientEmail ?? null,
    sourceLabel: record.sourceLabel ?? null,
    fullPaymentDate: toDate(record.fullPaymentDate),
    totalAmount: record.totalAmount,
    totalFeeAmount: record.totalFeeAmount ?? null,
    proofImageUrl: record.proofImageUrl ?? null,
    notes: record.notes ?? null,
  }));
}

function transformPayouts(records) {
  return records.map((record) => ({
    id: record.id,
    payoutBatchId: record.payoutBatchId ?? null,
    assignmentId: record.assignmentId,
    participantId: record.participantId,
    createdById: record.createdById ?? null,
    status: record.status,
    payoutType: record.payoutType,
    amount: record.amount,
    feeAmount: record.feeAmount ?? null,
    currency: record.currency ?? "USD",
    recipientEmail: record.recipientEmail ?? null,
    provider: record.provider ?? "PAYPAL",
    providerBatchId: record.providerBatchId ?? null,
    providerItemId: record.providerItemId ?? null,
    providerReference: record.providerReference ?? null,
    proofImageUrl: record.proofImageUrl ?? null,
    failureReason: record.failureReason ?? null,
    scheduledAt: toDate(record.scheduledAt),
    sentAt: toDate(record.sentAt),
    settledAt: toDate(record.settledAt),
  }));
}

async function createManyInChunks(prisma, label, delegate, records, batchSize) {
  if (!records.length) {
    console.log(`${label}: 0`);
    return 0;
  }

  let inserted = 0;
  for (const part of chunk(records, batchSize)) {
    const result = await delegate.createMany({
      data: part,
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  console.log(`${label}: ${inserted}/${records.length}`);
  return inserted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!Number.isInteger(args.batchSize) || args.batchSize <= 0) {
    throw new Error("--batch-size must be a positive integer.");
  }

  const payload = JSON.parse(await fs.readFile(args.input, "utf8"));
  const prisma = new PrismaClient();
  const organizations = transformOrganizations(payload.organizations ?? []);
  const users = [...buildSystemUsers(organizations), ...transformUsers(payload.users ?? [])];

  try {
    await prisma.$connect();

    await createManyInChunks(
      prisma,
      "organizations",
      prisma.organization,
      organizations,
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "users",
      prisma.user,
      users,
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "participantProfiles",
      prisma.participantProfile,
      transformParticipantProfiles(payload.participantProfiles ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "campaigns",
      prisma.campaign,
      transformCampaigns(payload.campaigns ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "products",
      prisma.product,
      transformProducts(payload.products ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "campaignProducts",
      prisma.campaignProduct,
      transformCampaignProducts(payload.campaignProducts ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "applications",
      prisma.application,
      transformApplications(payload.applications ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "assignments",
      prisma.assignment,
      transformAssignments(payload.assignments ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "submissions",
      prisma.submission,
      transformSubmissions(payload.submissions ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "payoutBatches",
      prisma.payoutBatch,
      transformPayoutBatches(payload.payoutBatches ?? []),
      args.batchSize,
    );

    await createManyInChunks(
      prisma,
      "payouts",
      prisma.payout,
      transformPayouts(payload.payouts ?? []),
      args.batchSize,
    );

    console.log("Seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
