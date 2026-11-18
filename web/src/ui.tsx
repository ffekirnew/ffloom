import { Bot, ChevronDown, User, X } from "lucide-react";
import { ButtonHTMLAttributes, FormEvent, ReactNode, SelectHTMLAttributes, useEffect, useState } from "react";
import { Actor } from "./api";

// A small in-app dialog: used instead of the browser's prompt() and confirm().
export function Dialog({ title, onClose, onSubmit, children, actions }: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  children?: ReactNode;
  actions: ReactNode;
}) {
  useEffect(() => {
    // capture + stopPropagation so Escape closes only this dialog, not the task modal under it
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(); };
  return (
    <div className="backdrop dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        {children}
        <div className="dialog-actions">{actions}</div>
      </form>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={title} onClose={onClose} onSubmit={confirm} actions={
      <>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn destructive" disabled={busy} autoFocus>{confirmLabel}</button>
      </>
    }>
      <p className="dialog-message">{message}</p>
    </Dialog>
  );
}

export function Avatar({ actor, size = 22 }: { actor: Actor; size?: number }) {
  const agent = actor.kind === "agent";
  const Icon = agent ? Bot : User;
  return (
    <span className={`avatar ${agent ? "agent" : "user"}`} style={{ width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.6)} strokeWidth={2.25} />
    </span>
  );
}

// A native <select> (so phones get their own picker) with the browser's arrow
// replaced by one that matches the theme.
export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`select ${className}`}>
      <select {...rest}>{children}</select>
      <ChevronDown size={15} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

export function IconButton({ label, children, className = "", ...rest }: {
  label: string; children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`icon-btn ${className}`} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
