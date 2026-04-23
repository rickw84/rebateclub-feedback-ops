"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createAssignmentLive,
  createAssignmentSetLive,
  createCampaignLive,
  createParticipantLive,
  createPayoutLive,
  updateAssignmentOpportunitySummaryLive
} from "@/lib/live-store";
import {
  AssignmentSetActionState,
  inferMarketplaceFromUrl,
  initialAssignmentSetActionState,
  isMeaningfulLineItem,
  mapOpportunityStatusToAssignmentStatus,
  normalizeLineItem,
  normalizeMoneyInput,
  normalizePayments,
  parseAmazonAsin,
  slugify
} from "@/lib/assignment-set";
import { buildOpportunityGroupId } from "@/lib/payout-opportunities";
import { getDatabaseUnavailableMessage, isLiveFallbackEnabled } from "@/lib/runtime-config";
import { ensureSystemUser, getDefaultOrganizationId } from "@/lib/system-user";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>) {
  try {
    return await primary();
  } catch (error) {
    if (!isLiveFallbackEnabled()) {
      throw new Error(getDatabaseUnavailableMessage(), { cause: error });
    }

    return fallback();
  }
}

function revalidateAdminPaths() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/participants");
  revalidatePath("/admin/payouts");
}

function productAsinSeed(value: string) {
  return `MAN${slugify(value).replace(/-/g, "").toUpperCase().slice(0, 7)}`.padEnd(10, "0");
}

export async function createCampaignAction(formData: FormData) {
  const name = value(formData, "name");
  if (!name) {
    return;
  }

  const payload = {
    name,
    clientName: value(formData, "clientName"),
    description: value(formData, "description"),
    status: value(formData, "status") ?? "DRAFT",
    rewardAmount: value(formData, "rewardAmount"),
    rewardCurrency: "USD",
    deliverables: {
      checklist: [
        "Complete assigned task",
        "Submit proof or structured feedback",
        "Wait for manager approval"
      ],
      source: "admin-form"
    }
  };

  await withFallback(
    async () => {
      const organizationId = await getDefaultOrganizationId();
      if (!organizationId) {
        throw new Error("No organization found.");
      }
      const systemUser = await ensureSystemUser(organizationId);
      await prisma.campaign.create({
        data: {
          organizationId,
          createdById: systemUser.id,
          name: payload.name,
          clientName: payload.clientName ?? null,
          description: payload.description ?? null,
          status: payload.status as never,
          rewardAmount: payload.rewardAmount ?? null,
          rewardCurrency: payload.rewardCurrency,
          deliverables: payload.deliverables
        }
      });
    },
    async () => {
      await createCampaignLive(payload);
    }
  );

  revalidateAdminPaths();
}

export async function createParticipantAction(formData: FormData) {
  const name = value(formData, "name");
  const email = value(formData, "email");
  if (!name || !email) {
    return;
  }

  const payload = {
    name,
    email,
    displayName: value(formData, "displayName") ?? name,
    paypalEmail: value(formData, "paypalEmail"),
    marketplace: value(formData, "marketplace") ?? "amazon.com",
    verificationStatus: value(formData, "verificationStatus") ?? "NEW",
    riskLevel: "MEDIUM"
  };

  await withFallback(
    async () => {
      const organizationId = await getDefaultOrganizationId();
      if (!organizationId) {
        throw new Error("No organization found.");
      }

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            organizationId,
            role: "PARTICIPANT",
            name: payload.name,
            email: payload.email.toLowerCase(),
            isActive: true
          }
        });

        await tx.participantProfile.create({
          data: {
            userId: user.id,
            displayName: payload.displayName,
            paypalEmail: payload.paypalEmail ?? null,
            marketplace: payload.marketplace,
            verificationStatus: payload.verificationStatus as never,
            riskLevel: payload.riskLevel as never,
            niches: []
          }
        });
      });
    },
    async () => {
      await createParticipantLive(payload);
    }
  );

  revalidateAdminPaths();
}

