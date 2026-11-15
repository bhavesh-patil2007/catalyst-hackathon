import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { UserRole } from "@/types";

export interface SessionData {
  authenticated: boolean;
  role: UserRole;
  profileId: string;
  memberName: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET ?? "guardian-oasis-dev-secret-change-in-production-32",
  cookieName: "guardian_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session;
}
