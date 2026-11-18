import { Priority, Task, today } from "./api";

export type DueFilter = "" | "overdue" | "today" | "week" | "none";

export interface Filters {
  search: string;
  projectId?: number;
  priority: Priority | "";
  assignee: string; // "" anyone, "none", "user", or keyOf(agent)
  tag: string;
  due: DueFilter;
}

export const EMPTY_FILTERS: Filters = { search: "", priority: "", assignee: "", tag: "", due: "" };

export const isOpen = (t: Task) => t.status !== "done" && t.status !== "cancelled";
export const isOverdue = (t: Task) => isOpen(t) && !!t.due_date && t.due_date < today();

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function matches(t: Task, f: Filters, keyOf: (a: Task["assignee"]) => string): boolean {
  if (f.projectId && t.project_id !== f.projectId) return false;
  if (f.priority && t.priority !== f.priority) return false;
  if (f.assignee === "none" ? t.assignee !== null : f.assignee && keyOf(t.assignee) !== f.assignee) return false;
  if (f.tag && !t.tags.some((g) => g.toLowerCase() === f.tag.toLowerCase())) return false;
  if (f.due) {
    const d = t.due_date;
    if (f.due === "none" ? d !== null : !d) return false;
    if (d && f.due === "overdue" && !isOverdue(t)) return false;
    if (d && f.due === "today" && d !== today()) return false;
    if (d && f.due === "week" && (d < today() || d > inDays(7))) return false;
  }
  const q = f.search.trim().toLowerCase();
  if (q && ![t.title, t.description, t.project, ...t.tags].some((x) => x.toLowerCase().includes(q))) return false;
  return true;
}

// Filters that narrow tasks beyond the project; the activity view only honours search and project.
export const hasTaskFilters = (f: Filters) => !!(f.priority || f.assignee || f.tag || f.due);
