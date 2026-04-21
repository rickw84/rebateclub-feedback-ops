import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { asString, jsonError, parseBody } from "@/lib/api-utils";
import {
  APP_ROLES,
  SESSION_COOKIE_NAME,
  buildSession,
  getServerSession,
  sessionCookieValue,
  type AppRole
} from "@/lib/auth";

function isRole(value: string | undefined): value is AppRole {
  return APP_ROLES.includes((value ?? "").toUpperCase() as AppRole);
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, session });
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  const role = asString(body.role)?.toUpperCase();
  const name = asString(body.name);

  if (!isRole(role)) {
    return jsonError("Invalid role.", 400, "Use one of OWNER, ADMIN, MANAGER, or PARTICIPANT.");
  }

  const session = buildSession(role, name);
  const response = NextResponse.redirect(new URL(session.landingPath, request.url));

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookieValue(session),
    httpOnly: false,
    sameSite: "lax",
    path: "/"
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    path: "/"
  });
  return response;
}
