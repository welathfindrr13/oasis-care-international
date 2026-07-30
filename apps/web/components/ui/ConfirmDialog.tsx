"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

export function ConfirmDialog({
  confirmLabel,
  confirmDisabled = false,
  description,
  onCancel,
  onConfirm,
  open,
  returnFocusId,
  title,
}: {
  confirmLabel: string;
  confirmDisabled?: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  returnFocusId?: string;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      const opener = openerRef.current;
      openerRef.current = null;
      queueMicrotask(() => {
        const openerIsEnabled =
          opener?.isConnected &&
          !(opener instanceof HTMLButtonElement && opener.disabled);
        const target = openerIsEnabled
          ? opener
          : returnFocusId
            ? document.getElementById(returnFocusId)
            : null;
        target?.focus();
      });
    }
  }, [open, returnFocusId]);

  return (
    <dialog
      ref={dialogRef}
      className="w-[calc(100%_-_2rem)] max-w-md rounded-lg border border-oasis-border bg-white p-0 text-oasis-ink shadow-lg"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-sm leading-6 text-oasis-muted"
        >
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
