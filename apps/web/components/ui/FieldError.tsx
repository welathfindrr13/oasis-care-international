import React from "react";
import { cn } from "../../lib/utils";

export function FieldError({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <p id={id} className={cn("oasis-field-error", className)} role="alert">
      <span aria-hidden="true">!</span>
      <span>{children}</span>
    </p>
  );
}
