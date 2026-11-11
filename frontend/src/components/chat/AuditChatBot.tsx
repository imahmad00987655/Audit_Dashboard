"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Mic, MicOff, Send, Sparkles, X } from "lucide-react";
import { chatApi, reportsApi } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { usePermission } from "@/hooks/use-permission";
import { detectReportShareIntent, todayLocalIso } from "@/lib/chat-report-intent";
import { ChatReportShareCard } from "@/components/chat/ChatReportShareCard";
import {
  detectReplyStyle,
  politeRefusalForStyle,
  statusLineFor,
} from "@/lib/chat-reply-style";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  usedTools?: string[];
  showReportForm?: boolean;
};

const STARTERS = [
  "Aaj ki report share karo",
  "Procon ka audit report — 1 Aug se ab tak",
  "Master Enterprises ki summary",
  "Dono companies compare karo",
];

function firstNameFromUser(fullName?: string | null, username?: string | null) {
  const full = String(fullName || "").trim();
  const user = String(username || "").trim();
  const pick =
    !full || /^system$/i.test(full.split(/\s+/)[0])
      ? user || full || "dost"
      : full;
  const first = pick.split(/\s+/)[0] || "dost";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function welcomeFor(name: string): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: `Assalam o Alaikum, ${name}! Main aapka audit assistant hoon — Procon aur Master ka data dekh sakta hoon. Boliye ${name}, aaj kya dekhna hai? Report share karni ho to "aaj ki report share karo" keh dijiye; remarks aur signature yahin add ho jayenge.`,
  };
}

