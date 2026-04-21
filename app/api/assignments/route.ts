import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asNullableString, asString, jsonError, parseBody } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER", "PARTICIPANT"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const assignments = await prisma.assignment.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      participant: {
        include: {
          user: true
        }
      },
      product: true,
      campaign: true
    },
    orderBy: [{ assignedAt: "desc" }]
  });

  return NextResponse.json({ data: assignments });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await parseBody(request);
  const campaignId = asString(body.campaignId);
  const productId = asString(body.productId);
  const participantId = asString(body.participantId);

  if (!campaignId || !productId || !participantId) {
    return jsonError("campaignId, productId, and participantId are required.");
  }

  const assignment = await prisma.assignment.create({
    data: {
      campaignId,
      productId,
      participantId,
      applicationId: asNullableString(body.applicationId),
      assignedById: asNullableString(body.assignedById),
      status: (asString(body.status)?.toUpperCase() as never) ?? "ASSIGNED",
      baseRewardAmount: asNullableString(body.baseRewardAmount),
      bonusRewardAmount: asNullableString(body.bonusRewardAmount),
      rewardCurrency: asString(body.rewardCurrency) ?? "USD",
      assignedAt: body.assignedAt ? new Date(String(body.assignedAt)) : new Date(),
      acceptedAt: body.acceptedAt ? new Date(String(body.acceptedAt)) : null,
      dueAt: body.dueAt ? new Date(String(body.dueAt)) : null,
      sourceLabel: asNullableString(body.sourceLabel),
      clientBillingLabel: asNullableString(body.clientBillingLabel),
      purchaseSubtotal: asNullableString(body.purchaseSubtotal),
      taxAdjustmentAmount: asNullableString(body.taxAdjustmentAmount),
      miscAdjustmentAmount: asNullableString(body.miscAdjustmentAmount),
      internalNotes: asNullableString(body.internalNotes),
      deliverableSnapshot: body.deliverableSnapshot ?? { checklist: [], source: "manual-create" }
    }
  });

  return NextResponse.json({ data: assignment }, { status: 201 });
}
