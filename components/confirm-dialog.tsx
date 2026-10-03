"use client";

import { useEffect, useId, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onCancel}
      onCancel={(event) => { if (pending) event.preventDefault(); else onCancel(); }}
      onClick={(event) => {
        const rect = dialogRef.current?.getBoundingClientRect();
        if (rect && !pending && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <h2 id={titleId} className="text-2xl font-normal">{title}</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          autoFocus
          disabled={pending}
          onClick={onCancel}
          className="h-12 flex-1 cursor-pointer rounded-lg border border-border bg-background text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className={`h-12 flex-1 cursor-pointer rounded-lg border text-sm transition-colors disabled:opacity-50 ${destructive ? "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20" : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"}`}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