export function AuditChatBot() {
  const { filters } = useDashboard();
  const { user } = useAuth();
  const { can, permissions, isAdmin, domains, unrestricted } = usePermission();
  const displayName = firstNameFromUser(user?.fullName, user?.username);
  const userId = user?.id;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [activeReportFormId, setActiveReportFormId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Checking now…");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeFor(displayName)]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastUserIdRef = useRef<number | string | null>(null);

  // No saved chat history — refresh / user switch starts fresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith("audit_chat_history"))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        /* ignore */
      }
    }
    if (userId == null) {
      setMessages([welcomeFor("dost")]);
      setActiveReportFormId(null);
      lastUserIdRef.current = null;
      return;
    }
    if (lastUserIdRef.current === userId) return;
    lastUserIdRef.current = userId;
    setActiveReportFormId(null);
    setInput("");
    setMessages([welcomeFor(firstNameFromUser(user?.fullName, user?.username))]);
  }, [userId, user?.fullName, user?.username]);

  useEffect(() => {
    chatApi
      .status()
      .then((r) => {
        const data = r.data as { configured?: boolean; allowed?: boolean };
        setConfigured(Boolean(data?.configured) && data?.allowed !== false);
      })
      .catch(() => setConfigured(false));
  }, []);

  const openReportShareForm = useCallback(async (style = detectReplyStyle("")) => {
    if (!can("feature-day-end-report")) {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: politeRefusalForStyle(style) },
      ]);
      return;
    }

    const reportDate = todayLocalIso();
    try {
      const status = await reportsApi.status(reportDate);
      if (status.data?.locked) {
        const lockedMsg =
          style === "english"
            ? `Today's (${reportDate}) day-end report is already submitted / locked. It can't be shared again.`
            : style === "punjabi"
              ? `Ajj (${reportDate}) di day-end report pehlan submit / lock ho chuki ae. Dubara share nahi ho sakdi.`
              : style === "urdu_script"
                ? `آج (${reportDate}) کی day-end رپورٹ پہلے سے جمع / لاک ہو چکی ہے۔ دوبارہ شیئر نہیں ہو سکتی۔`
                : `Aaj (${reportDate}) ki day-end report pehle se submit / lock ho chuki hai. Dobara share nahi ho sakti.`;
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: lockedMsg,
          },
        ]);
        return;
      }
    } catch {
      /* allow form; submit re-checks */
    }

    const formId = `report-${Date.now()}`;
    setActiveReportFormId(formId);
    const openMsg =
      style === "english"
        ? `Okay ${displayName} — let's share today's report. Add remarks below, confirm signature, then tap Share.`
        : style === "punjabi"
          ? `Theek ae ${displayName} — ajj di report share karde aan. Neeche remarks likho, signature OK karo, phir Share dabao.`
          : style === "urdu_script"
            ? `ٹھیک ہے ${displayName} — آج کی رپورٹ شیئر کرتے ہیں۔ نیچے remarks لکھیں، دستخط OK کریں، پھر Share دبائیں۔`
            : `Theek hai ${displayName} — aaj ki report share karte hain. Neeche remarks likhein, signature OK karein, phir Share dabayein.`;
    setMessages((prev) => [
      ...prev,
      {
        id: formId,
        role: "assistant",
        content: openMsg,
        showReportForm: true,
      },
    ]);
  }, [can, displayName]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;

      const style = detectReplyStyle(message);
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: message }]);
      setInput("");
      setStatusText(statusLineFor(style));
      setSending(true);

      try {
        if (detectReportShareIntent(message)) {
          await openReportShareForm(style);
          return;
        }

        const history = messages
          .filter((m) => m.id !== "welcome" && !m.showReportForm)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await chatApi.ask({ message, filters, history });

        if (res.data?.action === "share_day_end_report") {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content:
                res.data.reply ||
                (style === "english"
                  ? "Please add remarks and signature to share the report."
                  : "Report share ke liye remarks aur signature chahiye."),
            },
          ]);
          await openReportShareForm(style);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.data.reply,
            usedTools: res.data.usedTools,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: err instanceof Error ? err.message : "Chat request failed",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [filters, messages, sending, openReportShareForm]
  );

  const speech = useSpeechInput({
    lang: "ur-PK",
    onFinal: (text) => {
      setInput(text);
      send(text);
    },
  });

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, sending, speech.interim, activeReportFormId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition",
          "bg-[#0055a5] text-white hover:bg-[#2f7ec4]",
          "dark:bg-[#fff200] dark:text-[#0a1628] dark:hover:bg-[#f5e800]"
        )}
        aria-label={open ? "Close audit chat" : "Open audit chat"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-22 right-5 z-50 flex h-[min(640px,78vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#0055a5]/20 bg-white shadow-2xl dark:border-white/15 dark:bg-[#122238]">
          <div className="flex items-center gap-3 border-b border-[#0055a5]/10 bg-[#0055a5] px-4 py-3 text-white dark:border-white/10 dark:bg-[#0f1c30]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Audit Assistant</p>
              <p className="truncate text-[11px] text-white/80 dark:text-[#9aa8b8]">
                {configured === false
                  ? "API key missing"
                  : `Chatting as ${displayName}`}
              </p>
            </div>
            <Sparkles className="h-4 w-4 text-[#fff200]" />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-[#0055a5] text-white"
                      : "bg-[#eef5fc] text-[#2a4a6e] dark:bg-[#0f1c30] dark:text-[#e8f1fa]"
                  )}
                >
                  {m.content}
                </div>
                {m.showReportForm && activeReportFormId === m.id && (
                  <ChatReportShareCard
                    filters={filters}
                    permissions={permissions}
                    isAdmin={isAdmin}
                    domains={domains}
                    unrestricted={unrestricted}
                    onCancel={() => {
                      setActiveReportFormId(null);
                      setMessages((prev) => [
                        ...prev,
                        {
                          id: `a-${Date.now()}`,
                          role: "assistant",
                          content: `Theek hai ${displayName}, report share cancel kar di. Koi aur sawal ho to poochhiye.`,
                        },
                      ]);
                    }}
                    onSuccess={({ reportDate, emailStatus }) => {
                      setActiveReportFormId(null);
                      setMessages((prev) =>
                        prev
                          .map((msg) => (msg.id === m.id ? { ...msg, showReportForm: false } : msg))
                          .concat({
                            id: `a-${Date.now()}`,
                            role: "assistant",
                            content: `Done ${displayName} — ${reportDate} ki day-end report share / lock ho gayi.${
                              emailStatus ? ` Email status: ${emailStatus}.` : ""
                            }`,
                          })
                      );
                    }}
                  />
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-[#6d8499]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {statusText}
              </div>
            )}
            {speech.listening && (
              <div className="flex items-center gap-2 rounded-xl bg-[#fff200]/20 px-3 py-2 text-xs text-[#0055a5] dark:text-[#fff200]">
                <Mic className="h-3.5 w-3.5 animate-pulse" />
                Sun raha hoon… {speech.interim || "boliye"}
              </div>
            )}
            {speech.error && <p className="text-xs text-red-600 dark:text-red-400">{speech.error}</p>}
            <div ref={bottomRef} />
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-[#0055a5]/10 px-3 py-2 dark:border-white/10">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sending || configured === false}
                onClick={() => send(s)}
                className="rounded-full border border-[#0055a5]/15 bg-[#f7fbff] px-2.5 py-1 text-[11px] text-[#0055a5] hover:bg-[#eef5fc] disabled:opacity-50 dark:border-white/10 dark:bg-[#0f1c30] dark:text-[#7eb6e8]"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t border-[#0055a5]/10 p-3 dark:border-white/10"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            {speech.supported && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl",
                  speech.listening &&
                    "border-red-500 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-950/30 dark:text-red-400"
                )}
                disabled={sending || configured === false}
                onClick={speech.toggle}
                aria-label={speech.listening ? "Stop voice input" : "Speak your question"}
              >
                {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <input
              value={speech.listening && speech.interim ? speech.interim : input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                configured === false
                  ? "Configure OPENAI_API_KEY…"
                  : speech.listening
                    ? "Listening…"
                    : `${displayName}, type or speak…`
              }
              disabled={sending || configured === false || speech.listening}
              className="h-10 flex-1 rounded-xl border border-[#0055a5]/20 bg-[#f7fbff] px-3 text-sm outline-none focus:ring-2 focus:ring-[#0055a5]/25 disabled:opacity-60 dark:border-white/15 dark:bg-[#0f1c30] dark:text-[#e8f1fa]"
            />
            <Button type="submit" size="icon" className="h-10 w-10 rounded-xl" disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
