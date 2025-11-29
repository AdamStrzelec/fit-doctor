import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { decryptToken, encryptToken, hashToken } from "@/lib/edm-crypto";

/**
 * Refresh all EDM tokens regardless of nextRefreshAt.
 *
 * WARNING:
 * - This will attempt refresh for every non-revoked record in the DB.
 * - If you run multiple workers concurrently they may try to refresh the same record at the same time.
 *   Recommended improvement: add a 'lockedAt' / 'processingBy' field to EdmAuth and claim records atomically before processing.
 */

function checkAuth(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const key = process.env.ADMIN_REFRESH_KEY ?? "";
  if (auth === `Bearer ${key}`) return true;
  const hdr = req.headers.get("x-admin-key");
  if (hdr === key) return true;
  // Allow Vercel cron calls if running on Vercel and x-vercel-cron header present
  if (process.env.VERCEL === "1" && req.headers.get("x-vercel-cron") != null) return true;
  return false;
}

async function refreshRecord(r: any) {
  try {
    const rawRefresh = decryptToken(r.encryptedRefreshToken);

    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", rawRefresh);
    params.append("client_id", process.env.EDM_CLIENT_ID ?? "");
    params.append("client_secret", process.env.EDM_CLIENT_SECRET ?? "");

    const tokenUrl = (process.env.EDM_URL ?? "https://api.edm.mydr.pl/secure/ext_api") + "/o/token/";
    const call = await fetch(tokenUrl, {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!call.ok) {
      const txt = await call.text();
      // schedule retry in 1h
      await prisma.edmAuth.update({
        where: { id: r.id },
        data: {
          refreshFailureCount: { increment: 1 },
          nextRefreshAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      return { id: r.id, ok: false, details: txt };
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

    return { id: r.id, ok: true, nextRefreshAt: nextRefresh };
  } catch (err: any) {
    console.error("refresh-all item error", r.id, err);
    await prisma.edmAuth.update({
      where: { id: r.id },
      data: {
        refreshFailureCount: { increment: 1 },
        nextRefreshAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return { id: r.id, ok: false, details: err?.message ?? String(err) };
  }
}

export async function POST(req: Request) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const results: any[] = [];
    const batchSize = 100;

    // Process in batches until no more non-revoked records
    while (true) {
      const toRefresh = await prisma.edmAuth.findMany({
        where: { revoked: false },
        take: batchSize,
      });

      if (!toRefresh || toRefresh.length === 0) break;

      // process sequentially to avoid parallel token races against the same refresh token
      for (const r of toRefresh) {
        // Note: Consider atomic "claiming" here (e.g. set lockedAt) to avoid concurrent runs processing same record.
        const res = await refreshRecord(r);
        results.push(res);
      }

      // If less than a full batch was returned, we've finished
      if (toRefresh.length < batchSize) break;
      // otherwise loop to pick next page
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err: any) {
    console.error("refresh-all error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}