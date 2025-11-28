// app/api/admin/edm/refresh-one/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { decryptToken, encryptToken, hashToken } from "@/lib/edm-crypto";


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const rec = await prisma.edmAuth.findUnique({ where: { id } });
    if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (rec.revoked) return NextResponse.json({ error: "revoked" }, { status: 400 });

    const rawRefresh = decryptToken(rec.encryptedRefreshToken);

    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", rawRefresh);
    params.append("client_id", process.env.EDM_CLIENT_ID ?? "");
    params.append("client_secret", process.env.EDM_CLIENT_SECRET ?? "");

    const r = await fetch(`${process.env.EDM_URL}/o/token/`, {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!r.ok) {
      const txt = await r.text();
      await prisma.edmAuth.update({ where: { id }, data: { refreshFailureCount: { increment: 1 } } });
      return NextResponse.json({ error: "refresh_failed", details: txt }, { status: r.status });
    }

    const data = await r.json();
    const { access_token, refresh_token, expires_in } = data;
    const now = new Date();
    const encAccess = access_token ? encryptToken(access_token) : undefined;
    let encRefresh = rec.encryptedRefreshToken;
    let refreshHash = rec.refreshTokenHash;

    if (refresh_token) {
      encRefresh = encryptToken(refresh_token);
      refreshHash = hashToken(refresh_token);
    }

    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;
    const nextRefresh = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await prisma.edmAuth.update({
      where: { id },
      data: {
        encryptedAccessToken: encAccess,
        accessTokenExpiresAt: expiresAt ?? undefined,
        encryptedRefreshToken: encRefresh,
        refreshTokenHash: refreshHash,
        lastRefreshedAt: now,
        nextRefreshAt: nextRefresh,
        refreshFailureCount: 0,
      },
    });

    return NextResponse.json({ ok: true, nextRefreshAt: nextRefresh });
  } catch (err: any) {
    console.error("refresh-one error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}