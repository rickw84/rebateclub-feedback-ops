import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asNullableString, asNumber, asString, jsonError, parseBody } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: true
        }
      },
      _count: {
        select: {
          applications: true,
          assignments: true
        }
      }
    }
  });

  if (!campaign) {
    return jsonError("Campaign not found.", 404);
  }

  return NextResponse.json({ data: campaign });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const body = await parseBody(request);

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      name: asString(body.name),
      clientName: asNullableString(body.clientName),
      description: asNullableString(body.description),
      status: (asString(body.status)?.toUpperCase() as never) ?? undefined,
      participantLimit: asNumber(body.participantLimit),
      rewardAmount: asNullableString(body.rewardAmount),
      rewardCurrency: asString(body.rewardCurrency),
      deliverables: body.deliverables,
      eligibilityRules: body.eligibilityRules,
      startDate: body.startDate ? new Date(String(body.startDate)) : undefined,
      endDate: body.endDate ? new Date(String(body.endDate)) : undefined
    }
  });

  return NextResponse.json({ data: campaign });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      status: "ARCHIVED"
    }
  });

  return NextResponse.json({ data: campaign, message: "Campaign archived." });
}
