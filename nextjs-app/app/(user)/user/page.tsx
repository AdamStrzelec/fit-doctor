"use client";

import React, { useEffect, useState } from "react";
import NextImage from "next/image";
import { useSession, signOut } from "next-auth/react";
import { List, Clipboard, TrendingUp, Gift, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import imagePlaceholder from "@/public/assets/user-img-placeholder.jpg";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/app/components/atoms/ButtonLink";

export default function DashboardPage() {
  const { data: sessionData } = useSession();
  const [userMeta, setUserMeta] = useState<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null>(null);

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [subscriptionPlanName, setSubscriptionPlanName] = useState<
    string | null
  >(null);
  const [currentPlanName, setCurrentPlanName] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // fetch user meta from /api/user/me
  useEffect(() => {
    const fetchUser = async () => {
      if (!sessionData?.user?.email) return;
      try {
        const res = await fetch("/api/user/me");
        if (!res.ok) return;
        const json = await res.json();
        setUserMeta(json.user || null);
      } catch (err) {
        console.error("fetch /api/user/me error", err);
      }
    };
    fetchUser();
  }, [sessionData?.user?.email]);

  const getUserPlan = async (email: string) => {
    setLoadingPlan(true);
    try {
      const res = await fetch("/api/plans/user-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSubscriptionId(data.subscriptionId || null);
      setCurrentPlanName(data.plan?.name || null);
      setSubscriptionPlanName(data.plan?.name || null);
      setCurrentPeriodEnd(Boolean(data.cancelAtPeriodEnd));
    } catch (err) {
      console.error("getUserPlan error", err);
    } finally {
      setLoadingPlan(false);
    }
  };

  const logout = () => {
    signOut();
    redirect("/");
  };

  useEffect(() => {
    if (sessionData?.user?.email) {
      getUserPlan(sessionData.user.email);
    }
  }, [sessionData?.user?.email]);

  const avatarSrc = sessionData?.user?.image ?? undefined;

  return (
    <section className="min-h-screen bg-background-primary py-16 px-4 lg:px-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="col-span-1 bg-background-card rounded-2xl p-6 flex flex-col items-center gap-4">
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
            {userMeta?.phone ? (
              <p className="text-sm text-color-tertiary mt-1">
                {userMeta.phone}
              </p>
            ) : null}
          </div>

          <div className="w-full mt-4">
            <nav className="flex flex-col gap-2 items-center">
              <Link
                href="/user/profile"
                className="w-full max-w-[300px] block text-center xl:text-left px-4 py-2 rounded-md hover:bg-background-primary/10 transition-colors"
              >
                Ustawienia konta
              </Link>
              <Link
                href="/user/payments"
                className="w-full max-w-[300px] block text-center xl:text-left px-4 py-2 rounded-md hover:bg-background-primary/10 transition-colors"
              >
                Płatności
              </Link>
              <button
                onClick={logout}
                className="w-full max-w-[300px] block text-center xl:text-left px-4 py-2 rounded-md hover:bg-background-primary/10 transition-colors"
              >
                Wyloguj
              </button>
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="col-span-1 lg:col-span-3">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-color-secondary">
              Twój panel
            </h1>
            <p className="text-color-tertiary mt-2 max-w-2xl">
              Witaj w swoim panelu! Tutaj możesz zarządzać ćwiczeniami,
              treningami i subskrypcją.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-background-card p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-color-primary/10 flex items-center justify-center">
                  <List className="w-6 h-6 text-color-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-color-primary">
                    Moja siłownia
                  </h3>
                  <p className="text-sm text-color-tertiary mt-1">
                    Zarządzaj swoimi ćwiczeniami i planami treningowymi.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button asChild>
                  <Link
                    href="/user/gym"
                    className="w-full inline-flex justify-center"
                  >
                    Otwórz siłownię
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl bg-background-card p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-color-primary/10 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-color-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-color-primary">
                    Subskrypcja
                  </h3>
                  <p className="text-sm text-color-tertiary mt-1">
                    Zarządzaj swoim planem i płatnościami.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {loadingPlan ? (
                  <p className="text-sm text-color-tertiary">
                    Ładowanie informacji o subskrypcji…
                  </p>
                ) : subscriptionPlanName ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-color-tertiary">Plan:</p>
                        <p className="font-medium">{currentPlanName}</p>
                      </div>
                      <div className="text-right">
                        {currentPeriodEnd ? (
                          <p className="text-sm text-color-tertiary">
                            Anulowano — dostęp do końca okresu
                          </p>
                        ) : (
                          <p className="text-sm text-color-tertiary">Aktywna</p>
                        )}
                      </div>
                    </div>

                    {!currentPeriodEnd ? (
                      <div className="flex gap-2">
                        <ButtonLink
                          href="/user/payments"
                          text="Zarządzaj subskrypcją"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-color-tertiary mb-3">
                      Brak aktywnej subskrypcji.
                    </p>
                    <ButtonLink href="/plans" text="Wybierz plan" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional actions / info */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-background-card p-6">
              <h4 className="text-md font-semibold text-color-primary">
                Szybkie akcje
              </h4>
              <div className="mt-3 flex flex-col gap-3">
                <Link
                  href="/user/gym/exercises"
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-background-primary/10"
                >
                  <List className="w-5 h-5 text-color-primary" />
                  <span className="text-sm">Zarządzaj ćwiczeniami</span>
                </Link>
                <Link
                  href="/user/gym/trainings"
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-background-primary/10"
                >
                  <Clipboard className="w-5 h-5 text-color-primary" />
                  <span className="text-sm">Zarządzaj treningami</span>
                </Link>
                <Link
                  href="/user/gym/progress"
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-background-primary/10"
                >
                  <TrendingUp className="w-5 h-5 text-color-primary" />
                  <span className="text-sm">Progres</span>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl bg-background-card p-6">
              <h4 className="text-md font-semibold text-color-primary">
                Pomoc i ustawienia
              </h4>
              <div className="mt-3 flex flex-col gap-3">
                <Link
                  href="/user/profile"
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-background-primary/10"
                >
                  <List className="w-5 h-5 text-color-primary" />
                  <span className="text-sm">Ustawienia konta</span>
                </Link>
                <Link
                  href="/help"
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-background-primary/10"
                >
                  <XCircle className="w-5 h-5 text-color-primary" />
                  <span className="text-sm">Kontakt / pomoc</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
