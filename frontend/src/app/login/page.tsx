"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  FileSearch,
  ClipboardCheck,
  Radio,
  Fingerprint,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatAuditClock(date: Date) {
  return new Intl.DateTimeFormat("en-PK", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export default function LoginPage() {
  const { login, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#071325] text-[#7eb6e8]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="font-mono text-[10px] uppercase tracking-[0.35em]">Opening audit vault</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071325] text-[#e8f1fa]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(126,182,232,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(126,182,232,0.18) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 12% 18%, rgba(0,85,165,0.45), transparent 58%), radial-gradient(50% 40% at 92% 8%, rgba(227,30,36,0.18), transparent 50%), radial-gradient(40% 30% at 80% 90%, rgba(255,242,0,0.08), transparent 55%)",
        }}
      />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="hidden lg:block">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1c34]/80 p-10 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="login-scan pointer-events-none absolute left-0 right-0 h-24 bg-linear-to-b from-transparent via-[#fff200]/12 to-transparent" />

            <div className="mb-8 flex items-center justify-between">
              <span className="rounded-full border border-[#fff200]/40 bg-[#fff200]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#fff200]">
                Restricted access
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[#7eb6e8]">
                <Radio className="h-3 w-3 animate-pulse text-[#37b767]" />
                Vault online
              </span>
            </div>

            <div className="login-float relative mb-8 flex h-28 w-28 items-center justify-center">
              <span className="login-pulse-ring absolute inset-0 rounded-full border border-[#fff200]/40" />
              <span className="absolute inset-2 rounded-full border border-[#0055a5]/50" />
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-[3px] border-[#fff200] bg-white shadow-lg">
                <Image src="/master-logo.png" alt="Master Group of Industries" fill sizes="80px" className="object-cover" priority />
              </div>
            </div>

            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.42em] text-[#7eb6e8]">Master Group of Industries</p>
            <h1 className="font-display text-4xl font-bold leading-tight text-white">
              Internal Audit
              <span className="block text-[#fff200]">Department</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#9aa8b8]">
              Authorized officers only. Procurement, GRN, and day-end audit evidence is logged against your session.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { icon: FileSearch, label: "PR / PO trail" },
                { icon: ClipboardCheck, label: "Day-end lock" },
                { icon: Fingerprint, label: "Named access" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4">
                  <item.icon className="mb-2 h-4 w-4 text-[#fff200]" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#e8f1fa]">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-end justify-between border-t border-white/10 pt-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#6d8499]">Session clock · PKT</p>
                <p className="mt-1 font-mono text-sm text-[#fff200]">{now ? formatAuditClock(now) : "—"}</p>
              </div>
              <p className="max-w-40 text-right font-mono text-[10px] uppercase leading-relaxed tracking-wider text-[#6d8499]">
                Confidential
                <br />
                Internal use only
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_24px_70px_rgba(0,30,70,0.35)] dark:border-white/10 dark:bg-[#122238]">
            <div className="flex h-1.5">
              <span className="w-[62%] bg-[#0055a5]" />
              <span className="w-[22%] bg-[#fff200]" />
              <span className="w-[16%] bg-[#e31e24]" />
            </div>

            <div className="p-7 sm:p-8">
              <div className="mb-6 flex items-center gap-4 lg:hidden">
                <div className="relative h-14 w-14 overflow-hidden rounded-xl border-2 border-[#fff200] bg-white">
                  <Image src="/master-logo.png" alt="Master Group" fill sizes="56px" className="object-cover" priority />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#0055a5] dark:text-[#7eb6e8]">
                    Master Group
                  </p>
                  <h2 className="text-lg font-bold text-[#0055a5] dark:text-[#fff200]">Audit Department</h2>
                </div>
              </div>

              <div className="mb-1 hidden lg:block">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#0055a5] dark:text-[#7eb6e8]">
                  Officer sign-in
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#0a1628] dark:text-white">
                  Enter the audit desk
                </h2>
              </div>
              <p className="mb-6 mt-2 text-sm text-[#6d8499] dark:text-[#9aa8b8]">
                Use your assigned audit credentials. Activity is recorded for compliance.
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d8499]">
                    Audit username
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. audit.officer"
                    autoComplete="username"
                    required
                    className="h-11 rounded-xl border-[#0055a5]/25 bg-[#f7fbff] px-3.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d8499]">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter secure password"
                      autoComplete="current-password"
                      required
                      className="h-11 rounded-xl border-[#0055a5]/25 bg-[#f7fbff] px-3.5 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#6d8499] hover:bg-[#eef5fc] hover:text-[#0055a5] dark:hover:bg-white/10"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-[#e31e24]/30 bg-[#fff5f5] px-3 py-2.5 text-sm text-[#e31e24] dark:bg-[#2a1518]">
                    {error}
                  </div>
                )}

                <Button type="submit" className="h-12 w-full rounded-xl text-[15px]" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying officer…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Access audit dashboard
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 flex items-center gap-2 rounded-xl border border-[#0055a5]/10 bg-[#eef5fc] px-3 py-2.5 text-xs text-[#2a4a6e] dark:border-white/10 dark:bg-[#0f1c30] dark:text-[#9aa8b8]">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#0055a5] dark:text-[#7eb6e8]" />
                Encrypted session · Internal Audit · Master Group of Industries
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
