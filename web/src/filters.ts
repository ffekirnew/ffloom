import { Bot, CalendarClock, CircleExclamationPoint, Flag, Flame, LucideIcon, User, UserX } from "lucide-react";
import { Task, today } from "./api";

export type Chip = "mine" | "agents" | "unassigned" | "blocked" | "overdue" | "soon" | "urgent";

export interface Filters {
  search: string;
  projectId?: number;
  chip?: Chip;
}

export const EMPTY_FILTERS: Filters = { search: "" };

export const isOpen = (t: Task) => t.status !== "done" && t.status !== "cancelled";
export const isOverdue = (t: Task) => isOpen(t) && !!t.due_date && t.due_date < today();

export function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Quick filters shown as chips with live counts; one can be on at a time.
export const CHIPS: { id: Chip; label: string; icon: LucideIcon; test: (t: Task) => boolean }[] = [
  { id: "mine", label: "Mine", icon: User, test: (t) => t.assignee?.kind === "user" },
  { id: "agents", label: "Agent work", icon: Bot, test: (t) => t.assignee?.kind === "agent" },
  { id: "unassigned", label: "Unassigned", icon: UserX, test: (t) => isOpen(t) && t.assignee === null },
  { id: "blocked", label: "Blocked", icon: CircleExclamationPoint, test: (t) => t.status === "blocked" },
  { id: "overdue", label: "Overdue", icon: Flag, test: isOverdue },
  { id: "soon", label: "Due soon", icon: CalendarClock, test: (t) => isOpen(t) && !!t.due_date && t.due_date >= today() && t.due_date <= inDays(7) },
  { id: "urgent", label: "Urgent–High", icon: Flame, test: (t) => isOpen(t) && (t.priority === "urgent" || t.priority === "high") },
];

export function matchesSearch(t: Task, search: string): boolean {
  const q = search.trim().toLowerCase();
  return !q || [t.title, t.description, t.project, `#${t.id}`, ...t.tags].some((x) => x.toLowerCase().includes(q));
}

export function matches(t: Task, f: Filters): boolean {
  if (f.projectId && t.project_id !== f.projectId) return false;
  if (f.chip && !CHIPS.find((c) => c.id === f.chip)!.test(t)) return false;
  return matchesSearch(t, f.search);
}
