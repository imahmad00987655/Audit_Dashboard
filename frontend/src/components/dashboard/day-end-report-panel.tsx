"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  FileText,
  Lock,
  CheckSquare,
  Square,
  Loader2,
  Send,
  Download,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboard } from "@/context/dashboard-context";
import { reportsApi } from "@/lib/api";
import { groupComponentsBySection, REPORT_COMPONENTS } from "@/lib/report-components";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/dashboard/signature-pad";
import { usePermission } from "@/hooks/use-permission";

interface DayEndReportPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DayEndReportPanel({ open, onClose }: DayEndReportPanelProps) {
  const { filters } = useDashboard();
  const { can } = usePermission();
  const queryClient = useQueryClient();
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [remarks, setRemarks] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [submittedReportId, setSubmittedReportId] = useState<number | null>(null);

  const allowedComponents = useMemo(
    () => REPORT_COMPONENTS.filter((c) => can(c.key)),
    [can]
  );

  const statusQ = useQuery({
    queryKey: ["report-status", reportDate],
    queryFn: () => reportsApi.status(reportDate),
    enabled: open,
  });

  const locked = statusQ.data?.data?.locked ?? false;

  useEffect(() => {
    if (!open) {
      setSelectedKeys([]);
      setRemarks("");
      setSignatureImage(null);
      setSubmittedReportId(null);
    }
  }, [open]);

  // Drop any previously selected keys the user is no longer allowed to see
  useEffect(() => {
    const allowed = new Set(allowedComponents.map((c) => c.key));
    setSelectedKeys((prev) => prev.filter((k) => allowed.has(k)));
  }, [allowedComponents]);

  const grouped = useMemo(() => groupComponentsBySection(allowedComponents), [allowedComponents]);

