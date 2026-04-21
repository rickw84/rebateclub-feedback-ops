"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createAssignmentLive,
  createAssignmentSetLive,
  createCampaignLive,
  createParticipantLive,
  createPayoutLive
} from "@/lib/live-store";
import {
  AssignmentSetActionState,
  inferMarketplaceFromUrl,
  initialAssignmentSetActionState,
  isMeaningfulLineItem,
  mapOpportunityStatusToAssignmentStatus,
  normalizeLineItem,
  parseAmazonAsin,
  slugify
} from "@/lib/assignment-set";
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

  if (!participantName || !participantEmail || !newsletterCampaign) {
    return {
      status: "error",
      message: "Name, email, and newsletter campaign are required."
    };
  }

  let lineItems: ReturnType<typeof normalizeLineItem>[];
  try {
    const parsed = JSON.parse(rawLineItems ?? "[]") as Array<Record<string, string>>;
    lineItems = parsed.map((item) => normalizeLineItem(item)).filter(isMeaningfulLineItem);
  } catch {
    return {
      status: "error",
      message: "The product rows could not be parsed."
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
    lineItems
  };

  try {
    await withFallback(
      async () => {
        const organizationId = await getDefaultOrganizationId();
        if (!organizationId) {
          throw new Error("No organization found.");
        }

        await prisma.$transaction(async (tx) => {
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
                requestDate: payload.requestDate ?? null
              },
              startDate: payload.requestDate ? new Date(payload.requestDate) : null
            }
          });

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
                bonusRewardAmount: lineItem.commission === "0.00" ? null : lineItem.commission,
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
                purchaseSubtotal: lineItem.totalProductCost,
                deliverableSnapshot: {
                  source: "assignment-set-form",
                  legacyRequestDate: payload.requestDate ?? null,
                  productLink: lineItem.productLink || null,
                  ppFee: lineItem.ppFee,
                  totalCostWithFee: lineItem.totalCostWithFee,
                  commissionPaymentDate: payload.commissionPaymentDate ?? null,
                  reviewProductLink: lineItem.reviewProductLink || null
                }
              }
            });

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

            if (Number(lineItem.totalProductCost) > 0 || Number(lineItem.ppFee) > 0) {
              await tx.payout.create({
                data: {
                  assignmentId: assignment.id,
                  participantId: participant.id,
                  createdById: systemUser.id,
                  status: payload.opportunityStatus as never,
                  payoutType: "base_reimbursement",
                  amount: lineItem.totalProductCost,
                  feeAmount: lineItem.ppFee,
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

            if (Number(lineItem.commission) > 0) {
              await tx.payout.create({
                data: {
                  assignmentId: assignment.id,
                  participantId: participant.id,
                  createdById: systemUser.id,
                  status: payload.opportunityStatus as never,
                  payoutType: "bonus_commission",
                  amount: lineItem.commission,
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
          }
        });
      },
      async () => {
        await createAssignmentSetLive(payload);
      }
    );

    revalidateAdminPaths();

    return {
      status: "success",
      message: `${payload.lineItems.length} product assignment${payload.lineItems.length === 1 ? "" : "s"} added.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create the assignment set."
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
