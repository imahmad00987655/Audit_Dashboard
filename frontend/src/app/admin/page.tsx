"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
  UserCog,
  Users,
  Eye,
  EyeOff,
  Check,
  Mail,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { adminApi, type AdminComponent, type AdminUser, type ReportEmailRecipient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DATA_DOMAINS } from "@/lib/data-access";

type FormState = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "user";
  permissions: Set<string>;
  organizations: Set<string>;
  domains: Set<string>;
};

const emptyForm = (): FormState => ({
  username: "",
  email: "",
  password: "",
  fullName: "",
  role: "user",
  permissions: new Set(),
  organizations: new Set(),
  domains: new Set(),
});

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition-all duration-150 placeholder:text-slate-400 focus:border-[#0055a5]/45 focus:outline-none focus:ring-2 focus:ring-[#0055a5]/12 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 dark:border-white/10 dark:bg-[#0f1c30] dark:text-[#e8f1fa] dark:disabled:bg-[#0a1628]";

const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "One number (0–9)", test: (p: string) => /\d/.test(p) },
] as const;

function getPasswordChecks(password: string) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(password) }));
}

function isPasswordValid(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = getPasswordChecks(password);
  const metCount = checks.filter((c) => c.met).length;
  const strengthLabel =
    metCount === 0 ? "Enter a password" : metCount <= 2 ? "Weak" : metCount === 3 ? "Almost there" : "Strong";

  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-[#0a1628]/50">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Password strength
        </p>
        <span
          className={cn(
            "text-[11px] font-bold transition-colors duration-200",
            metCount === 4
              ? "text-emerald-600 dark:text-emerald-400"
              : metCount >= 2
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-400"
          )}
        >
          {strengthLabel}
        </span>
      </div>

      <div className="mb-3 flex gap-1.5">
        {checks.map((check) => (
          <div
            key={check.key}
            className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200/90 dark:bg-white/10"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-200 ease-out",
                check.met ? "w-full bg-emerald-500 dark:bg-emerald-400" : "w-0 bg-transparent"
              )}
            />
          </div>
        ))}
      </div>

      <ul className="space-y-1.5">
        {checks.map((check) => (
          <li key={check.key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                check.met
                  ? "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400"
                  : "border-slate-300 bg-white dark:border-white/20 dark:bg-transparent"
              )}
            >
              {check.met && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span
              className={cn(
                "text-xs transition-colors duration-200",
                check.met
                  ? "font-medium text-emerald-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function typeBadge(type: string) {
  return (
    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-400">
      {type}
    </span>
  );
}

function roleBadge(role: string) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        role === "admin"
          ? "bg-[#fff200]/25 text-[#0055a5] dark:bg-[#fff200]/15 dark:text-[#fff200]"
          : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
      )}
    >
      {role}
    </span>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [components, setComponents] = useState<AdminComponent[]>([]);
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [denied, setDenied] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [mobileUsersOpen, setMobileUsersOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [reportEmails, setReportEmails] = useState<ReportEmailRecipient[]>([]);
  const [newReportEmail, setNewReportEmail] = useState("");
  const [reportEmailSaving, setReportEmailSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminComponent[]>();
    for (const c of components) {
      if (!map.has(c.sectionName)) map.set(c.sectionName, []);
      map.get(c.sectionName)!.push(c);
    }
    return Array.from(map.entries());
  }, [components]);

  const enabledCount = form.permissions.size;
  const totalCount = components.length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c, emails, orgs] = await Promise.all([
        adminApi.users(),
        adminApi.components(),
        adminApi.reportEmails(),
        adminApi.organizations(),
      ]);
      setUsers(u.data);
      setComponents(c.data);
      setReportEmails(emails.data);
      setCompanyOptions(orgs.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      setDenied(true);
      setLoading(false);
      return;
    }
    setDenied(false);
    load();
  }, [authLoading, user, router, load]);

  const selectUser = (u: AdminUser) => {
    setSelectedId(u.id);
    const da = u.dataAccess;
    const orgs =
      da?.unrestricted || !da
        ? new Set(companyOptions)
        : new Set(da.organizations || []);
    const domains =
      da?.unrestricted || !da
        ? new Set(DATA_DOMAINS.map((d) => d.key))
        : new Set(da.domains || []);
    setForm({
      username: u.username,
      email: u.email,
      password: "",
      fullName: u.fullName,
      role: u.role,
      permissions: new Set(u.permissions || []),
      organizations: orgs,
      domains,
    });
    setMobileUsersOpen(false);
    setShowPassword(false);
    setPasswordFocused(false);
  };

  // If companies load after selecting an unrestricted / legacy user, fill company checkboxes
  useEffect(() => {
    if (!companyOptions.length || typeof selectedId !== "number") return;
    const u = users.find((x) => x.id === selectedId);
    if (!u || u.role === "admin") return;
    const restricted =
      u.dataAccess &&
      !u.dataAccess.unrestricted &&
      (u.dataAccess.organizations?.length || 0) > 0;
    if (restricted) return;
    setForm((f) => {
      if (f.role !== "user" || f.organizations.size > 0) return f;
      return {
        ...f,
        organizations: new Set(companyOptions),
        domains: f.domains.size ? f.domains : new Set(DATA_DOMAINS.map((d) => d.key)),
      };
    });
  }, [companyOptions, selectedId, users]);

  const startNew = () => {
    setSelectedId("new");
    setForm(emptyForm());
    setMobileUsersOpen(false);
    setShowPassword(false);
    setPasswordFocused(false);
  };

  const togglePerm = (key: string) => {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, permissions: next };
    });
  };

  const toggleOrg = (name: string) => {
    setForm((f) => {
      const next = new Set(f.organizations);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...f, organizations: next };
    });
  };

  const toggleDomain = (key: string) => {
    setForm((f) => {
      const next = new Set(f.domains);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, domains: next };
    });
  };

  const selectSection = (keys: string[], on: boolean) => {
    setForm((f) => {
      const next = new Set(f.permissions);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return { ...f, permissions: next };
    });
  };

  const toggleSectionCollapse = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const removeReportEmail = async (id: number) => {
    try {
      await adminApi.deleteReportEmail(id);
      setReportEmails((prev) => prev.filter((e) => e.id !== id));
      toast.success("Recipient removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove email");
    }
  };

  const addReportEmail = async () => {
    const email = newReportEmail.trim();
    if (!email) {
      toast.error("Enter an email address");
      return;
    }
    setReportEmailSaving(true);
    try {
      const res = await adminApi.addReportEmail(email);
      setReportEmails((prev) => [...prev, res.data].sort((a, b) => a.email.localeCompare(b.email)));
      setNewReportEmail("");
      toast.success("Recipient added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add email");
    } finally {
      setReportEmailSaving(false);
    }
  };

  const save = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.fullName.trim()) {
      toast.error("Username, email, and full name are required");
      return;
    }
    if (selectedId === "new" && !isPasswordValid(form.password)) {
      toast.error("Password must be at least 8 characters with uppercase, lowercase, and a number");
      return;
    }
    if (selectedId !== "new" && form.password && !isPasswordValid(form.password)) {
      toast.error("New password must be at least 8 characters with uppercase, lowercase, and a number");
      return;
    }
    if (form.role === "user") {
      if (form.organizations.size === 0) {
        toast.error("Select at least one company for data access");
        return;
      }
      if (form.domains.size === 0) {
        toast.error("Select at least one data type (PR, PO, Spend, …)");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        permissions: [...form.permissions],
        dataAccess: {
          organizations: [...form.organizations],
          domains: [...form.domains],
        },
        ...(form.password ? { password: form.password } : {}),
      };

      if (selectedId === "new") {
        const res = await adminApi.createUser(payload as Parameters<typeof adminApi.createUser>[0]);
        toast.success("User created");
        setSelectedId(res.data.id);
        setForm((f) => ({ ...f, password: "" }));
      } else if (typeof selectedId === "number") {
        await adminApi.updateUser(selectedId, payload);
        toast.success("User updated");
        setForm((f) => ({ ...f, password: "" }));
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (typeof selectedId !== "number") return;
    if (!confirm("Delete this user permanently?")) return;
    try {
      await adminApi.deleteUser(selectedId);
      toast.success("User deleted");
      setSelectedId(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const selectedUserLabel = useMemo(() => {
    if (selectedId === "new") return "Create new user";
    if (typeof selectedId === "number") {
      const u = users.find((x) => x.id === selectedId);
      return u ? u.fullName : "Select user";
    }
    return "Select user";
  }, [selectedId, users]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] dark:bg-[#0a1628]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#0055a5]" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading admin console…</p>
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f4f7fb] px-4 text-center dark:bg-[#0a1628]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
          <Shield className="h-8 w-8 text-[#e31e24]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#e8f1fa]">Admin access only</h1>
          <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Aap <strong className="text-slate-700 dark:text-slate-200">{user?.username}</strong> se login
            hain — ye account normal user hai. Admin panel ke liye <strong>admin</strong> account se login
            karein.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl bg-[#0055a5] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2f7ec4]"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0055a5] transition-colors duration-150 hover:bg-slate-50 dark:border-white/10 dark:bg-[#122238] dark:text-[#7eb6e8] dark:hover:bg-[#0f1c30]"
          >
            Logout & admin login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#0a1628]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#004080]/20 bg-linear-to-r from-[#0055a5] to-[#0068c9] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
              <Shield className="h-5 w-5 text-[#fff200]" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                Admin Panel
              </h1>
              <p className="truncate text-xs text-white/75 sm:text-[13px]">
                Users & dashboard permissions
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold text-white transition-all duration-150 hover:border-white/35 hover:bg-white/20 active:scale-[0.98] sm:px-4"
          >
            <LayoutDashboard className="h-4 w-4 opacity-90" />
            <span className="hidden sm:inline">Dashboard</span>
            <ArrowLeft className="h-4 w-4 sm:hidden" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Mobile user selector */}
        <div className="mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileUsersOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left shadow-sm transition-colors duration-150 hover:bg-slate-50 dark:border-white/10 dark:bg-[#122238] dark:hover:bg-[#0f1c30]"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active user</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-[#e8f1fa]">{selectedUserLabel}</p>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-slate-400 transition-transform duration-200",
                mobileUsersOpen && "rotate-180"
              )}
            />
          </button>
          {mobileUsersOpen && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#122238]">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-white/10">
                <span className="text-xs font-semibold text-slate-500">Users</span>
                <Button size="sm" variant="ghost" onClick={startNew} className="h-8 gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> New
                </Button>
              </div>
              <ul className="max-h-56 overflow-y-auto p-1.5 admin-scroll">
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => selectUser(u)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150",
                        selectedId === u.id
                          ? "bg-[#0055a5]/8 ring-1 ring-[#0055a5]/25 dark:bg-[#3d9ae8]/10 dark:ring-[#3d9ae8]/30"
                          : "hover:bg-slate-50 dark:hover:bg-[#0f1c30]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-[#e8f1fa]">
                          {u.fullName}
                        </span>
                        {roleBadge(u.role)}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">@{u.username}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:gap-6 xl:grid-cols-[320px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[4.5rem] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#122238] dark:shadow-none">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-[#e8f1fa]">
                  <Users className="h-4 w-4 text-[#0055a5] dark:text-[#7eb6e8]" />
                  Users
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10">
                    {users.length}
                  </span>
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startNew}
                  className="h-8 gap-1 rounded-lg border-slate-200 text-xs transition-all duration-150 hover:border-[#0055a5]/30 dark:border-white/15"
                >
                  <Plus className="h-3.5 w-3.5" /> New
                </Button>
              </div>
              <ul className="space-y-1 admin-scroll max-h-[calc(100vh-12rem)] overflow-y-auto pr-0.5">
                {users.map((u) => {
                  const active = selectedId === u.id;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => selectUser(u)}
                        className={cn(
                          "group relative w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150",
                          active
                            ? "bg-[#0055a5]/6 shadow-sm ring-1 ring-[#0055a5]/20 dark:bg-[#3d9ae8]/8 dark:ring-[#3d9ae8]/25"
                            : "hover:bg-slate-50 dark:hover:bg-[#0f1c30]"
                        )}
                      >
                        {active && (
                          <span className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-[#0055a5] dark:bg-[#3d9ae8]" />
                        )}
                        <div className={cn("flex items-start justify-between gap-2", active && "pl-2")}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-[#e8f1fa]">
                              {u.fullName}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              @{u.username}
                            </p>
                          </div>
                          {roleBadge(u.role)}
                        </div>
                        {!u.isActive && (
                          <p className={cn("mt-1 text-[10px] font-medium text-amber-600", active && "pl-2")}>
                            Inactive
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Main panel */}
          <section className="min-w-0">
            {!selectedId ? (
              <div className="space-y-5">
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-white/80 px-6 py-12 text-center dark:border-white/10 dark:bg-[#122238]/50">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5">
                    <UserCog className="h-7 w-7 text-slate-400" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-800 dark:text-[#e8f1fa]">
                    Select a user to manage
                  </h2>
                  <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                    Choose someone from the list or create a new account with custom dashboard permissions.
                  </p>
                  <Button onClick={startNew} className="mt-5 gap-2 rounded-xl">
                    <Plus className="h-4 w-4" /> Create user
                  </Button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#122238] dark:shadow-none">
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:px-6">
                    <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-[#e8f1fa]">
                      <Mail className="h-5 w-5 text-[#0055a5] dark:text-[#7eb6e8]" />
                      Day-End Report Emails
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      These recipients receive the PDF automatically when a day-end report is submitted.
                    </p>
                  </div>

                  <div className="space-y-4 px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={newReportEmail}
                        onChange={(e) => setNewReportEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addReportEmail();
                          }
                        }}
                        placeholder="manager@company.com"
                        className={inputClass}
                      />
                      <Button
                        onClick={addReportEmail}
                        disabled={reportEmailSaving || !newReportEmail.trim()}
                        className="h-11 shrink-0 gap-2 rounded-xl px-5 sm:w-auto"
                      >
                        {reportEmailSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Add recipient
                      </Button>
                    </div>

                    {reportEmails.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 px-4 py-8 text-center dark:border-white/10 dark:bg-[#0a1628]/40">
                        <Mail className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          No recipients yet
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Add at least one email to enable day-end report delivery.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 dark:divide-white/5 dark:border-white/10">
                        {reportEmails.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 bg-white px-4 py-3 transition-colors duration-150 hover:bg-slate-50 dark:bg-[#122238] dark:hover:bg-[#0f1c30]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800 dark:text-[#e8f1fa]">
                                {item.email}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Added {new Date(item.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReportEmail(item.id)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors duration-150 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
                              aria-label={`Remove ${item.email}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {reportEmails.length} recipient{reportEmails.length === 1 ? "" : "s"} configured
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#122238] dark:shadow-none">
                {/* Panel header */}
                <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:px-6">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-[#e8f1fa]">
                    {selectedId === "new" ? "Create user" : "Edit user"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Account details, company data access, and dashboard permissions
                  </p>
                </div>

                <div className="space-y-8 px-5 py-6 sm:px-6">
                  {/* Form */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>Username</span>
                      <input
                        value={form.username}
                        disabled={selectedId !== "new"}
                        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                        className={inputClass}
                        placeholder="Username"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Full name</span>
                      <input
                        value={form.fullName}
                        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                        className={inputClass}
                        placeholder="Full name"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Email</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className={inputClass}
                        placeholder="user@company.com"
                      />
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-1">
                      <span className={labelClass}>
                        Password {selectedId !== "new" && "(leave blank to keep)"}
                      </span>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                          className={cn(inputClass, "pr-11")}
                          placeholder={selectedId === "new" ? "Create a strong password" : "••••••••"}
                          autoComplete={selectedId === "new" ? "new-password" : "off"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-[#0055a5] dark:hover:bg-white/10 dark:hover:text-[#7eb6e8]"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {(selectedId === "new" || form.password.length > 0) &&
                        (passwordFocused || form.password.length > 0) && (
                          <PasswordRequirements password={form.password} />
                        )}
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-1">
                      <span className={labelClass}>Role</span>
                      <select
                        value={form.role}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, role: e.target.value as "admin" | "user" }))
                        }
                        className={cn(inputClass, "cursor-pointer")}
                      >
                        <option value="user">User — custom permissions</option>
                        <option value="admin">Admin — full access</option>
                      </select>
                    </label>
                  </div>

                  {/* Data access: companies + domains */}
                  {form.role === "user" && (
                    <div className="space-y-6">
                      <div>
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-[#e8f1fa]">
                              Company data access
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                              Which companies this user can see in filters and charts.
                            </p>
                            <p className="mt-2 inline-flex items-center rounded-lg bg-[#0055a5]/8 px-2.5 py-1 text-xs font-semibold text-[#0055a5] dark:bg-[#3d9ae8]/15 dark:text-[#7eb6e8]">
                              {form.organizations.size} / {companyOptions.length || "?"} companies
                            </p>
                          </div>
                          <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({ ...f, organizations: new Set(companyOptions) }))
                              }
                              className="px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                            >
                              Select all
                            </button>
                            <span className="w-px bg-slate-200 dark:bg-white/10" />
                            <button
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, organizations: new Set() }))}
                              className="px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {companyOptions.length === 0 ? (
                            <p className="text-sm text-slate-500 sm:col-span-2">
                              No companies loaded from live data yet.
                            </p>
                          ) : (
                            companyOptions.map((name) => {
                              const on = form.organizations.has(name);
                              return (
                                <label
                                  key={name}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-150",
                                    on
                                      ? "border-[#0055a5]/35 bg-[#0055a5]/5 dark:border-[#3d9ae8]/40 dark:bg-[#3d9ae8]/10"
                                      : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f1c30] dark:hover:bg-white/5"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleOrg(name)}
                                    className="h-4 w-4 rounded border-slate-300 text-[#0055a5] focus:ring-[#0055a5]"
                                  />
                                  <span className="text-sm font-medium text-slate-800 dark:text-[#e8f1fa]">
                                    {name}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-[#e8f1fa]">
                              Data types
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                              Within allowed companies — which data areas to show (PR, PO, Spend, GRN…).
                            </p>
                            <p className="mt-2 inline-flex items-center rounded-lg bg-[#0055a5]/8 px-2.5 py-1 text-xs font-semibold text-[#0055a5] dark:bg-[#3d9ae8]/15 dark:text-[#7eb6e8]">
                              {form.domains.size} / {DATA_DOMAINS.length} enabled
                            </p>
                          </div>
                          <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  domains: new Set(DATA_DOMAINS.map((d) => d.key)),
                                }))
                              }
                              className="px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                            >
                              Select all
                            </button>
                            <span className="w-px bg-slate-200 dark:bg-white/10" />
                            <button
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, domains: new Set() }))}
                              className="px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {DATA_DOMAINS.map((d) => {
                            const on = form.domains.has(d.key);
                            return (
                              <label
                                key={d.key}
                                className={cn(
                                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-150",
                                  on
                                    ? "border-[#0055a5]/35 bg-[#0055a5]/5 dark:border-[#3d9ae8]/40 dark:bg-[#3d9ae8]/10"
                                    : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f1c30] dark:hover:bg-white/5"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleDomain(d.key)}
                                  className="h-4 w-4 rounded border-slate-300 text-[#0055a5] focus:ring-[#0055a5]"
                                />
                                <span className="text-sm font-medium text-slate-800 dark:text-[#e8f1fa]">
                                  {d.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Permissions */}
                  {form.role === "user" && (
                    <div>
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-[#e8f1fa]">
                            Dashboard permissions
                          </h3>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            Control which sections, charts, and tables this user can see.
                          </p>
                          <p className="mt-2 inline-flex items-center rounded-lg bg-[#0055a5]/8 px-2.5 py-1 text-xs font-semibold text-[#0055a5] dark:bg-[#3d9ae8]/15 dark:text-[#7eb6e8]">
                            {enabledCount} / {totalCount} enabled
                          </p>
                        </div>
                        <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() =>
                              selectSection(
                                components.map((c) => c.componentKey),
                                true
                              )
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            Select all
                          </button>
                          <span className="w-px bg-slate-200 dark:bg-white/10" />
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, permissions: new Set() }))}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            Clear all
                          </button>
                        </div>
                      </div>

                      <div className="max-h-[min(560px,60vh)] space-y-3 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 admin-scroll dark:border-white/10 dark:bg-[#0a1628]/40 sm:p-4">
                        {grouped.map(([section, items]) => {
                          const keys = items.map((i) => i.componentKey);
                          const sectionEnabled = keys.filter((k) => form.permissions.has(k)).length;
                          const collapsed = collapsedSections[section] ?? false;
                          const allOn = keys.every((k) => form.permissions.has(k));

                          return (
                            <div
                              key={section}
                              className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#122238]"
                            >
                              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
                                <button
                                  type="button"
                                  onClick={() => toggleSectionCollapse(section)}
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors duration-150 hover:opacity-80"
                                  aria-expanded={!collapsed}
                                >
                                  {collapsed ? (
                                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                      {section}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {sectionEnabled} / {items.length} enabled
                                    </p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectSection(keys, !allOn)}
                                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#0055a5] transition-colors duration-150 hover:bg-[#0055a5]/8 dark:text-[#7eb6e8] dark:hover:bg-[#3d9ae8]/10"
                                >
                                  {allOn ? "Clear" : "Select all"}
                                </button>
                              </div>

                              {!collapsed && (
                                <ul className="divide-y divide-slate-100 dark:divide-white/5">
                                  {items.map((item) => {
                                    const checked = form.permissions.has(item.componentKey);
                                    return (
                                      <li key={item.componentKey}>
                                        <label
                                          className={cn(
                                            "flex min-h-[54px] cursor-pointer items-center gap-3 px-4 py-2 transition-colors duration-150",
                                            "hover:bg-slate-50 focus-within:bg-slate-50 dark:hover:bg-[#0f1c30] dark:focus-within:bg-[#0f1c30]",
                                            checked && "bg-[#0055a5]/4 dark:bg-[#3d9ae8]/5"
                                          )}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => togglePerm(item.componentKey)}
                                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#0055a5] transition duration-150 focus:ring-2 focus:ring-[#0055a5]/25 dark:border-white/20"
                                          />
                                          <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-[#e8f1fa]">
                                            {item.title}
                                          </span>
                                          {typeBadge(item.componentType)}
                                        </label>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {form.role === "admin" && (
                    <div className="flex items-start gap-3 rounded-xl border border-[#fff200]/40 bg-[#fff200]/10 px-4 py-3.5 dark:border-[#fff200]/20 dark:bg-[#fff200]/5">
                      <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#0055a5] dark:text-[#fff200]" />
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        Admin users automatically receive full company data access, all dashboard
                        widgets, and can manage this panel.
                      </p>
                    </div>
                  )}
                </div>

                {/* Sticky action bar */}
                <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-[#122238]/95 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={save}
                      disabled={saving}
                      className="h-11 gap-2 rounded-xl px-5 shadow-sm transition-all duration-150 active:scale-[0.98]"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save changes
                    </Button>
                    {typeof selectedId === "number" && selectedId !== user?.id && (
                      <Button
                        variant="outline"
                        onClick={remove}
                        className="h-11 gap-2 rounded-xl border-red-200 text-red-600 transition-all duration-150 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" /> Delete user
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <style jsx global>{`
        .admin-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 85, 165, 0.35) transparent;
        }
        .admin-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .admin-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 85, 165, 0.28);
          border-radius: 999px;
        }
        .admin-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 85, 165, 0.45);
        }
      `}</style>
    </div>
  );
}
