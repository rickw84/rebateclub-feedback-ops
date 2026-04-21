import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asNullableString, asString, jsonError, parseBody } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
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
          product: true,
          campaign: true
        }
      }
    }
  });

  if (!payout) {
    return jsonError("Payout not found.", 404);
  }

  return NextResponse.json({ data: payout });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const body = await parseBody(request);

  const payout = await prisma.payout.update({
    where: { id },
    data: {
      payoutBatchId: asNullableString(body.payoutBatchId),
      status: (asString(body.status)?.toUpperCase() as never) ?? undefined,
      payoutType: asString(body.payoutType),
      amount: asString(body.amount),
      feeAmount: asNullableString(body.feeAmount),
      currency: asString(body.currency),
      recipientEmail: asNullableString(body.recipientEmail),
      provider: asString(body.provider),
      providerBatchId: asNullableString(body.providerBatchId),
      providerItemId: asNullableString(body.providerItemId),
      providerReference: asNullableString(body.providerReference),
      proofImageUrl: asNullableString(body.proofImageUrl),
      failureReason: asNullableString(body.failureReason),
      scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined,
      sentAt: body.sentAt ? new Date(String(body.sentAt)) : undefined,
      settledAt: body.settledAt ? new Date(String(body.settledAt)) : undefined
    }
  });

  return NextResponse.json({ data: payout });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const payout = await prisma.payout.update({
    where: { id },
    data: {
      status: "CANCELED"
    }
  });

  return NextResponse.json({ data: payout, message: "Payout canceled." });
}