export async function createAssignmentAction(formData: FormData) {
  const campaignId = value(formData, "campaignId");
  const participantId = value(formData, "participantId");
  const productId = value(formData, "productId");
  if (!campaignId || !participantId || !productId) {
    return;
  }

  const payload = {
    campaignId,
    participantId,
    productId,
    status: value(formData, "status") ?? "ASSIGNED",
    baseRewardAmount: value(formData, "baseRewardAmount") ?? "0.00",
    purchaseSubtotal: value(formData, "purchaseSubtotal") ?? value(formData, "baseRewardAmount") ?? "0.00",
    sourceLabel: value(formData, "sourceLabel"),
    internalNotes: value(formData, "internalNotes"),
    deliverableSnapshot: {
      checklist: ["Complete task", "Upload deliverable", "Wait for approval"],
      source: "admin-form"
    }
  };

  await withFallback(
    async () => {
      await prisma.assignment.create({
        data: {
          campaignId: payload.campaignId,
          participantId: payload.participantId,
          productId: payload.productId,
          status: payload.status as never,
          baseRewardAmount: payload.baseRewardAmount,
          purchaseSubtotal: payload.purchaseSubtotal,
          sourceLabel: payload.sourceLabel ?? null,
          internalNotes: payload.internalNotes ?? null,
          deliverableSnapshot: payload.deliverableSnapshot
        }
      });
    },
    async () => {
      await createAssignmentLive(payload);
    }
  );

  revalidateAdminPaths();
}

