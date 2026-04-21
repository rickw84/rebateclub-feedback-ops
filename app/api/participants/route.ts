import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asNullableString, asString, jsonError, parseBody } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDefaultOrganizationId } from "@/lib/system-user";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const verificationStatus = request.nextUrl.searchParams.get("verificationStatus") ?? undefined;
  const profiles = await prisma.participantProfile.findMany({
    where: verificationStatus ? { verificationStatus: verificationStatus as never } : undefined,
    include: {
      user: true,
      _count: {
        select: {
          assignments: true,
          payouts: true
        }
      }
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }]
  });

  return NextResponse.json({ data: profiles });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await parseBody(request);
  const email = asString(body.email)?.toLowerCase();
  const name = asString(body.name);

  if (!email || !name) {
    return jsonError("Participant name and email are required.");
  }

  const organizationId = asString(body.organizationId) ?? (await getDefaultOrganizationId());
  if (!organizationId) {
    return jsonError("Organization is required.", 400, "Create or import an organization before creating participants.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId,
        role: "PARTICIPANT",
        name,
        email,
        isActive: true
      }
    });

    const profile = await tx.participantProfile.create({
      data: {
        userId: user.id,
        displayName: asString(body.displayName) ?? name,
        paypalEmail: asNullableString(body.paypalEmail),
        country: asNullableString(body.country),
        marketplace: asNullableString(body.marketplace),
        bio: asNullableString(body.bio),
        amazonProfileUrl: asNullableString(body.amazonProfileUrl),
        verificationStatus: (asString(body.verificationStatus)?.toUpperCase() as never) ?? "NEW",
        riskLevel: (asString(body.riskLevel)?.toUpperCase() as never) ?? "MEDIUM",
        niches: Array.isArray(body.niches)
          ? body.niches.filter((item: unknown): item is string => typeof item === "string")
          : []
      }
    });

    return { user, profile };
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
