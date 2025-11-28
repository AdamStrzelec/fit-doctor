"use client";

import { signOut, useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import imagePlaceholder from "@/public/assets/user-img-placeholder.jpg";
import Link from "next/link";
import NextImage from "next/image";

type FetchedUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  providers?: string[];
  hasPassword?: boolean;
  hasGoogleAccount?: boolean;
};

type OrdersMeta = {
  counts: {
    TO_PROCESS: number;
    PROCESSING: number;
    PROCESSED: number;
  };
  total: number;
};

export default function AdminPage() {
  const { data: sessionData } = useSession();

  const [userMeta, setUserMeta] = useState<FetchedUser | null>(null);
  const [loadingUserMeta, setLoadingUserMeta] = useState(false);

  const [ordersMeta, setOrdersMeta] = useState<OrdersMeta | null>(null);
  const [loadingOrdersMeta, setLoadingOrdersMeta] = useState(false);
  const [ordersMetaError, setOrdersMetaError] = useState<string | null>(null);

  // EDM login/status state
  const [edmStatus, setEdmStatus] = useState<{
    loggedIn: boolean;
    id?: string;
    lastRefreshedAt?: string | null;
    nextRefreshAt?: string | null;
  } | null>(null);
  const [edmLoading, setEdmLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [edmUsername, setEdmUsername] = useState("");
  const [edmPassword, setEdmPassword] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      if (!sessionData?.user?.email) return;
      setLoadingUserMeta(true);
      try {
        const res = await fetch("/api/user/me");
        if (!res.ok) return;
        const json = await res.json();

        setUserMeta(json || null);
      } catch (err) {
        console.error("fetch /api/user/me error", err);
      } finally {
        setLoadingUserMeta(false);
      }
    };
    fetchUser();
  }, [sessionData?.user?.email]);

  const fetchOrdersMeta = async () => {
    setLoadingOrdersMeta(true);
    setOrdersMetaError(null);
    try {
      const res = await fetch("/api/admin/orders/meta");
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to fetch orders meta");
      }
      const json = await res.json();
      setOrdersMeta(json as OrdersMeta);
    } catch (err: any) {
      console.error("fetch /api/admin/orders/meta error", err);
      setOrdersMetaError(err?.message ?? "Błąd pobierania metadanych");
    } finally {
      setLoadingOrdersMeta(false);
    }
  };

  useEffect(() => {
    // fetch metadata on mount
    fetchOrdersMeta();
  }, []);

  useEffect(() => {
    // fetch EDM status on mount
    fetchEdmStatus();
  }, []);

  const fetchEdmStatus = async () => {
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
  };

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
      // refresh status
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

  const logout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const avatarSrc = sessionData?.user?.image ?? undefined;

  if (loadingUserMeta) {
    return (
      <div className="w-full flex justify-center py-10">
        Ładowanie użytkownika...
      </div>
    );
  }

  return (
    <section className="bg-background-primary py-10 px-4 lg:px-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8">
        <aside className="col-span-4 bg-background-card rounded-2xl p-6 flex flex-col items-center gap-4">
          <div className="w-28 h-28 rounded-full overflow-hidden bg-muted-foreground/10">
            <NextImage
              src={avatarSrc ?? imagePlaceholder}
              alt={userMeta?.name ?? sessionData?.user?.name ?? "Avatar"}
              width={112}
              height={112}
              className="object-cover w-full h-full"
              priority={false}
            />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-semibold text-color-primary">
              {userMeta?.name ?? sessionData?.user?.name ?? "Użytkownik"}
            </h3>
            {userMeta?.email || sessionData?.user?.email ? (
              <p className="text-sm text-color-tertiary mt-1">
                {userMeta?.email ?? sessionData?.user?.email}
              </p>
            ) : null}
          </div>

          <div className="w-full mt-2">
            <div className="w-full max-w-[28rem]">
              <h4 className="text-sm font-semibold mb-2">MyDr EDM</h4>

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
                  <form
                    onSubmit={submitEdmLogin}
                    className="flex flex-col gap-2"
                  >
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

          <div className="w-full mt-2">
            <div className="flex flex-col sm:items-center justify-center gap-2">
              <div className="text-sm text-color-tertiary mb-1 sm:mb-0 text-center">
                Zamówienia:
              </div>

              <div className="flex flex-col md:flex-row gap-2 items-center">
                <div>
                  <div className="inline-flex items-center px-2 py-1 rounded bg-red-300 text-red-800 text-sm font-semibold">
                    Nieobsłużone
                  </div>
                  <div className="text-sm text-color-tertiary text-center mt-1">
                    {loadingOrdersMeta
                      ? "..."
                      : (ordersMeta?.counts.TO_PROCESS ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-sm font-semibold">
                    W trakcie
                  </div>
                  <div className="text-sm text-color-tertiary text-center mt-1">
                    {loadingOrdersMeta
                      ? "..."
                      : (ordersMeta?.counts.PROCESSING ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-sm font-semibold">
                    Obsłużone
                  </div>
                  <div className="text-sm text-color-tertiary text-center mt-1">
                    {loadingOrdersMeta
                      ? "..."
                      : (ordersMeta?.counts.PROCESSED ?? 0)}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-color-tertiary">Razem</span>
                  <span className="text-sm text-gray-200">
                    {loadingOrdersMeta ? "..." : (ordersMeta?.total ?? 0)}
                  </span>
                </div>

                <button
                  onClick={fetchOrdersMeta}
                  disabled={loadingOrdersMeta}
                  className="ml-3 px-2 py-1 border rounded text-sm hover:bg-background-primary/10"
                  title="Odśwież"
                >
                  {loadingOrdersMeta ? "..." : "Odśwież"}
                </button>
              </div>
            </div>

            {ordersMetaError && (
              <div className="mt-2 text-xs text-red-600">{ordersMetaError}</div>
            )}
          </div>

          <div className="w-full mt-4">
            <nav className="flex flex-col gap-2 items-center">
              <Link
                href="/admin/orders"
                className="w-full max-w-[18.75rem] flex justify-center text-center xl:text-left px-4 py-2 rounded-md hover:bg-background-primary/10 transition-colors"
              >
                Zamówienia
              </Link>
              <Link
                href="/admin/settings"
                className="w-full max-w-[18.75rem] flex justify-center text-center xl:text-left px-4 py-2 rounded-md hover:bg-background-primary/10 transition-colors"
              >
                Ustawienia
              </Link>
              <button
                onClick={logout}
                className="w-full max-w-[18.75rem] flex justify-center text-center xl:text-left px-4 py-2 rounded-md hover:bg-background-primary/10 transition-colors"
              >
                Wyloguj
              </button>
            </nav>
          </div>
        </aside>
      </div>
    </section>
  );
}
