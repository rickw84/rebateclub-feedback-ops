import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asNullableString, asString, jsonError, parseBody } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const payouts = await prisma.payout.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      participant: {
        include: {
          user: true
        }
      },
      assignment: {
        include: {
          product: true
        }
      },
      payoutBatch: true
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return NextResponse.json({ data: payouts });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await parseBody(request);
  const assignmentId = asString(body.assignmentId);

  if (!assignmentId) {
    return jsonError("assignmentId is required.");
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId }
  });

  if (!assignment) {
    return jsonError("Assignment not found.", 404);
  }

  const payout = await prisma.payout.create({
    data: {
      payoutBatchId: asNullableString(body.payoutBatchId),
      assignmentId,
      participantId: asString(body.participantId) ?? assignment.participantId,
      createdById: asNullableString(body.createdById),
      status: (asString(body.status)?.toUpperCase() as never) ?? "DRAFT",
      payoutType: asString(body.payoutType) ?? "manual_adjustment",
      amount: asString(body.amount) ?? assignment.baseRewardAmount ?? "0.00",
      feeAmount: asNullableString(body.feeAmount),
      currency: asString(body.currency) ?? assignment.rewardCurrency,
      recipientEmail: asNullableString(body.recipientEmail),
      provider: asString(body.provider) ?? "PAYPAL",
      providerBatchId: asNullableString(body.providerBatchId),
      providerItemId: asNullableString(body.providerItemId),
      providerReference: asNullableString(body.providerReference),
      proofImageUrl: asNullableString(body.proofImageUrl),
      failureReason: asNullableString(body.failureReason),
      scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
      sentAt: body.sentAt ? new Date(String(body.sentAt)) : null,
      settledAt: body.settledAt ? new Date(String(body.settledAt)) : null
    }
  });

  return NextResponse.json({ data: payout }, { status: 201 });
}
