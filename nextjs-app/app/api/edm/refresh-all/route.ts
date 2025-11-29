// app/api/admin/edm/refresh-all/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { decryptToken, encryptToken, hashToken } from "@/lib/edm-crypto";

function checkAuth(req: Request) {
  // Basic protection: expect header X-ADMIN-KEY or Bearer ADMIN_REFRESH_KEY
  const auth = req.headers.get("authorization") ?? "";
  const key = process.env.ADMIN_REFRESH_KEY ?? "";
  if (auth === `Bearer ${key}`) return true;
  const hdr = req.headers.get("x-admin-key");
  if (hdr === key) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const toRefresh = await prisma.edmAuth.findMany({
      where: { revoked: false, nextRefreshAt: { lte: now } },
      take: 100,
    });

    const results: any[] = [];
    for (const r of toRefresh) {
      try {
        const rawRefresh = decryptToken(r.encryptedRefreshToken);

        const params = new URLSearchParams();
        params.append("grant_type", "refresh_token");
        params.append("refresh_token", rawRefresh);
        params.append("client_id", process.env.EDM_CLIENT_ID ?? "");
        params.append("client_secret", process.env.EDM_CLIENT_SECRET ?? "");

        const call = await fetch(`${process.env.EDM_URL}/o/token/`, {
          method: "POST",
          body: params,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        if (!call.ok) {
          const txt = await call.text();
          await prisma.edmAuth.update({
            where: { id: r.id },
            data: {
              refreshFailureCount: { increment: 1 },
              nextRefreshAt: new Date(Date.now() + 60 * 60 * 1000), // retry in 1h
            },
          });
          results.push({ id: r.id, ok: false, details: txt });
          continue;
        }

        const data = await call.json();
        const { access_token, refresh_token, expires_in } = data;
        const encAccess = access_token ? encryptToken(access_token) : undefined;
        let encRefresh = r.encryptedRefreshToken;
        let refreshHash = r.refreshTokenHash;
        if (refresh_token) {
          encRefresh = encryptToken(refresh_token);
          refreshHash = hashToken(refresh_token);
        }
        const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;
        const nextRefresh = new Date(Date.now() + 8 * 60 * 60 * 1000);

        await prisma.edmAuth.update({
          where: { id: r.id },
          data: {
            encryptedAccessToken: encAccess,
            accessTokenExpiresAt: expiresAt ?? undefined,
            encryptedRefreshToken: encRefresh,
            refreshTokenHash: refreshHash,
            lastRefreshedAt: new Date(),
            nextRefreshAt: nextRefresh,
            refreshFailureCount: 0,
          },
        });

        results.push({ id: r.id, ok: true, nextRefreshAt: nextRefresh });
      } catch (err: any) {
        console.error("refresh-all item error", r.id, err);
        await prisma.edmAuth.update({
          where: { id: r.id },
          data: {
            refreshFailureCount: { increment: 1 },
            nextRefreshAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
        results.push({ id: r.id, ok: false, details: err?.message ?? String(err) });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err: any) {
    console.error("refresh-all error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}