export async function createAssignmentSetAction(
  _prevState: AssignmentSetActionState = initialAssignmentSetActionState,
  formData: FormData
): Promise<AssignmentSetActionState> {
  const participantName = value(formData, "participantName");
  const participantEmail = value(formData, "participantEmail");
  const newsletterCampaign = value(formData, "newsletterCampaign");
  const opportunityStatus = (value(formData, "opportunityStatus") ?? "DRAFT").toUpperCase();
  const requestDate = value(formData, "requestDate");
  const fullPaymentDate = value(formData, "fullPaymentDate");
  const commissionPaymentDate = value(formData, "commissionPaymentDate");
  const paypalEmail = value(formData, "paypalEmail") ?? participantEmail;
  const rawLineItems = value(formData, "lineItems");
  const rawPayments = value(formData, "payments");

  if (!participantName || !participantEmail || !newsletterCampaign) {
    return {
      status: "error",
      message: "Name, email, and newsletter campaign are required."
    };
  }

  let lineItems: ReturnType<typeof normalizeLineItem>[];
  let payments: ReturnType<typeof normalizePayments>;
  try {
    const parsedLineItems = JSON.parse(rawLineItems ?? "[]") as Array<Record<string, string>>;
    lineItems = parsedLineItems.map((item) => normalizeLineItem(item)).filter(isMeaningfulLineItem);
    payments = normalizePayments(JSON.parse(rawPayments ?? "{}") as Record<string, string>);
  } catch {
    return {
      status: "error",
      message: "The assignment form could not be parsed."
    };
  }

  if (!lineItems.length) {
    return {
      status: "error",
      message: "Add at least one product row before saving the assignment."
    };
  }

  const payload = {
    opportunityStatus,
    requestDate,
    fullPaymentDate,
    commissionPaymentDate,
    participantName,
    participantEmail,
    paypalEmail,
    newsletterCampaign,
    lineItems,
    payments
  };

  try {
    let flashAssignmentId = "";

    await withFallback(
      async () => {
        const organizationId = await getDefaultOrganizationId();
        if (!organizationId) {
          throw new Error("No organization found.");
        }

        flashAssignmentId = await prisma.$transaction(async (tx) => {
          let user = await tx.user.findUnique({
            where: {
              email: payload.participantEmail.toLowerCase()
            }
          });

          if (!user) {
            user = await tx.user.create({
              data: {
                organizationId,
                role: "PARTICIPANT",
                name: payload.participantName,
                email: payload.participantEmail.toLowerCase(),
                isActive: true
              }
            });
          } else {
            user = await tx.user.update({
              where: { id: user.id },
              data: {
                name: payload.participantName,
                isActive: true
              }
            });
          }

          let participant = await tx.participantProfile.findUnique({
            where: {
              userId: user.id
            }
          });

          if (!participant) {
            participant = await tx.participantProfile.create({
              data: {
                userId: user.id,
                displayName: payload.participantName,
                paypalEmail: payload.paypalEmail ?? payload.participantEmail,
                marketplace: "amazon.com",
                verificationStatus: "NEW",
                riskLevel: "MEDIUM",
                niches: []
              }
            });
          } else {
            participant = await tx.participantProfile.update({
              where: { id: participant.id },
              data: {
                displayName: payload.participantName,
                paypalEmail: payload.paypalEmail ?? participant.paypalEmail ?? payload.participantEmail
              }
            });
          }

          const systemUser = await ensureSystemUser(organizationId);
          const campaign = await tx.campaign.create({
            data: {
              organizationId,
              createdById: systemUser.id,
              name: payload.newsletterCampaign,
              description: `Assignment set created from the assignments popup for ${payload.participantName}.`,
              status: "ACTIVE",
              rewardCurrency: "USD",
              deliverables: {
                source: "assignment-set-form",
                requestDate: payload.requestDate ?? null,
                payments: payload.payments
              },
              startDate: payload.requestDate ? new Date(payload.requestDate) : null
            }
          });

          let primaryAssignmentId: string | null = null;

          for (const lineItem of payload.lineItems) {
            const marketplace = inferMarketplaceFromUrl(lineItem.productLink);
            const asin =
              parseAmazonAsin(lineItem.productLink) ??
              productAsinSeed(`${lineItem.brand}-${lineItem.productTitle}-${payload.requestDate ?? Date.now()}`);

            let product = await tx.product.findFirst({
              where: {
                organizationId,
                asin,
                marketplace
              }
            });

            if (!product) {
              product = await tx.product.create({
                data: {
                  organizationId,
                  brandName: lineItem.brand || null,
                  asin,
                  title: lineItem.productTitle || "Untitled product",
                  amazonUrl: lineItem.productLink || null,
                  marketplace
                }
              });
            }

            await tx.campaignProduct.upsert({
              where: {
                campaignId_productId: {
                  campaignId: campaign.id,
                  productId: product.id
                }
              },
              update: {},
              create: {
                campaignId: campaign.id,
                productId: product.id
              }
            });

            const assignment = await tx.assignment.create({
              data: {
                campaignId: campaign.id,
                participantId: participant.id,
                productId: product.id,
                assignedById: systemUser.id,
                status: mapOpportunityStatusToAssignmentStatus(payload.opportunityStatus as never) as never,
                baseRewardAmount: lineItem.productCost,
                bonusRewardAmount: null,
                rewardCurrency: "USD",
                assignedAt: payload.requestDate ? new Date(payload.requestDate) : new Date(),
                submittedAt: lineItem.reviewProductLink
                  ? payload.requestDate
                    ? new Date(payload.requestDate)
                    : new Date()
                  : null,
                approvedAt: ["SENT", "PAID"].includes(payload.opportunityStatus)
                  ? payload.fullPaymentDate
                    ? new Date(payload.fullPaymentDate)
                    : new Date()
                  : null,
                sourceLabel: payload.newsletterCampaign,
                purchaseSubtotal: lineItem.productCost,
                deliverableSnapshot: {
                  source: "assignment-set-form",
                  legacyRequestDate: payload.requestDate ?? null,
                  productLink: lineItem.productLink || null,
                  reviewProductLink: lineItem.reviewProductLink || null,
                  payments: payload.payments
                }
              }
            });

            if (!primaryAssignmentId) {
              primaryAssignmentId = assignment.id;
            }

            if (lineItem.reviewProductLink) {
              await tx.submission.create({
                data: {
                  assignmentId: assignment.id,
                  submittedById: participant.id,
                  version: 1,
                  externalLinks: {
                    legacyReviewUrl: lineItem.reviewProductLink
                  },
                  decision: ["SENT", "PAID"].includes(payload.opportunityStatus) ? "APPROVED" : "PENDING",
                  reviewedAt: ["SENT", "PAID"].includes(payload.opportunityStatus) && payload.fullPaymentDate
                    ? new Date(payload.fullPaymentDate)
                    : null,
                  reviewedById: ["SENT", "PAID"].includes(payload.opportunityStatus) ? systemUser.id : null,
                  submittedAt: payload.requestDate ? new Date(payload.requestDate) : new Date()
                }
              });
            }
          }

          if (!primaryAssignmentId) {
            throw new Error("No assignment records were created.");
          }

          if (Number(payload.payments.totalProductCost) > 0 || Number(payload.payments.ppFee) > 0) {
            await tx.payout.create({
              data: {
                assignmentId: primaryAssignmentId,
                participantId: participant.id,
                createdById: systemUser.id,
                status: payload.opportunityStatus as never,
                payoutType: "base_reimbursement",
                amount: payload.payments.totalProductCost,
                feeAmount: payload.payments.ppFee,
                recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                provider: "PAYPAL",
                scheduledAt: payload.fullPaymentDate
                  ? new Date(payload.fullPaymentDate)
                  : payload.requestDate
                    ? new Date(payload.requestDate)
                    : new Date(),
                sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus)
                  ? payload.fullPaymentDate
                    ? new Date(payload.fullPaymentDate)
                    : new Date()
                  : null,
                settledAt: payload.opportunityStatus === "PAID"
                  ? payload.fullPaymentDate
                    ? new Date(payload.fullPaymentDate)
                    : new Date()
                  : null,
                failureReason: payload.opportunityStatus === "FAILED"
                  ? "Marked failed from assignment popup."
                  : null
              }
            });
          }

          if (Number(payload.payments.commission) > 0) {
            await tx.payout.create({
              data: {
                assignmentId: primaryAssignmentId,
                participantId: participant.id,
                createdById: systemUser.id,
                status: payload.opportunityStatus as never,
                payoutType: "bonus_commission",
                amount: payload.payments.commission,
                recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                provider: "PAYPAL",
                scheduledAt: payload.commissionPaymentDate
                  ? new Date(payload.commissionPaymentDate)
                  : payload.fullPaymentDate
                    ? new Date(payload.fullPaymentDate)
                    : payload.requestDate
                      ? new Date(payload.requestDate)
                      : new Date(),
                sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus)
                  ? payload.commissionPaymentDate
                    ? new Date(payload.commissionPaymentDate)
                    : payload.fullPaymentDate
                      ? new Date(payload.fullPaymentDate)
                      : new Date()
                  : null,
                settledAt: payload.opportunityStatus === "PAID"
                  ? payload.commissionPaymentDate
                    ? new Date(payload.commissionPaymentDate)
                    : payload.fullPaymentDate
                      ? new Date(payload.fullPaymentDate)
                      : new Date()
                  : null,
                failureReason: payload.opportunityStatus === "FAILED"
                  ? "Marked failed from assignment popup."
                  : null
              }
            });
          }

          if (Number(payload.payments.commissionMisc) > 0) {
            await tx.payout.create({
              data: {
                assignmentId: primaryAssignmentId,
                participantId: participant.id,
                createdById: systemUser.id,
                status: payload.opportunityStatus as never,
                payoutType: "commission_misc",
                amount: payload.payments.commissionMisc,
                recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                provider: "PAYPAL",
                scheduledAt: payload.commissionPaymentDate
                  ? new Date(payload.commissionPaymentDate)
                  : payload.fullPaymentDate
                    ? new Date(payload.fullPaymentDate)
                    : payload.requestDate
                      ? new Date(payload.requestDate)
                      : new Date(),
                sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus)
                  ? payload.commissionPaymentDate
                    ? new Date(payload.commissionPaymentDate)
                    : payload.fullPaymentDate
                      ? new Date(payload.fullPaymentDate)
                      : new Date()
                  : null,
                settledAt: payload.opportunityStatus === "PAID"
                  ? payload.commissionPaymentDate
                    ? new Date(payload.commissionPaymentDate)
                    : payload.fullPaymentDate
                      ? new Date(payload.fullPaymentDate)
                      : new Date()
                  : null,
                failureReason: payload.opportunityStatus === "FAILED"
                  ? "Marked failed from assignment popup."
                  : null
              }
            });
          }

          return primaryAssignmentId;
        });
      },
      async () => {
        const created = await createAssignmentSetLive(payload);
        flashAssignmentId = created.assignmentId;
      }
    );

    revalidateAdminPaths();

    return {
      status: "success",
      message: `${payload.lineItems.length} product assignment${payload.lineItems.length === 1 ? "" : "s"} added.`,
      flashAssignmentId
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create the assignment set."
    };
  }
}


type AssignmentOpportunitySummaryActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectTo?: string;
};

function parseJsonIdList(raw: string | undefined) {
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  } catch {
    return [] as string[];
  }
}

function payoutDateForStatus(fullPaymentDate: string | undefined, requestDate: string | undefined) {
  if (fullPaymentDate) {
    return new Date(fullPaymentDate);
  }
  if (requestDate) {
    return new Date(requestDate);
  }
  return new Date();
}

function payoutDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null;
}

export async function updateAssignmentOpportunitySummaryAction(
  _prevState: AssignmentOpportunitySummaryActionState = { status: "idle" },
  formData: FormData
): Promise<AssignmentOpportunitySummaryActionState> {
  const participantId = value(formData, "participantId");
  const campaignId = value(formData, "campaignId");
  const requestDate = value(formData, "requestDate");
  const participantName = value(formData, "participantName");
  const participantEmail = value(formData, "participantEmail");
  const paypalEmail = value(formData, "paypalEmail") ?? participantEmail;
  const newsletterCampaign = value(formData, "newsletterCampaign");
  const opportunityStatus = (value(formData, "opportunityStatus") ?? "DRAFT").toUpperCase();
  const fullPaymentDate = value(formData, "fullPaymentDate");
  const assignmentIds = parseJsonIdList(value(formData, "assignmentIds"));
  const payoutIds = parseJsonIdList(value(formData, "payoutIds"));
  const totalProductCost = normalizeMoneyInput(value(formData, "totalProductCost"));
  const totalCostWithFee = normalizeMoneyInput(value(formData, "totalCostWithFee"));
  const commissionTotal = normalizeMoneyInput(value(formData, "commissionTotal"));

  if (!participantId || !campaignId || !requestDate || !participantName || !participantEmail || !newsletterCampaign) {
    return {
      status: "error",
      message: "Request date, name, email, and newsletter campaign are required."
    };
  }

  if (!assignmentIds.length) {
    return {
      status: "error",
      message: "This assignment opportunity is missing its assignment records."
    };
  }

  if (Number(totalCostWithFee) < Number(totalProductCost)) {
    return {
      status: "error",
      message: "Total cost + PP fee must be greater than or equal to total product cost."
    };
  }

  const ppFee = (Number(totalCostWithFee) - Number(totalProductCost)).toFixed(2);
  const redirectTo = `/admin/assignments/${encodeURIComponent(
    buildOpportunityGroupId(participantId, campaignId, newsletterCampaign, requestDate)
  )}`;

  const payload = {
    participantId,
    campaignId,
    assignmentIds,
    payoutIds,
    requestDate,
    participantName,
    participantEmail,
    paypalEmail,
    newsletterCampaign,
    opportunityStatus,
    fullPaymentDate,
    totalProductCost,
    totalCostWithFee,
    ppFee,
    commissionTotal
  };

  try {
    await withFallback(
      async () => {
        const organizationId = await getDefaultOrganizationId();
        const systemUser = organizationId ? await ensureSystemUser(organizationId) : null;

        await prisma.$transaction(async (tx) => {
          const participant = await tx.participantProfile.findUnique({
            where: { id: payload.participantId },
            include: { user: true }
          });

          if (!participant) {
            throw new Error("Participant not found.");
          }

          await tx.user.update({
            where: { id: participant.userId },
            data: {
              name: payload.participantName,
              email: payload.participantEmail.toLowerCase(),
              isActive: true
            }
          });

          await tx.participantProfile.update({
            where: { id: participant.id },
            data: {
              displayName: payload.participantName,
              paypalEmail: payload.paypalEmail ?? payload.participantEmail
            }
          });

          const campaign = await tx.campaign.findUnique({
            where: { id: payload.campaignId }
          });

          if (!campaign) {
            throw new Error("Campaign not found.");
          }

          await tx.campaign.update({
            where: { id: campaign.id },
            data: {
              name: payload.newsletterCampaign,
              description: `Assignment opportunity updated for ${payload.participantName}.`,
              deliverables: {
                ...((campaign.deliverables as Record<string, any> | null) ?? {}),
                requestDate: payload.requestDate,
                payments: {
                  totalProductCost: payload.totalProductCost,
                  ppFee: payload.ppFee,
                  totalCostWithFee: payload.totalCostWithFee,
                  commission: payload.commissionTotal,
                  commissionMisc: "0.00",
                  totalCommission: payload.commissionTotal
                }
              },
              startDate: new Date(payload.requestDate)
            }
          });

          const assignments = await tx.assignment.findMany({
            where: {
              id: {
                in: payload.assignmentIds
              }
            },
            include: {
              submissions: true
            }
          });

          if (!assignments.length) {
            throw new Error("Assignment records not found.");
          }

          for (const assignment of assignments) {
            const snapshot = ((assignment.deliverableSnapshot as Record<string, any> | null) ?? {});
            await tx.assignment.update({
              where: { id: assignment.id },
              data: {
                status: mapOpportunityStatusToAssignmentStatus(payload.opportunityStatus as never) as never,
                assignedAt: new Date(payload.requestDate),
                submittedAt: assignment.submissions.length ? new Date(payload.requestDate) : assignment.submittedAt,
                approvedAt: ["SENT", "PAID"].includes(payload.opportunityStatus)
                  ? payoutDateOrNull(payload.fullPaymentDate)
                  : null,
                sourceLabel: payload.newsletterCampaign,
                deliverableSnapshot: {
                  ...snapshot,
                  legacyRequestDate: payload.requestDate,
                  payments: {
                    totalProductCost: payload.totalProductCost,
                    ppFee: payload.ppFee,
                    totalCostWithFee: payload.totalCostWithFee,
                    commission: payload.commissionTotal,
                    commissionMisc: "0.00",
                    totalCommission: payload.commissionTotal
                  }
                }
              }
            });

            for (const submission of assignment.submissions) {
              await tx.submission.update({
                where: { id: submission.id },
                data: {
                  decision: ["SENT", "PAID"].includes(payload.opportunityStatus) ? "APPROVED" : "PENDING",
                  reviewedAt: ["SENT", "PAID"].includes(payload.opportunityStatus)
                    ? payoutDateOrNull(payload.fullPaymentDate)
                    : null,
                  reviewedById: ["SENT", "PAID"].includes(payload.opportunityStatus) ? systemUser?.id ?? null : null,
                  submittedAt: new Date(payload.requestDate)
                }
              });
            }
          }

          const existingPayouts = payload.payoutIds.length
            ? await tx.payout.findMany({
                where: {
                  id: {
                    in: payload.payoutIds
                  }
                }
              })
            : [];

          const reimbursementPayouts = existingPayouts.filter((payout) => payout.payoutType === "base_reimbursement");
          const commissionPayouts = existingPayouts.filter((payout) =>
            ["bonus_commission", "commission_misc"].includes(String(payout.payoutType ?? ""))
          );
          const basePaymentDate = payoutDateForStatus(payload.fullPaymentDate, payload.requestDate);
          const paymentStatus = payload.opportunityStatus as never;

          if (reimbursementPayouts.length) {
            const [first, ...rest] = reimbursementPayouts;
            await tx.payout.update({
              where: { id: first.id },
              data: {
                status: paymentStatus,
                amount: payload.totalProductCost,
                feeAmount: payload.ppFee,
                recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                scheduledAt: basePaymentDate,
                sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus) ? basePaymentDate : null,
                settledAt: payload.opportunityStatus === "PAID" ? basePaymentDate : null,
                failureReason: payload.opportunityStatus === "FAILED" ? "Updated from assignment detail." : null
              }
            });

            for (const payout of rest) {
              await tx.payout.update({
                where: { id: payout.id },
                data: {
                  status: paymentStatus,
                  amount: "0.00",
                  feeAmount: "0.00",
                  recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                  sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus) ? basePaymentDate : null,
                  settledAt: payload.opportunityStatus === "PAID" ? basePaymentDate : null,
                  failureReason: payload.opportunityStatus === "FAILED" ? "Merged into grouped assignment total." : null
                }
              });
            }
          } else if (Number(payload.totalProductCost) > 0 || Number(payload.ppFee) > 0) {
            await tx.payout.create({
              data: {
                assignmentId: assignments[0].id,
                participantId: payload.participantId,
                createdById: systemUser?.id ?? null,
                status: paymentStatus,
                payoutType: "base_reimbursement",
                amount: payload.totalProductCost,
                feeAmount: payload.ppFee,
                recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                provider: "PAYPAL",
                scheduledAt: basePaymentDate,
                sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus) ? basePaymentDate : null,
                settledAt: payload.opportunityStatus === "PAID" ? basePaymentDate : null,
                failureReason: payload.opportunityStatus === "FAILED" ? "Created from assignment detail." : null
              }
            });
          }

          if (commissionPayouts.length) {
            const [firstCommission, ...restCommission] = commissionPayouts;
            await tx.payout.update({
              where: { id: firstCommission.id },
              data: {
                status: paymentStatus,
                amount: payload.commissionTotal,
                recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus) ? basePaymentDate : null,
                settledAt: payload.opportunityStatus === "PAID" ? basePaymentDate : null,
                failureReason: payload.opportunityStatus === "FAILED" ? "Updated from assignment detail." : null
              }
            });

            for (const payout of restCommission) {
              await tx.payout.update({
                where: { id: payout.id },
                data: {
                  status: paymentStatus,
                  amount: "0.00",
                  recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                  sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus) ? basePaymentDate : null,
                  settledAt: payload.opportunityStatus === "PAID" ? basePaymentDate : null,
                  failureReason: payload.opportunityStatus === "FAILED" ? "Merged into grouped assignment total." : null
                }
              });
            }
          } else if (Number(payload.commissionTotal) > 0) {
            await tx.payout.create({
              data: {
                assignmentId: assignments[0].id,
                participantId: payload.participantId,
                createdById: systemUser?.id ?? null,
                status: paymentStatus,
                payoutType: "bonus_commission",
                amount: payload.commissionTotal,
                recipientEmail: payload.paypalEmail ?? payload.participantEmail,
                provider: "PAYPAL",
                scheduledAt: basePaymentDate,
                sentAt: ["SENT", "PAID"].includes(payload.opportunityStatus) ? basePaymentDate : null,
                settledAt: payload.opportunityStatus === "PAID" ? basePaymentDate : null,
                failureReason: payload.opportunityStatus === "FAILED" ? "Created from assignment detail." : null
              }
            });
          }
        });
      },
      async () => {
        await updateAssignmentOpportunitySummaryLive(payload);
      }
    );

    revalidateAdminPaths();
    revalidatePath(redirectTo);

    return {
      status: "success",
      message: "Assignment summary updated.",
      redirectTo
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update the assignment summary."
    };
  }
}
export async function createPayoutAction(formData: FormData) {
  const assignmentId = value(formData, "assignmentId");
  const participantId = value(formData, "participantId");
  if (!assignmentId || !participantId) {
    return;
  }

  const payload = {
    assignmentId,
    participantId,
    status: value(formData, "status") ?? "DRAFT",
    payoutType: value(formData, "payoutType") ?? "manual_adjustment",
    amount: value(formData, "amount") ?? "0.00",
    recipientEmail: value(formData, "recipientEmail"),
    provider: "PAYPAL",
    scheduledAt: new Date().toISOString()
  };

  await withFallback(
    async () => {
      const assignment = await prisma.assignment.findUnique({
        where: { id: payload.assignmentId }
      });
      if (!assignment) {
        throw new Error("Assignment not found.");
      }

      await prisma.payout.create({
        data: {
          assignmentId: payload.assignmentId,
          participantId: payload.participantId,
          status: payload.status as never,
          payoutType: payload.payoutType,
          amount: payload.amount ?? assignment.baseRewardAmount ?? "0.00",
          recipientEmail: payload.recipientEmail ?? null,
          provider: payload.provider,
          scheduledAt: new Date(payload.scheduledAt)
        }
      });
    },
    async () => {
      await createPayoutLive(payload);
    }
  );

  revalidateAdminPaths();
}








