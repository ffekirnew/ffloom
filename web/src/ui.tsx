import { Bot, ChevronDown, User } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Actor } from "./api";

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
