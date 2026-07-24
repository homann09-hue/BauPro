"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Signature } from "lucide-react";
import { cn } from "@/lib/utils";

type Point = {
  x: number;
  y: number;
};

type SignaturePadProps = {
  name?: string;
  label?: string;
  required?: boolean;
  className?: string;
};

export function SignaturePad({
  name = "signature_data_url",
  label = "Unterschrift",
  required = false,
  className
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(Math.floor(rect.width * ratio), 1);
      canvas.height = Math.max(Math.floor(rect.height * ratio), 1);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, rect.width, rect.height);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#111827";
      context.lineWidth = 2.6;
      if (inputRef.current) inputRef.current.value = "";
      setHasSignature(false);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function pointFromClient(clientX: number, clientY: number): Point {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0)
    };
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Point {
    return pointFromClient(event.clientX, event.clientY);
  }

  function beginDrawing(point: Point) {
    drawingRef.current = true;
    lastPointRef.current = point;
    markPoint(point);
  }

  function markPoint(point: Point) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.beginPath();
    context.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
    context.fillStyle = "#111827";
    context.fill();
    persistSignature();
  }

  function drawLine(point: Point) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const lastPoint = lastPointRef.current;
    if (!canvas || !context || !lastPoint) return;

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    persistSignature();
  }

  function persistSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    inputRef.current.value = canvas.toDataURL("image/jpeg", 0.88);
    setHasSignature(true);
    setError(null);
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    canvasRef.current?.setPointerCapture(event.pointerId);
    beginDrawing(pointFromEvent(event));
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawLine(pointFromEvent(event));
  }

  function stopDrawing(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event) canvasRef.current?.releasePointerCapture(event.pointerId);
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !inputRef.current) return;
    const rect = canvas.getBoundingClientRect();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, rect.width, rect.height);
    inputRef.current.value = "";
    drawingRef.current = false;
    setHasSignature(false);
    setError(null);
  }

  function startMouseDrawing(event: React.MouseEvent<HTMLCanvasElement>) {
    event.preventDefault();
    beginDrawing(pointFromEvent(event));
  }

  function drawMouse(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || event.buttons !== 1) return;
    event.preventDefault();
    drawLine(pointFromEvent(event));
  }

  function stopMouseDrawing() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function validateBeforeSubmit(event: React.FormEvent<HTMLInputElement>) {
    if (required && !hasSignature) {
      setError("Bitte unterschreiben oder die Unterschrift bewusst nachholen.");
      event.preventDefault();
    }
  }

  return (
    <div className={cn("rounded-lg border border-line bg-white p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Signature className="h-4 w-4 text-moss" aria-hidden="true" />
          <span className="field-label mb-0">{label}</span>
        </div>
        <button type="button" className="btn-secondary min-h-10 px-3 text-xs" onClick={clearSignature}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Neu
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="h-44 w-full touch-none rounded-md border border-line bg-white shadow-inner"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onMouseDown={startMouseDrawing}
        onMouseMove={drawMouse}
        onMouseUp={stopMouseDrawing}
        onMouseLeave={stopMouseDrawing}
        aria-label={label}
      />
      <input ref={inputRef} type="hidden" name={name} onInvalid={validateBeforeSubmit} />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold">
        <p className={hasSignature ? "text-primary-dark" : "text-slate-500"}>
          {hasSignature ? "Unterschrift erfasst." : "Mit Finger, Stift oder Maus im Feld unterschreiben."}
        </p>
        {required ? <span className="text-slate-500">Pflicht vor Absenden</span> : null}
      </div>
      {error ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
