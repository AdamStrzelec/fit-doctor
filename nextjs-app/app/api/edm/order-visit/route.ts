import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken, hashToken } from "@/lib/edm-crypto";

/**
 * POST /api/edm/order-visit
 * Body:
 * {
 *   userId: string,           // REQUIRED - local DB user id (Mongo ObjectId string)
 *   name: string,             // REQUIRED
 *   surname: string,          // REQUIRED
 *   email?: string,
 *   pesel?: string,
 *   date_of_birth?: string,   // "YYYY-MM-DD" optional (overrides parsed PESEL)
 *   telephone?: string,
 *   visitDate?: string        // "YYYY-MM-DD" optional (default = today)
 * }
 *
 * Flow:
 * - find user in DB
 * - if no user.externalPatientId => create patient in EDM, update user.externalPatientId
 * - create visit in EDM using patient, doctor, office, date
 * - returns { ok: true, visit: <edm response> } or { ok:false, status, body } if validation
 */

function parsePesel(pesel: string): { dateOfBirth?: string; sex?: string } {
  if (!/^\d{11}$/.test(pesel)) return {};
  const year = parseInt(pesel.slice(0, 2), 10);
  let month = parseInt(pesel.slice(2, 4), 10);
  const day = parseInt(pesel.slice(4, 6), 10);

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
    return {};
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateOfBirth = `${fullYear}-${mm}-${dd}`;

  const sexDigit = parseInt(pesel.charAt(9), 10);
  const sex = sexDigit % 2 === 1 ? "Mężczyzna" : "Kobieta";

  return { dateOfBirth, sex };
}

function removeEmpty(obj: any) {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val === "" || val === null || val === undefined) {
        delete obj[key];
        continue;
      }
      if (typeof val === "object") {
        removeEmpty(val);
        // if nested object became empty, delete it
        if (typeof obj[key] === "object" && Object.keys(obj[key]).length === 0) {
          delete obj[key];
        }
      }
    }
  }
  return obj;
}

function buildPatientPayload(input: { name: string; surname: string; email?: string; pesel?: string; date_of_birth?: string; telephone?: string }) {
  const { name, surname, email, pesel, date_of_birth, telephone } = input;
  const payload: any = {
    name,
    surname,
    // include fields only if we have values; we'll prune empty ones later
    telephone: telephone ?? null,
    second_telephone: null,
    country: "PL",
    // supervisor: OMITTED unless explicitly provided
    nfz: null,
    rights: null,
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
  };

  if (email) payload.email = email;
  if (pesel) {
    payload.pesel = pesel;
    const parsed = parsePesel(pesel);
    if (parsed.dateOfBirth && !date_of_birth) payload.date_of_birth = parsed.dateOfBirth;
    if (parsed.sex) payload.sex = parsed.sex;
  }
  if (date_of_birth) payload.date_of_birth = date_of_birth;
  if (!payload.sex) payload.sex = "Nieznana";

  // remove empty strings / nulls/ undefined recursively before sending
  removeEmpty(payload);

  return payload;
}

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userId,
      name,
      surname,
      email,
      pesel,
      date_of_birth,
      telephone,
      visitDate,
    } = body || {};

    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!name || !surname) return NextResponse.json({ error: "name and surname required" }, { status: 400 });

    // find user
    const user = await prisma.user.findUnique({ where: { id: String(userId) } });
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    // load EDM auth
    const rec = await prisma.edmAuth.findFirst({ where: { revoked: false }, orderBy: { lastRefreshedAt: "desc" } });
    if (!rec) return NextResponse.json({ error: "No EDM credentials configured" }, { status: 404 });

    let accessToken: string;
    try {
      accessToken = await refreshAccessTokenIfNeeded(rec);
    } catch (err: any) {
      console.error("Failed to get access token:", err);
      return NextResponse.json({ error: "failed_to_get_access_token", details: err?.message ?? String(err) }, { status: 502 });
    }

    // Ensure patient exists in EDM (create if needed)
    let externalPatientId = (user as any).externalPatientId ?? null;
    if (!externalPatientId) {
      const patientPayload = buildPatientPayload({ name, surname, email, pesel, date_of_birth, telephone });

      const createResp = await fetch((process.env.EDM_URL ?? "https://api.edm.mydr.pl/secure/ext_api") + "/patients/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(patientPayload),
      });

      const status = createResp.status;
      const respText = await createResp.text();
      let parsed: any;
      try { parsed = JSON.parse(respText); } catch { parsed = { raw: respText }; }

      if (!createResp.ok) {
        console.warn("EDM create patient failed:", status, parsed);
        // return validation info to client (keep 200 to allow UI to show EDM validation)
        return NextResponse.json({ ok: false, step: "create_patient", status, body: parsed }, { status: 200 });
      }

      externalPatientId = parsed.id;
      // update local user with externalPatientId
      await prisma.user.update({
        where: { id: String(userId) },
        data: { externalPatientId: externalPatientId },
      });
    }

    // get doctor & office from EdmDoctorDepartment (we expect a singleton)
    const edmCfg = await prisma.edmDoctorDepartment.findFirst({ orderBy: { createdAt: "desc" } });
    if (!edmCfg) {
      return NextResponse.json({ error: "no_edm_doctor_department_configured" }, { status: 400 });
    }
    const doctorExternalId = edmCfg.doctorExternalId;
    const officeExternalId = edmCfg.departmentExternalId;

    if (!doctorExternalId || !officeExternalId) {
      return NextResponse.json({ error: "doctor or office not configured" }, { status: 400 });
    }

    // prepare visit payload
    const visitDateFinal = visitDate ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const visitPayload = {
      patient: String(externalPatientId),
      doctor: String(doctorExternalId),
      office: String(officeExternalId),
      date: visitDateFinal,
    };

    const visitResp = await fetch((process.env.EDM_URL ?? "https://api.edm.mydr.pl/secure/ext_api") + "/visits/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(visitPayload),
    });

    const vStatus = visitResp.status;
    const vText = await visitResp.text();
    let vParsed: any;
    try { vParsed = JSON.parse(vText); } catch { vParsed = { raw: vText }; }

    if (!visitResp.ok) {
      console.warn("EDM create visit failed:", vStatus, vParsed);
      return NextResponse.json({ ok: false, step: "create_visit", status: vStatus, body: vParsed }, { status: 200 });
    }

    return NextResponse.json({ ok: true, patientId: externalPatientId, visit: vParsed }, { status: 200 });
  } catch (err: any) {
    console.error("order-visit error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}