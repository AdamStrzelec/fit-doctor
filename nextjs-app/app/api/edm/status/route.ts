// app/api/admin/edm/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // If you tie EdmAuth to userId via session, read session and filter by userId.
    // For simplicity, this endpoint returns the latest non-revoked record.
    const rec = await prisma.edmAuth.findFirst({
      where: { revoked: false },
      orderBy: { lastRefreshedAt: "desc" },
    });

    if (!rec) {
      return NextResponse.json({ loggedIn: false });
    }

    return NextResponse.json({
      loggedIn: true,
      id: rec.id,
      lastRefreshedAt: rec.lastRefreshedAt,
      nextRefreshAt: rec.nextRefreshAt,
      accessTokenExpiresAt: rec.accessTokenExpiresAt,
    });
  } catch (err: any) {
    console.error("status error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}