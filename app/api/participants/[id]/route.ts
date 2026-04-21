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
  const profile = await prisma.participantProfile.findUnique({
    where: { id },
    include: {
      user: true,
      assignments: {
        take: 10,
        orderBy: { assignedAt: "desc" },
        include: {
          product: true
        }
      },
      payouts: {
        take: 10,
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!profile) {
    return jsonError("Participant not found.", 404);
  }

  return NextResponse.json({ data: profile });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN", "MANAGER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const body = await parseBody(request);
  const existing = await prisma.participantProfile.findUnique({
    where: { id },
    select: { userId: true }
  });

  if (!existing) {
    return jsonError("Participant not found.", 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        name: asString(body.name),
        email: asString(body.email)?.toLowerCase(),
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined
      }
    });

    return tx.participantProfile.update({
      where: { id },
      data: {
        displayName: asString(body.displayName),
        paypalEmail: asNullableString(body.paypalEmail),
        country: asNullableString(body.country),
        marketplace: asNullableString(body.marketplace),
        bio: asNullableString(body.bio),
        amazonProfileUrl: asNullableString(body.amazonProfileUrl),
        verificationStatus: (asString(body.verificationStatus)?.toUpperCase() as never) ?? undefined,
        riskLevel: (asString(body.riskLevel)?.toUpperCase() as never) ?? undefined,
        notes: asNullableString(body.notes)
      },
      include: {
        user: true
      }
    });
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireRole(request, ["OWNER", "ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await params;
  const existing = await prisma.participantProfile.findUnique({
    where: { id },
    select: { userId: true }
  });

  if (!existing) {
    return jsonError("Participant not found.", 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { isActive: false }
    });

    return tx.participantProfile.update({
      where: { id },
      data: {
        verificationStatus: "BLOCKED",
        riskLevel: "HIGH"
      }
    });
  });

  return NextResponse.json({ data: updated, message: "Participant blocked." });
}
