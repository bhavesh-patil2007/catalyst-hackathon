import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.authenticated) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({
      authenticated: true,
      role: session.role,
      profileId: session.profileId,
      memberName: session.memberName,
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
