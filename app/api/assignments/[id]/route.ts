import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asNullableString, asString, jsonError, parseBody } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER", "PARTICIPANT"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      participant: {
        include: {
          user: true
        }
      },
      product: true,
      campaign: true,
      submissions: true,
      payouts: true
    }
  });

  if (!assignment) {
    return jsonError("Assignment not found.", 404);
  }

  return NextResponse.json({ data: assignment });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const body = await parseBody(request);

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      status: (asString(body.status)?.toUpperCase() as never) ?? undefined,
      baseRewardAmount: asNullableString(body.baseRewardAmount),
      bonusRewardAmount: asNullableString(body.bonusRewardAmount),
      rewardCurrency: asString(body.rewardCurrency),
      acceptedAt: body.acceptedAt ? new Date(String(body.acceptedAt)) : undefined,
      dueAt: body.dueAt ? new Date(String(body.dueAt)) : undefined,
      submittedAt: body.submittedAt ? new Date(String(body.submittedAt)) : undefined,
      approvedAt: body.approvedAt ? new Date(String(body.approvedAt)) : undefined,
      sourceLabel: asNullableString(body.sourceLabel),
      clientBillingLabel: asNullableString(body.clientBillingLabel),
      purchaseSubtotal: asNullableString(body.purchaseSubtotal),
      taxAdjustmentAmount: asNullableString(body.taxAdjustmentAmount),
      miscAdjustmentAmount: asNullableString(body.miscAdjustmentAmount),
      internalNotes: asNullableString(body.internalNotes),
      deliverableSnapshot: body.deliverableSnapshot
    }
  });

  return NextResponse.json({ data: assignment });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      status: "CANCELED"
    }
  });

  return NextResponse.json({ data: assignment, message: "Assignment canceled." });
}
