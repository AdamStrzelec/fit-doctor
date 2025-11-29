// app/api/admin/edm/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { encryptToken, hashToken } from "@/lib/edm-crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;
    // verbind userId from session if you want to tie to user:
    // const session = await getServerSession(authOptions); // <- needs your next-auth setup
    // const userId = session?.user?.id;

    if (!username || !password) {
      return NextResponse.json({ error: "username/password required" }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("username", username);
    params.append("password", password);
    params.append("client_id", process.env.EDM_CLIENT_ID ?? "");
    params.append("client_secret", process.env.EDM_CLIENT_SECRET ?? "");

    const r = await fetch(`${process.env.EDM_URL}/o/token/`, {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ error: "EDM auth failed", details: txt }, { status: r.status });
    }

    const data = await r.json();
    const { access_token, refresh_token, expires_in } = data;
    if (!refresh_token) {
      return NextResponse.json({ error: "no_refresh_token" }, { status: 500 });
    }

    const encRefresh = encryptToken(refresh_token);
    const refreshHash = hashToken(refresh_token);
    const encAccess = access_token ? encryptToken(access_token) : undefined;
    const now = new Date();
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;
    const nextRefresh = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h

    // Upsert by refreshHash OR create new record. If you want single record per user,
    // use a where: { userId: userId } approach after retrieving userId from session.
    const rec = await prisma.edmAuth.upsert({
      where: { refreshTokenHash: refreshHash },
      create: {
        encryptedRefreshToken: encRefresh,
        refreshTokenHash: refreshHash,
        encryptedAccessToken: encAccess ?? undefined,
        accessTokenExpiresAt: expiresAt ?? undefined,
        lastRefreshedAt: now,
        nextRefreshAt: nextRefresh,
      },
      update: {
        encryptedRefreshToken: encRefresh,
        encryptedAccessToken: encAccess ?? undefined,
        accessTokenExpiresAt: expiresAt ?? undefined,
        revoked: false,
        lastRefreshedAt: now,
        nextRefreshAt: nextRefresh,
        refreshFailureCount: 0,
      },
    });

    return NextResponse.json({ ok: true, id: rec.id, nextRefreshAt: rec.nextRefreshAt });
  } catch (err: any) {
    console.error("EDM login error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}