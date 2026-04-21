import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asNullableString, asNumber, asString, jsonError, parseBody } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSystemUser, getDefaultOrganizationId } from "@/lib/system-user";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const campaigns = await prisma.campaign.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      _count: {
        select: {
          applications: true,
          assignments: true,
          products: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return NextResponse.json({ data: campaigns });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await parseBody(request);
  const name = asString(body.name);
  if (!name) {
    return jsonError("Campaign name is required.");
  }

  const organizationId = asString(body.organizationId) ?? (await getDefaultOrganizationId());
  if (!organizationId) {
    return jsonError("Organization is required.", 400, "Create or import an organization before creating campaigns.");
  }

  const createdById = asString(body.createdById) ?? (await ensureSystemUser(organizationId)).id;
  const deliverables = body.deliverables ?? { checklist: [], source: "manual-create" };

  const campaign = await prisma.campaign.create({
    data: {
      organizationId,
      createdById,
      name,
      clientName: asNullableString(body.clientName),
      description: asNullableString(body.description),
      status: (asString(body.status)?.toUpperCase() as never) ?? "DRAFT",
      participantLimit: asNumber(body.participantLimit) ?? null,
      rewardAmount: asNullableString(body.rewardAmount),
      rewardCurrency: asString(body.rewardCurrency) ?? "USD",
      deliverables,
      eligibilityRules: body.eligibilityRules ?? null,
      startDate: body.startDate ? new Date(String(body.startDate)) : null,
      endDate: body.endDate ? new Date(String(body.endDate)) : null
    }
  });

  return NextResponse.json({ data: campaign }, { status: 201 });
}
