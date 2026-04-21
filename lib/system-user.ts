import { prisma } from "@/lib/db";

export async function getDefaultOrganizationId() {
  const org = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });

  return org?.id ?? null;
}

export async function ensureSystemUser(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const email = `ops-admin+${organization.slug}@feedback-ops.local`;

  return prisma.user.upsert({
    where: { email },
    update: {
      role: "OWNER",
      isActive: true,
      organizationId
    },
    create: {
      organizationId,
      role: "OWNER",
      name: `${organization.name} Ops`,
      email,
      isActive: true
    }
  });
}
