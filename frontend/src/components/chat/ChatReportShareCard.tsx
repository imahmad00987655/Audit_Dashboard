"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/dashboard/signature-pad";
import { Button } from "@/components/ui/button";
import { reportsApi, type DashboardFilters } from "@/lib/api";
import { REPORT_COMPONENTS } from "@/lib/report-components";
import { COMPONENT_DOMAIN } from "@/lib/data-access";
import { todayLocalIso } from "@/lib/chat-report-intent";

type Props = {
  filters: DashboardFilters;
  permissions: string[];
  isAdmin: boolean;
  domains?: string[];
  unrestricted?: boolean;
  onCancel: () => void;
  onSuccess: (info: { reportDate: string; emailStatus?: string; id: number }) => void;
};

export function ChatReportShareCard({
  filters,
  permissions,
  isAdmin,
  domains = [],
  unrestricted = false,
  onCancel,
  onSuccess,
}: Props) {
  const [remarks, setRemarks] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reportDate = todayLocalIso();

  const selectedKeys = useMemo(() => {
    if (isAdmin) return REPORT_COMPONENTS.map((c) => c.key);
    return REPORT_COMPONENTS.map((c) => c.key).filter((k) => {
      if (!permissions.includes(k)) return false;
      const domain = COMPONENT_DOMAIN[k];
      if (domain == null) return true;
      if (unrestricted) return true;
      return domains.includes(domain);
    });
  }, [isAdmin, permissions, domains, unrestricted]);

  const submit = async () => {
    if (!remarks.trim()) {
      toast.error("Remarks likhna zaroori hai");
      return;
    }
    if (!signatureImage) {
      toast.error("Pehle signature karein aur OK dabayein");
      return;
    }
    if (!selectedKeys.length) {
      toast.error("Aapke permissions mein koi reportable chart/KPI nahi");
      return;
    }

    setSubmitting(true);
    try {
      const status = await reportsApi.status(reportDate);
      if (status.data?.locked) {
        toast.error(`Aaj (${reportDate}) ki report pehle se submit / lock ho chuki hai`);
        return;
      }

      const res = await reportsApi.submitDayEnd({
        reportDate,
        remarks: remarks.trim(),
        filters,
        selectedKeys,
        signatureImage,
      });

      toast.success("Day-end report share ho gayi");
      onSuccess({
        reportDate,
        emailStatus: res.data?.emailStatus,
        id: res.data.id,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report share fail hui");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 w-full max-w-[340px] space-y-3 rounded-2xl border border-[#0055a5]/20 bg-white p-3 shadow-sm dark:border-white/15 dark:bg-[#0f1c30]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-[#0055a5] dark:text-[#fff200]">
            <FileText className="h-4 w-4" />
            Share today&apos;s report
          </p>
          <p className="mt-0.5 text-[11px] text-[#6d8499]">
            Date: {reportDate} · {selectedKeys.length} allowed components · PDF + email
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg p-1 text-[#6d8499] hover:bg-slate-100 dark:hover:bg-white/10"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6d8499]">
          Remarks *
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          disabled={submitting}
          placeholder="Aaj ki audit remarks yahan likhein…"
          className="w-full rounded-xl border border-[#0055a5]/20 bg-[#f7fbff] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0055a5]/20 disabled:opacity-60 dark:border-white/15 dark:bg-[#122238] dark:text-[#e8f1fa]"
        />
      </div>

      <SignaturePad value={signatureImage} onChange={setSignatureImage} disabled={submitting} />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 flex-1 rounded-xl"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-10 flex-1 gap-2 rounded-xl"
          disabled={submitting || !remarks.trim() || !signatureImage}
          onClick={submit}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Share & lock
        </Button>
      </div>
    </div>
  );
}
