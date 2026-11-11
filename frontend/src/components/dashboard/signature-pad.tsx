"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Check, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignaturePadProps = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
};

export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [confirmed, setConfirmed] = useState(Boolean(value));

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a1628";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (value && confirmed) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasInk(true);
      };
      img.src = value;
    }
  };

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || confirmed) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled || confirmed) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const onPointerUp = () => {
    drawing.current = false;
  };

  const clear = () => {
    if (disabled) return;
    setConfirmed(false);
    onChange(null);
    setHasInk(false);
    setupCanvas();
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    const dataUrl = canvas.toDataURL("image/png");
    setConfirmed(true);
    onChange(dataUrl);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6d8499]">
          <PenLine className="h-3.5 w-3.5" /> Officer signature *
        </label>
        {confirmed ? (
          <span className="rounded-full bg-[#e8f8ef] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2f7a4f]">
            Signed
          </span>
        ) : (
          <span className="text-[10px] text-[#6d8499]">Sign with mouse / touchpad / finger</span>
        )}
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-xl border-2 border-dashed bg-white dark:bg-[#0f1c30]",
          confirmed ? "border-[#3d9b6a]/50" : "border-[#0055a5]/25"
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "h-36 w-full touch-none",
            confirmed || disabled ? "cursor-default opacity-90" : "cursor-crosshair"
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled}>
          <Eraser className="h-3.5 w-3.5" /> Clear
        </Button>
        <Button type="button" size="sm" onClick={confirm} disabled={disabled || confirmed || !hasInk}>
          <Check className="h-3.5 w-3.5" /> OK — save signature
        </Button>
      </div>
    </div>
  );
}
