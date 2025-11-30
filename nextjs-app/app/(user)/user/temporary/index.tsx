import React, { useState } from "react";

export interface CreateVisitProps {
  userId: string; // Mongo user id - REQUIRED
}

export const CreateVisit = ({ userId }: CreateVisitProps) => {
  const [patientName, setPatientName] = useState("");
  const [patientSurname, setPatientSurname] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPesel, setPatientPesel] = useState("");
  const [patientDob, setPatientDob] = useState(""); // YYYY-MM-DD
  const [patientPhone, setPatientPhone] = useState("");
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [patientSuccess, setPatientSuccess] = useState<any | null>(null);

  const submitCreatePatientVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatientError(null);
    setPatientSuccess(null);

    if (!userId) {
      setPatientError("Brak userId (skonfiguruj komponent z userId).");
      return;
    }

    if (!patientName || !patientSurname) {
      setPatientError("Imię i nazwisko są wymagane");
      return;
    }

    setPatientLoading(true);
    try {
      const res = await fetch("/api/edm/order-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: patientName,
          surname: patientSurname,
          email: patientEmail || undefined,
          pesel: patientPesel || undefined,
          date_of_birth: patientDob || undefined,
          telephone: patientPhone || undefined,
          // optional: visitDate: "2025-11-30" // by default server sets today
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        setPatientError(json?.error || JSON.stringify(json));
      } else {
        // result may be ok:false with validation in body (status 200) - show it
        setPatientSuccess(json);
        // clear fields on success (optional)
        setPatientName("");
        setPatientSurname("");
        setPatientEmail("");
        setPatientPesel("");
        setPatientDob("");
        setPatientPhone("");
      }
    } catch (err: any) {
      console.error("create patient/visit error", err);
      setPatientError(err?.message ?? "Błąd sieci");
    } finally {
      setPatientLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl bg-background-card p-6">
      <h3 className="text-lg font-semibold text-color-primary">
        Utwórz wizytę (i pacjenta jeśli potrzebne) w myDr EDM
      </h3>
      <p className="text-sm text-color-tertiary mt-1">
        Wypełnij imię i nazwisko (w razie braku externalPatientId pacjent
        zostanie utworzony). Możesz podać email, PESEL, datę urodzenia
        (YYYY-MM-DD) oraz telefon.
      </p>

      <form
        onSubmit={submitCreatePatientVisit}
        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl"
      >
        <input
          placeholder="Imię"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          className="px-3 py-2 rounded border bg-background-primary/20"
          required
        />
        <input
          placeholder="Nazwisko"
          value={patientSurname}
          onChange={(e) => setPatientSurname(e.target.value)}
          className="px-3 py-2 rounded border bg-background-primary/20"
          required
        />

        <input
          placeholder="Email"
          value={patientEmail}
          onChange={(e) => setPatientEmail(e.target.value)}
          className="px-3 py-2 rounded border bg-background-primary/20 md:col-span-2"
          type="email"
        />

        <input
          placeholder="PESEL"
          value={patientPesel}
          onChange={(e) => setPatientPesel(e.target.value)}
          className="px-3 py-2 rounded border bg-background-primary/20"
        />
        <input
          placeholder="Data urodzenia"
          value={patientDob}
          onChange={(e) => setPatientDob(e.target.value)}
          className="px-3 py-2 rounded border bg-background-primary/20"
          type="date"
        />

        <input
          placeholder="Telefon"
          value={patientPhone}
          onChange={(e) => setPatientPhone(e.target.value)}
          className="px-3 py-2 rounded border bg-background-primary/20 md:col-span-2"
        />

        <div className="flex gap-2 md:col-span-2 mt-2">
          <button
            type="submit"
            disabled={patientLoading}
            className="px-4 py-2 rounded bg-color-primary text-black"
          >
            {patientLoading ? "Tworzenie..." : "Utwórz wizytę"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPatientName("");
              setPatientSurname("");
              setPatientEmail("");
              setPatientPesel("");
              setPatientDob("");
              setPatientPhone("");
              setPatientError(null);
              setPatientSuccess(null);
            }}
            className="px-4 py-2 rounded border"
          >
            Wyczyść
          </button>
        </div>

        {patientError && (
          <div className="text-sm text-red-600 md:col-span-2">
            {patientError}
          </div>
        )}
        {patientSuccess && (
          <div className="text-sm text-green-600 md:col-span-2">
            Odpowiedź API:{" "}
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(patientSuccess, null, 2)}
            </pre>
          </div>
        )}
      </form>
    </div>
  );
};
