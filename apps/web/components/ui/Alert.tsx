import React from "react";
import { cn } from "../../lib/utils";

type AlertTone = "info" | "attention" | "danger" | "success";

const toneClasses: Record<AlertTone, string> = {
  info: "border-blue-200 bg-oasis-info-soft text-oasis-info",
  attention: "border-amber-200 bg-oasis-attention-soft text-oasis-attention",
  danger: "border-red-200 bg-oasis-danger-soft text-oasis-danger",
  success: "border-green-200 bg-oasis-success-soft text-oasis-success",
};

export function Alert({
  children,
  className,
  title,
  tone = "info",
  live = false,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  tone?: AlertTone;
  live?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border p-3 text-sm",
        toneClasses[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={live ? "polite" : undefined}
    >
      <StateIcon tone={tone} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && "mt-1", "leading-6")}>{children}</div>
      </div>
    </div>
  );
}

function StateIcon({ tone }: { tone: AlertTone }) {
  const mark =
    tone === "success"
      ? "M5 12l4 4L19 6"
      : tone === "danger"
        ? "M6 6l12 12M18 6L6 18"
        : "M12 8v4m0 4h.01";
  return (
    <svg
      className="mt-0.5 h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="1.75" />
      <path
        d={mark}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
