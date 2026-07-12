import React from "react";
import { cn } from "../../lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "attention"
  | "danger"
  | "success";

const tones: Record<StatusTone, string> = {
  neutral: "border-oasis-border bg-base-gray-50 text-oasis-muted",
  info: "border-blue-200 bg-oasis-info-soft text-oasis-info",
  attention: "border-amber-200 bg-oasis-attention-soft text-oasis-attention",
  danger: "border-red-200 bg-oasis-danger-soft text-oasis-danger",
  success: "border-green-200 bg-oasis-success-soft text-oasis-success",
};

export function StatusLabel({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      <StatusMark tone={tone} />
      {children}
    </span>
  );
}

function StatusMark({ tone }: { tone: StatusTone }) {
  if (tone === "success") {
    return <span aria-hidden="true">✓</span>;
  }
  if (tone === "danger") {
    return <span aria-hidden="true">×</span>;
  }
  if (tone === "attention") {
    return <span aria-hidden="true">!</span>;
  }
  if (tone === "info") {
    return <span aria-hidden="true">i</span>;
  }
  return (
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
  );
}
