import React from "react";
import { cn } from "../../lib/utils";

type StateKind = "empty" | "loading" | "unavailable" | "forbidden";

export function StatePanel({
  action,
  children,
  className,
  kind = "empty",
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  kind?: StateKind;
  title: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-oasis-border bg-base-gray-50 px-4 py-6 text-center",
        className,
      )}
      role={
        kind === "loading"
          ? "status"
          : kind === "forbidden"
            ? "alert"
            : undefined
      }
      aria-live={kind === "loading" ? "polite" : undefined}
    >
      <StateGlyph kind={kind} />
      <h3 className="mt-3 text-base font-semibold text-oasis-ink">{title}</h3>
      <div className="mx-auto mt-1 max-w-xl text-sm leading-6 text-oasis-muted">
        {children}
      </div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

function StateGlyph({ kind }: { kind: StateKind }) {
  const path =
    kind === "forbidden"
      ? "M7 11V8a5 5 0 0110 0v3m-9 0h8a2 2 0 012 2v6H6v-6a2 2 0 012-2z"
      : kind === "unavailable"
        ? "M12 8v4m0 4h.01M4.5 19h15L12 5 4.5 19z"
        : kind === "loading"
          ? "M12 3a9 9 0 109 9"
          : "M5 7h14v12H5zM8 4h8v3";
  return (
    <svg
      className="mx-auto h-7 w-7 text-oasis-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d={path}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
