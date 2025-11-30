import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/edm/import
 * Zamiast upsertować po doctorExternalId, implementujemy "singleton" zapis:
 * - jeśli istnieje jakikolwiek rekord edmDoctorDepartment -> update tego rekordu
 * - w przeciwnym razie -> create nowego rekordu
 *
 * Dzięki temu kolejne zapisy nadpisują poprzedni wpis zamiast tworzyć nowe dokumenty.
 * (Jeżeli wolisz zachować wiele rekordów i nadpisywać po doctorExternalId — wrócimy do upsert,
 *  ale rozumiem, że chcesz jeden rekord konfiguracyjny.)
 */
export async function GET() {
  try {
    const existing = await prisma.edmDoctorDepartment.findFirst({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      record: existing ?? null
    });
  } catch (err: any) {
    console.error("edm import GET error:", err);
    return NextResponse.json(
      { error: "server_error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { doctor, department } = body || {};
    if (!doctor || !department) {
      return NextResponse.json({ error: "doctor and department are required" }, { status: 400 });
    }

    const docExtId =
      typeof doctor.id === "number" ? doctor.id : typeof doctor.id === "string" && doctor.id !== "" ? parseInt(doctor.id, 10) : undefined;
    const deptExtId =
      typeof department.id === "number" ? department.id : typeof department.id === "string" && department.id !== "" ? parseInt(department.id, 10) : undefined;

    const firstName = doctor.first_name ?? doctor.firstName ?? "";
    const lastName = doctor.last_name ?? doctor.lastName ?? "";

    // znajdź najnowszy zapisany rekord (jeśli istnieje)
    const existing = await prisma.edmDoctorDepartment.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      // aktualizuj istniejący rekord
      const updated = await prisma.edmDoctorDepartment.update({
        where: { id: existing.id },
        data: {
          doctorExternalId: docExtId ?? undefined,
          firstName,
          lastName,
          departmentExternalId: deptExtId ?? undefined,
          departmentName: department.name ?? undefined,
        },
      });
      console.log("Import: updated singleton record id=", existing.id);
      return NextResponse.json({ ok: true, record: updated });
    } else {
      // brak rekordu -> utwórz nowy
      const created = await prisma.edmDoctorDepartment.create({
        data: {
          doctorExternalId: docExtId ?? undefined,
          firstName,
          lastName,
          departmentExternalId: deptExtId ?? undefined,
          departmentName: department.name ?? undefined,
        },
      });
      console.log("Import: created singleton record id=", created.id);
      return NextResponse.json({ ok: true, record: created });
    }
  } catch (err: any) {
    console.error("edm import error:", err);
    return NextResponse.json({ error: "server_error", details: err?.message ?? String(err) }, { status: 500 });
  }
}