"use client";

import React, { useEffect, useState } from "react";

type EdmStatus = {
  loggedIn: boolean;
  id?: string;
  lastRefreshedAt?: string | null;
  nextRefreshAt?: string | null;
};

type EdmDoctor = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  pesel?: string;
  telephone?: string;
  username?: string;
  is_active?: boolean;
  // ...other fields ignored here
};

type EdmDepartment = {
  id: number;
  name: string;
  city?: string;
  street?: string;
  // ...other fields ignored here
};

export default function AdminEdmPage() {
  // --- EDM auth/status + login (your previous view) ---
  const [edmStatus, setEdmStatus] = useState<EdmStatus | null>(null);
  const [edmLoading, setEdmLoading] = useState(false);

  const [edmUsername, setEdmUsername] = useState("");
  const [edmPassword, setEdmPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- Doctors & departments (new) ---
  const [doctors, setDoctors] = useState<EdmDoctor[]>([]);
  const [departments, setDepartments] = useState<EdmDepartment[]>([]);
  const [loadingFetch, setLoadingFetch] = useState(false);

  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentConfig, setCurrentConfig] = useState<any | null>(null);

  async function fetchCurrentConfig() {
    try {
      const res = await fetch("/api/edm/import");
      if (!res.ok) return;

      const json = await res.json();
      if (json?.record) setCurrentConfig(json.record);
      else setCurrentConfig(null);
    } catch (err) {
      console.error("fetch current edm config error:", err);
    }
  }

  useEffect(() => {
    fetchEdmStatus();
    fetchCurrentConfig();
  }, []);

  // --- status & login functions (kept from your previous page) ---
  async function fetchEdmStatus() {
    setEdmLoading(true);
    try {
      const res = await fetch("/api/edm/status");
      if (!res.ok) {
        setEdmStatus(null);
        return;
      }
      const json = await res.json();
      setEdmStatus(json);
    } catch (err) {
      console.error("fetch edm status", err);
      setEdmStatus(null);
    } finally {
      setEdmLoading(false);
    }
  }

  const submitEdmLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch("/api/edm/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: edmUsername, password: edmPassword }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Login failed");
      }
      const json = await res.json();
      if (!json?.ok) throw new Error("Login failed");
      await fetchEdmStatus();
      setEdmUsername("");
      setEdmPassword("");
    } catch (err: any) {
      console.error("EDM login error", err);
      setLoginError(err?.message ?? "Błąd logowania");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleEdmRefreshNow = async () => {
    if (!edmStatus?.id) return;
    try {
      await fetch("/api/edm/refresh-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edmStatus.id }),
      });
      await fetchEdmStatus();
    } catch (err) {
      console.error("edm refresh now error", err);
    }
  };

  // --- fetch doctors & departments ---
  async function handleFetchData() {
    setError(null);
    setDoctors([]);
    setDepartments([]);
    // leave selections cleared so nothing is selected by default
    setSelectedDoctorId(null);
    setSelectedDeptId(null);

    try {
      setLoadingFetch(true);
      const [docsRes, depsRes] = await Promise.all([
        fetch("/api/edm/doctors"),
        fetch("/api/edm/departments"),
      ]);

      if (!docsRes.ok) {
        const t = await docsRes.text();
        throw new Error(t || "Failed to fetch doctors");
      }
      if (!depsRes.ok) {
        const t = await depsRes.text();
        throw new Error(t || "Failed to fetch departments");
      }

      const docsJson = await docsRes.json();
      const depsJson = await depsRes.json();

      const docsList = Array.isArray(docsJson.results)
        ? docsJson.results
        : docsJson;
      const depsList = Array.isArray(depsJson.results)
        ? depsJson.results
        : depsJson;

      setDoctors(docsList);
      setDepartments(depsList);

      // intentionally do NOT auto-select the first items
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Błąd pobierania");
    } finally {
      setLoadingFetch(false);
    }
  }

  // --- save selected doctor + department to DB ---
  async function handleSave() {
    setResult(null);
    setError(null);
    if (selectedDoctorId == null || selectedDeptId == null) {
      setError("Wybierz lekarza i oddział");
      return;
    }
    const doctor = doctors.find((d) => d.id === selectedDoctorId);
    const department = departments.find((d) => d.id === selectedDeptId);
    if (!doctor || !department) {
      setError("Wybrany lekarz lub oddział nie istnieje");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/edm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor, department }),
      });

      const text = await res.text();

      if (!res.ok) {
        console.error("Import failed, status:", res.status, "body:", text);
        try {
          const parsed = JSON.parse(text);
          throw new Error(
            parsed?.details || parsed?.error || JSON.stringify(parsed)
          );
        } catch {
          throw new Error(text || `Request failed with status ${res.status}`);
        }
      }

      // parse success body (if JSON), otherwise show raw
      try {
        const json = JSON.parse(text);
        setResult(json);
        await fetchCurrentConfig();
      } catch {
        setResult({ ok: true, raw: text });
      }
    } catch (err: any) {
      console.error("save error", err);
      setError(err?.message ?? "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      {/* --- Top: your original EDM status / login UI --- */}
      <div className="flex flex-col sm:justify-between gap-3 mb-8">
        <h1 className="text-2xl font-semibold">MyDr EDM</h1>
        <div>
          {edmLoading ? (
            <div>Sprawdzanie statusu EDM...</div>
          ) : edmStatus?.loggedIn ? (
            <div className="text-sm text-color-tertiary">
              <div>Połączono z myDr EDM</div>
              <div className="mt-2 text-xs">
                Ostatnio odświeżono:{" "}
                {edmStatus.lastRefreshedAt
                  ? new Date(edmStatus.lastRefreshedAt).toLocaleString()
                  : "-"}
              </div>
              <div className="text-xs">
                Następne odświeżenie:{" "}
                {edmStatus.nextRefreshAt
                  ? new Date(edmStatus.nextRefreshAt).toLocaleString()
                  : "-"}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleEdmRefreshNow}
                  className="px-3 py-1 border rounded text-sm hover:bg-background-primary/10"
                >
                  Odśwież teraz
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-color-tertiary mb-2">
                Nie połączono z myDr EDM — zaloguj konto
              </div>
              <form onSubmit={submitEdmLogin} className="flex flex-col gap-2">
                <input
                  placeholder="Login EDM"
                  value={edmUsername}
                  onChange={(e) => setEdmUsername(e.target.value)}
                  className="px-3 py-2 rounded border bg-background-primary/20"
                  required
                />
                <input
                  placeholder="Hasło EDM"
                  value={edmPassword}
                  onChange={(e) => setEdmPassword(e.target.value)}
                  type="password"
                  className="px-3 py-2 rounded border bg-background-primary/20"
                  required
                />

                {loginError && (
                  <div className="text-xs text-red-600">{loginError}</div>
                )}

                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="px-3 py-2 border rounded text-sm hover:bg-background-primary/10"
                  >
                    {loginLoading ? "Logowanie..." : "Zaloguj do EDM"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* --- Divider --- */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">lekarz i oddział</h2>
      </div>

      {currentConfig && (
        <div className="mb-8 p-3 border rounded bg-background-primary/10">
          <h3 className="font-medium mb-1">Aktualnie zapisane w bazie:</h3>

          <div className="text-sm">
            <div>
              <span className="font-semibold">Lekarz:</span>{" "}
              {currentConfig.firstName} {currentConfig.lastName}{" "}
              <span className="text-color-tertiary">
                (externalId: {currentConfig.doctorExternalId})
              </span>
            </div>

            <div>
              <span className="font-semibold">Oddział:</span>{" "}
              {currentConfig.departmentName}{" "}
              <span className="text-color-tertiary">
                (externalId: {currentConfig.departmentExternalId})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --- Fetch & lists UI (doctors / departments) --- */}
      <div className="mb-4">
        {edmStatus?.loggedIn ? (
          <div>
            <button
              onClick={handleFetchData}
              className="px-3 py-1 rounded border"
            >
              {loadingFetch ? "Pobieranie..." : "Pobierz lekarzy i oddziały"}
            </button>
          </div>
        ) : (
          <div className="text-sm text-color-tertiary">
            Nie połączono z EDM — najpierw zaloguj konto EDM
          </div>
        )}
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded max-h-[60vh] overflow-auto">
          <h3 className="font-medium mb-2">Lekarze</h3>
          {doctors.length === 0 ? (
            <div className="text-sm text-color-tertiary">
              Brak lekarzy — pobierz dane
            </div>
          ) : (
            doctors.map((d) => (
              <label
                key={d.id}
                className={`flex items-start gap-3 p-2 rounded hover:bg-background-primary/5 ${selectedDoctorId === d.id ? "bg-background-primary/5" : ""}`}
              >
                <input
                  type="radio"
                  name="doctor"
                  checked={selectedDoctorId === d.id}
                  onChange={() => setSelectedDoctorId(d.id)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">
                    {d.first_name || d.username || `${d.id}`}
                  </div>
                  <div className="text-xs text-color-tertiary">
                    {d.last_name ?? ""} • {d.email ?? "-"}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="p-4 border rounded max-h-[60vh] overflow-auto">
          <h3 className="font-medium mb-2">Oddziały</h3>
          {departments.length === 0 ? (
            <div className="text-sm text-color-tertiary">
              Brak oddziałów — pobierz dane
            </div>
          ) : (
            departments.map((d) => (
              <label
                key={d.id}
                className={`flex items-start gap-3 p-2 rounded hover:bg-background-primary/5 ${selectedDeptId === d.id ? "bg-background-primary/5" : ""}`}
              >
                <input
                  type="radio"
                  name="dept"
                  checked={selectedDeptId === d.id}
                  onChange={() => setSelectedDeptId(d.id)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-color-tertiary">
                    {d.city ?? ""} {d.street ? `— ${d.street}` : ""}
                  </div>
                  <div className="text-xs text-color-tertiary">ID: {d.id}</div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded bg-color-primary text-black"
        >
          {saving ? "Zapis..." : "Zapisz wybranego lekarza i oddział"}
        </button>
        <button
          onClick={() => {
            setDoctors([]);
            setDepartments([]);
            setSelectedDoctorId(null);
            setSelectedDeptId(null);
            setResult(null);
            setError(null);
          }}
          className="px-3 py-1 rounded border"
        >
          Wyczyść
        </button>
      </div>
    </div>
  );
}
