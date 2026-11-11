"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: {
    isFinal: boolean;
    [index: number]: { transcript: string };
  };
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type UseSpeechInputOptions = {
  lang?: string;
  onFinal?: (text: string) => void;
};

export function useSpeechInput(options: UseSpeechInputOptions = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(options.onFinal);
  onFinalRef.current = options.onFinal;

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input is not supported. Please use Chrome or Edge.");
      return;
    }

    setError(null);
    setInterim("");

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = options.lang || "ur-PK";

    let finalText = "";

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalText += piece;
        } else {
          interimText += piece;
        }
      }
      setInterim((finalText || interimText).trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone permission denied.");
      } else if (event.error !== "aborted") {
        setError("Voice capture failed. Try again.");
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalText.trim();
      setInterim("");
      if (text) onFinalRef.current?.(text);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start microphone.");
    }
  }, [options.lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { listening, interim, supported, error, toggle, stop };
}
