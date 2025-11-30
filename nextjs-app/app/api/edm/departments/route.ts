import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken, hashToken } from "@/lib/edm-crypto";

/**
 * Server-side proxy: GET /api/edm/departments
 * Forwards request to EDM /departments endpoint using stored access token.
 * Add auth (check session/roles) if needed.
 */

async function refreshAccessTokenIfNeeded(rec: any) {
  if (rec.encryptedAccessToken && rec.accessTokenExpiresAt && new Date(rec.accessTokenExpiresAt) > new Date(Date.now() + 60 * 1000)) {
    return decryptToken(rec.encryptedAccessToken);
  }

  const rawRefresh = decryptToken(rec.encryptedRefreshToken);
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", rawRefresh);
  params.append("client_id", process.env.EDM_CLIENT_ID ?? "");
  params.append("client_secret", process.env.EDM_CLIENT_SECRET ?? "");

  const tokenUrl = (process.env.EDM_URL ?? "https://api.edm.mydr.pl/secure/ext_api") + "/o/token/";
  const r = await fetch(tokenUrl, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!r.ok) {
    const txt = await r.text();
    await prisma.edmAuth.update({
      where: { id: rec.id },
      data: {
        refreshFailureCount: { increment: 1 },
        nextRefreshAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    throw new Error(`EDM token refresh failed: ${txt}`);
  }

  const data = await r.json();
  const { access_token, refresh_token, expires_in } = data;
  if (!access_token) throw new Error("No access_token in refresh response");

  const encAccess = encryptToken(access_token);
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

  let encRefresh = rec.encryptedRefreshToken;
  let refreshHash = rec.refreshTokenHash;
  if (refresh_token) {
    encRefresh = encryptToken(refresh_token);
    refreshHash = hashToken(refresh_token);
  }

  await prisma.edmAuth.update({
    where: { id: rec.id },
    data: {
      encryptedAccessToken: encAccess,
      accessTokenExpiresAt: expiresAt ?? undefined,
      encryptedRefreshToken: encRefresh,
      refreshTokenHash: refreshHash,
      lastRefreshedAt: new Date(),
      nextRefreshAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      refreshFailureCount: 0,
    },
  });

  return access_token;
}

export async function GET(req: Request) {
  try {
    // OPTIONAL: add server-side auth here (e.g. check session). Otherwise restrict as needed.
    const rec = await prisma.edmAuth.findFirst({
      where: { revoked: false },
      orderBy: { lastRefreshedAt: "desc" },
    });
    if (!rec) return NextResponse.json({ error: "No EDM credentials configured" }, { status: 404 });

    let accessToken: string;
    try {
      accessToken = await refreshAccessTokenIfNeeded(rec);
    } catch (err: any) {
      console.error("Failed to refresh access token:", err);
      return NextResponse.json({ error: "failed_to_get_access_token", details: err?.message ?? String(err) }, { status: 502 });
    }

    const base = process.env.EDM_URL ?? "https://api.edm.mydr.pl/secure/ext_api";
    const url = `${base}/departments/`; // adjust if endpoint differs
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    const text = await resp.text();
    const status = resp.status;
    let body: any;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }

    return NextResponse.json(body, { status });
  } catch (err: any) {
    console.error("GET /api/edm/departments error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}