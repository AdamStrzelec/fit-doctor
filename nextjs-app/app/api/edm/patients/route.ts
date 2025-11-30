import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { decryptToken, encryptToken, hashToken } from "@/lib/edm-crypto";


function parsePesel(pesel: string): { dateOfBirth?: string; sex?: string } {
  if (!/^\d{11}$/.test(pesel)) return {};
  const year = parseInt(pesel.slice(0, 2), 10);
  let month = parseInt(pesel.slice(2, 4), 10);
  const day = parseInt(pesel.slice(4, 6), 10);

  // ustalenie stulecia na podstawie modyfikatora month
  let fullYear = 1900 + year;
  if (month >= 1 && month <= 12) {
    fullYear = 1900 + year;
  } else if (month >= 21 && month <= 32) {
    fullYear = 2000 + year;
    month -= 20;
  } else if (month >= 41 && month <= 52) {
    fullYear = 2100 + year;
    month -= 40;
  } else if (month >= 61 && month <= 72) {
    fullYear = 2200 + year;
    month -= 60;
  } else if (month >= 81 && month <= 92) {
    fullYear = 1800 + year;
    month -= 80;
  } else {
    // nieprawidłowy miesiąc
    return {};
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateOfBirth = `${fullYear}-${mm}-${dd}`;

  // płeć z ostatniej cyfry pesel (parzysta = kobieta, nieparzysta = mężczyzna)
  const sexDigit = parseInt(pesel.charAt(9), 10);
  const sex = sexDigit % 2 === 1 ? "Mężczyzna" : "Kobieta";

  return { dateOfBirth, sex };
}

function buildPatientPayload(input: { name: string; surname: string; email?: string; pesel?: string }) {
  const { name, surname, email, pesel } = input;
  const payload: any = {
    name,
    surname,
    // wypełniamy tylko pola, które mamy; większość pól pozostawiamy pustymi
    telephone: "",
    second_telephone: "",
    // country default "PL" — nie ustawiamy teryt
    country: "PL",
    supervisor: 0,
    nfz: "",
    rights: "",
    residence_address: {
      country: "PL",
      street: "",
      street_number: "",
      flat_number: "",
      postal_code: "",
      city: "",
      province: "",
    },
    registration_address: {
      country: "PL",
      street: "",
      street_number: "",
      flat_number: "",
      postal_code: "",
      city: "",
      province: "",
    },
    blood_type: "N",
    active: true,
    // nie dodajemy pola teryt w payload jeśli nie mamy właściwej wartości
  };

  if (email) payload.email = email;
  if (pesel) {
    payload.pesel = pesel;
    const parsed = parsePesel(pesel);
    if (parsed.dateOfBirth) payload.date_of_birth = parsed.dateOfBirth;
    if (parsed.sex) {
      // EDM w przykładzie używa "Nieznana", ale jeśli mamy pesel ustawiamy odpowiadającą wartość
      // dopasuj jeśli EDM oczekuje innych wartości ("M","K","Male","Female" itp.)
      payload.sex = parsed.sex;
    }
  } else {
    // domyślna wartość płci, jeśli nie mamy pesel — możesz ustawić "Nieznana"
    payload.sex = "Nieznana";
  }

  return payload;
}

async function refreshAccessTokenIfNeeded(rec: any) {
  const now = new Date();
  if (rec.encryptedAccessToken && rec.accessTokenExpiresAt && new Date(rec.accessTokenExpiresAt) > new Date(Date.now() + 60 * 1000)) {
    return decryptToken(rec.encryptedAccessToken);
  }

  const rawRefresh = decryptToken(rec.encryptedRefreshToken);

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", rawRefresh);
  params.append("client_id", process.env.EDM_CLIENT_ID ?? "");
  params.append("client_secret", process.env.EDM_CLIENT_SECRET ?? "");

  const r = await fetch(`https://api.edm.mydr.pl/secure/ext_api/o/token/`, {
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
    throw new Error(`EDM refresh failed: ${txt}`);
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

  const nextRefresh = new Date(Date.now() + 8 * 60 * 60 * 1000);

  await prisma.edmAuth.update({
    where: { id: rec.id },
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

  return access_token;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, surname, email, pesel } = body || {};
    if (!name || !surname) {
      return NextResponse.json({ error: "name and surname are required" }, { status: 400 });
    }

    const rec = await prisma.edmAuth.findFirst({
      where: { revoked: false },
      orderBy: { lastRefreshedAt: "desc" },
    });
    if (!rec) return NextResponse.json({ error: "No EDM credentials configured" }, { status: 404 });

    let accessToken: string;
    try {
      accessToken = await refreshAccessTokenIfNeeded(rec);
    } catch (err: any) {
      console.error("Failed to get access token:", err);
      return NextResponse.json({ error: "failed_to_get_access_token", details: err?.message ?? String(err) }, { status: 502 });
    }

    const payload = buildPatientPayload({ name, surname, email, pesel });

    const createResp = await fetch("https://api.edm.mydr.pl/secure/ext_api/patients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const status = createResp.status;
    const respText = await createResp.text();
    let parsed: any = null;
    try { parsed = JSON.parse(respText); } catch { parsed = { raw: respText }; }

    // Jeśli EDM zwraca typ validation_error -> przekaż to do UI z surową treścią
    if (!createResp.ok) {
      console.warn("EDM create patient failed:", status, parsed);
      return NextResponse.json({ ok: false, status, body: parsed }, { status: 200 });
    }

    return NextResponse.json({ ok: true, status, body: parsed }, { status: 200 });
  } catch (err: any) {
    console.error("create-patient error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}