  const toggleKey = (key: string) => {
    if (locked) return;
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const selectAll = () => {
    if (locked) return;
    setSelectedKeys(allowedComponents.map((c) => c.key));
  };

  const clearAll = () => {
    if (locked) return;
    setSelectedKeys([]);
  };

  const selectSection = (keys: string[]) => {
    if (locked || !keys.length) return;
    setSelectedKeys((prev) => Array.from(new Set([...prev, ...keys])));
  };

  const clearSection = (keys: string[]) => {
    if (locked || !keys.length) return;
    const drop = new Set(keys);
    setSelectedKeys((prev) => prev.filter((k) => !drop.has(k)));
  };

  const isSectionFullySelected = (keys: string[]) =>
    keys.length > 0 && keys.every((k) => selectedKeys.includes(k));

  const toggleSection = (keys: string[]) => {
    if (isSectionFullySelected(keys)) clearSection(keys);
    else selectSection(keys);
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      reportsApi.submitDayEnd({
        reportDate,
        remarks: remarks.trim(),
        filters,
        selectedKeys,
        signatureImage: signatureImage!,
      }),
    onSuccess: (res) => {
      setSubmittedReportId(res.data.id);
      queryClient.invalidateQueries({ queryKey: ["report-status", reportDate] });
      toast.success("Day-end report submitted and locked for this date.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      reportsApi.previewPdf({
        reportDate,
        remarks: remarks.trim() || "Preview",
        filters,
        selectedKeys,
        signatureImage,
      }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `day-end-preview-${reportDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF preview downloaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadSubmittedPdf = async () => {
    const id = submittedReportId || statusQ.data?.data?.report?.id;
    if (!id) return;
    try {
      const token = localStorage.getItem("audit_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.209:5057"}/reports/day-end/${id}/pdf`,
        {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `day-end-${reportDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  const showRemarks = selectedKeys.length > 0 && !locked;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-[#0055a5]/15 bg-white shadow-2xl dark:border-white/10 dark:bg-[#122238]"
          >
            <div className="flex items-center justify-between border-b border-[#0055a5]/10 px-5 py-4 dark:border-white/10">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#0055a5] dark:text-[#fff200]">
                  <FileText className="h-5 w-5" /> Day-End Report
                </h2>
                <p className="text-xs text-[#6d8499]">
                  Only your allowed charts / companies · remarks · sign · PDF & email
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6d8499]">
                  <CalendarDays className="h-3.5 w-3.5" /> Report Date
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  disabled={locked}
                  className="w-full rounded-xl border border-[#0055a5]/20 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#0f1c30]"
                />
              </div>

              {statusQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#6d8499]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking date lock…
                </div>
              ) : locked ? (
                <div className="rounded-xl border border-[#e31e24]/25 bg-[#fff5f5] p-4 dark:bg-[#2a1518]">
                  <div className="flex items-center gap-2 font-semibold text-[#e31e24]">
                    <Lock className="h-4 w-4" /> Remarks locked for {reportDate}
                  </div>
                  <p className="mt-2 text-sm text-[#6d8499]">
                    A day-end report was already submitted for this date. No further submissions are allowed.
                  </p>
                  {statusQ.data?.data?.report && (
                    <div className="mt-3 text-xs text-[#2a4a6e] dark:text-[#9aa8b8]">
                      Submitted: {new Date(statusQ.data.data.report.submittedAt).toLocaleString()}
                      <br />
                      Email: {statusQ.data.data.report.emailStatus}
                    </div>
                  )}
                  <Button className="mt-3" variant="secondary" size="sm" onClick={downloadSubmittedPdf}>
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#2a4a6e] dark:text-[#e8f1fa]">
                      Select charts & tables ({selectedKeys.length} selected)
                    </p>
                    <div className="flex gap-2">
                      <button type="button" className="text-xs font-semibold text-[#0055a5]" onClick={selectAll}>
                        Select all
                      </button>
                      <button type="button" className="text-xs font-semibold text-[#6d8499]" onClick={clearAll}>
                        Clear
                      </button>
                    </div>
                  </div>

                  {allowedComponents.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#0055a5]/20 bg-[#f8fbfe] px-4 py-6 text-center text-sm text-[#6d8499] dark:border-white/10 dark:bg-[#0f1c30]">
                      No reportable charts or KPIs in your assigned access. Ask an admin to grant dashboard
                      permissions / data types.
                    </p>
                  ) : (
                    grouped.map(([section, items]) => {
                      const sectionKeys = items.map((i) => i.key);
                      const sectionSelected = sectionKeys.filter((k) => selectedKeys.includes(k)).length;
                      const allSelected = isSectionFullySelected(sectionKeys);
                      return (
                    <div key={section}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSection(sectionKeys)}
                          disabled={locked}
                          className="flex min-w-0 items-center gap-2 text-left"
                          title={allSelected ? "Clear this section" : "Select all in this section"}
                        >
                          {allSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 shrink-0 text-[#0055a5]" />
                          ) : (
                            <Square className="h-3.5 w-3.5 shrink-0 text-[#6d8499]" />
                          )}
                          <h3 className="truncate text-xs font-bold uppercase tracking-wider text-[#0055a5] dark:text-[#7eb6e8]">
                            {section}
                          </h3>
                          <span className="shrink-0 text-[10px] font-semibold text-[#6d8499]">
                            {sectionSelected}/{sectionKeys.length}
                          </span>
                        </button>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-[#0055a5] hover:underline disabled:opacity-40"
                            onClick={() => selectSection(sectionKeys)}
                            disabled={locked || allSelected}
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-[#6d8499] hover:underline disabled:opacity-40"
                            onClick={() => clearSection(sectionKeys)}
                            disabled={locked || sectionSelected === 0}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {items.map((item) => {
                          const checked = selectedKeys.includes(item.key);
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => toggleKey(item.key)}
                              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                                checked
                                  ? "border-[#0055a5]/40 bg-[#eef5fc] dark:border-[#3d9ae8]/40 dark:bg-[#0f1c30]"
                                  : "border-[#0055a5]/10 bg-white hover:bg-[#f8fbfe] dark:border-white/10 dark:bg-[#122238] dark:hover:bg-[#1a2d4a]"
                              }`}
                            >
                              {checked ? (
                                <CheckSquare className="h-4 w-4 shrink-0 text-[#0055a5]" />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-[#6d8499]" />
                              )}
                              <span>
                                <span className="font-medium text-[#2a4a6e] dark:text-[#e8f1fa]">{item.title}</span>
                                <span className="ml-2 text-[10px] uppercase text-[#6d8499]">{item.type}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                      );
                    })
                  )}

                  {showRemarks && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6d8499]">
                          Remarks *
                        </label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          rows={5}
                          placeholder="Enter day-end remarks for the selected dashboard components…"
                          className="w-full rounded-xl border border-[#0055a5]/20 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#0f1c30]"
                        />
                      </div>

                      <SignaturePad value={signatureImage} onChange={setSignatureImage} />
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {!locked && (
              <div className="border-t border-[#0055a5]/10 p-4 dark:border-white/10">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={!selectedKeys.length || previewMutation.isPending}
                    onClick={() => previewMutation.mutate()}
                  >
                    {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Preview PDF
                  </Button>
                  <Button
                    disabled={
                      !selectedKeys.length || !remarks.trim() || !signatureImage || submitMutation.isPending
                    }
                    onClick={() => {
                      if (!signatureImage) {
                        toast.error("Please sign and press OK before submit.");
                        return;
                      }
                      submitMutation.mutate();
                    }}
                    className="flex-1"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit & Lock
                  </Button>
                </div>
                {submittedReportId && (
                  <Button className="mt-2 w-full" variant="outline" onClick={downloadSubmittedPdf}>
                    <Download className="h-4 w-4" /> Download submitted PDF
                  </Button>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
