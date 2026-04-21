import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "feedback_ops_session";

export const APP_ROLES = ["OWNER", "ADMIN", "MANAGER", "PARTICIPANT"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AppSession = {
  role: AppRole;
  name: string;
  landingPath: string;
};

const roleDefaults: Record<AppRole, Omit<AppSession, "role">> = {
  OWNER: { name: "Owner", landingPath: "/admin" },
  ADMIN: { name: "Admin", landingPath: "/admin" },
  MANAGER: { name: "Manager", landingPath: "/admin" },
  PARTICIPANT: { name: "Participant", landingPath: "/portal" }
};

function isRole(value: string | null | undefined): value is AppRole {
  return APP_ROLES.includes((value ?? "").toUpperCase() as AppRole);
}

export function buildSession(role: AppRole, name?: string): AppSession {
  return {
    role,
    name: name?.trim() || roleDefaults[role].name,
    landingPath: roleDefaults[role].landingPath
  };
}

function safeParseSession(value: string | undefined): AppSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AppSession>;
    if (!isRole(parsed.role)) {
      return null;
    }

    return buildSession(parsed.role, parsed.name);
  } catch {
    return null;
  }
}

export function readRequestSession(request: NextRequest): AppSession | null {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionFromCookie = safeParseSession(cookieValue);
  if (sessionFromCookie) {
    return sessionFromCookie;
  }

  const headerRole = request.headers.get("x-demo-role");
  const headerName = request.headers.get("x-demo-name") ?? undefined;
  if (isRole(headerRole)) {
    return buildSession(headerRole, headerName);
  }

  return null;
}

export async function getServerSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  return safeParseSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function requireRole(request: NextRequest, allowedRoles: AppRole[]) {
  const session = readRequestSession(request);

  if (!session) {
    return NextResponse.json(
      {
        error: "Authentication required.",
        detail: "Open /login to start a demo session."
      },
      { status: 401 }
    );
  }

  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json(
      {
        error: "Forbidden.",
        detail: `Required role: ${allowedRoles.join(", ")}. Current role: ${session.role}.`
      },
      { status: 403 }
    );
  }

  return session;
}

export function sessionCookieValue(session: AppSession) {
  return JSON.stringify(session);
}
