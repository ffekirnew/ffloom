export const STATUSES = ["backlog", "todo", "in_progress", "blocked", "done", "cancelled"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export interface Actor {
  kind: "user" | "agent";
  agent?: string | null;
  model?: string | null;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  counts: Partial<Record<Status, number>>;
}

export interface Task {
  id: number;
  project_id: number;
  project: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  assignee: Actor | null;
  tags: string[];
  latest_comment: Comment | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  body: string;
  actor: Actor;
  created_at: string;
}

export interface TaskEvent {
  id: number;
  task_id: number | null;
  task_title: string | null;
  project_id: number | null;
  project: string | null;
  kind: string;
  data: Record<string, any>;
  actor: Actor;
  created_at: string;
}

export interface TaskDetail extends Task {
  comments: Comment[];
  history: TaskEvent[];
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  projects: () => request<Project[]>("GET", "/api/projects"),
  createProject: (name: string, description = "") =>
    request<Project>("POST", "/api/projects", { name, description }),
  updateProject: (id: number, patch: Partial<Pick<Project, "name" | "description">>) =>
    request<Project>("PATCH", `/api/projects/${id}`, patch),
  deleteProject: (id: number) => request<void>("DELETE", `/api/projects/${id}`),
  tasks: (projectId?: number) =>
    request<Task[]>("GET", `/api/tasks${projectId ? `?project_id=${projectId}` : ""}`),
  task: (id: number) => request<TaskDetail>("GET", `/api/tasks/${id}`),
  createTask: (t: Partial<Task> & { project_id: number; title: string }) =>
    request<Task>("POST", "/api/tasks", t),
  updateTask: (id: number, patch: Record<string, unknown>) => request<Task>("PATCH", `/api/tasks/${id}`, patch),
  deleteTask: (id: number) => request<void>("DELETE", `/api/tasks/${id}`),
  comment: (id: number, body: string) => request<Comment>("POST", `/api/tasks/${id}/comments`, { body }),
  activity: (opts: { limit?: number; beforeId?: number; projectId?: number } = {}) => {
    const p = new URLSearchParams({ limit: String(opts.limit ?? 50) });
    if (opts.beforeId) p.set("before_id", String(opts.beforeId));
    if (opts.projectId) p.set("project_id", String(opts.projectId));
    return request<TaskEvent[]>("GET", `/api/activity?${p}`);
  },
};

export function who(a: Actor | null | undefined): string {
  if (!a) return "Unassigned";
  if (a.kind === "user") return "You";
  return a.model ? `${a.agent} · ${a.model}` : a.agent ?? "Agent";
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function describeEvent(e: TaskEvent): string {
  const d = e.data;
  switch (e.kind) {
    case "created":
      return `created in ${STATUS_LABELS[d.status as Status] ?? d.status}`;
    case "commented":
      return "commented";
    case "deleted":
      return "deleted";
    case "project_created":
      return `created project ${d.name}`;
    case "project_updated":
      return "updated a project";
    case "project_deleted":
      return `deleted project ${d.name}${d.tasks ? ` and its ${d.tasks} tasks` : ""}`;
    case "updated": {
      const parts: string[] = [];
      for (const [field, [oldV, newV]] of Object.entries(d.changes ?? {}) as [string, [any, any]][]) {
        if (field === "status") parts.push(`moved ${STATUS_LABELS[oldV as Status]} → ${STATUS_LABELS[newV as Status]}`);
        else if (field === "assignee") parts.push(`assigned to ${who(newV)}`);
        else if (field === "description") parts.push("edited the description");
        else if (field === "tags") parts.push(`set tags to ${(newV as string[]).map((t) => "#" + t).join(" ") || "none"}`);
        else if (field === "due_date") parts.push(newV ? `set due ${newV}` : "cleared the due date");
        else parts.push(`${field.replace("_", " ")} → ${newV}`);
      }
      return parts.join(", ");
    }
  }
  return e.kind;
}
