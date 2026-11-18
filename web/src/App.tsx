import { Activity as ActivityIcon, FolderPlus, LayoutGrid, Monitor, Moon, Pencil, Plus, Spool, Sun, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "./Activity";
import { Actor, Project, STATUSES, Status, Task, api } from "./api";
import { Board } from "./Board";
import { TaskModal, keyOf } from "./TaskModal";
import { IconButton, Select } from "./ui";

type View = "board" | "activity";
type Theme = "system" | "light" | "dark";
const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };
const THEME_LABEL = { system: "System theme", light: "Light theme", dark: "Dark theme" };

// Kanban on desktop, the activity feed on narrow screens; both reachable from the tabs.
const defaultView = (): View => (window.matchMedia("(max-width: 700px)").matches ? "activity" : "board");

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function App() {
  const [view, setView] = useState<View>(defaultView);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | undefined>(() => load("ffloom.project", undefined));
  const [tasks, setTasks] = useState<Task[]>([]);
  // a task id, or the status a new task starts in
  const [open, setOpen] = useState<number | { status: Status } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => load("ffloom.theme", "system"));
  // Columns start collapsed when they're Done or empty, worked out once per project from its first load.
  const [collapsed, setCollapsed] = useState<Set<Status> | null>(null);

  const onError = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    api.projects().then((ps) => {
      setProjects(ps);
      if (projectId && !ps.some((p) => p.id === projectId)) setProjectId(undefined);
    }).catch(onError);
    api.tasks(projectId).then((ts) => {
      setTasks(ts);
      setCollapsed((c) => c ?? new Set(STATUSES.filter((s) => s === "done" || !ts.some((t) => t.status === s))));
    }).catch(onError);
  }, [projectId, refreshKey]);

  useEffect(() => setCollapsed(null), [projectId]);

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    save("ffloom.theme", theme);
  }, [theme]);

  const toggleColumn = (s: Status) => {
    const next = new Set(collapsed);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setCollapsed(next);
  };

  // No live updates yet: pick up agents' changes when the tab comes back into focus.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => save("ffloom.project", projectId ?? null), [projectId]);

  const knownAgents = useMemo(() => {
    const seen = new Map<string, Actor>();
    for (const t of tasks) if (t.assignee?.kind === "agent") seen.set(keyOf(t.assignee), t.assignee);
    return [...seen.values()];
  }, [tasks]);

  const move = (task: Task, status: Status) => {
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status } : t)));
    api.updateTask(task.id, { status }).then(refresh).catch((e) => { onError(e); refresh(); });
  };

  const newProject = () => {
    const name = prompt("New project name");
    if (name?.trim()) api.createProject(name.trim()).then((p) => { setProjectId(p.id); refresh(); }).catch(onError);
  };

  const current = projects.find((p) => p.id === projectId);
  const renameProject = () => {
    const name = current && prompt("Rename project", current.name);
    if (current && name?.trim()) api.updateProject(current.id, { name: name.trim() }).then(refresh).catch(onError);
  };
  const deleteProject = () => {
    if (!current) return;
    const n = Object.values(current.counts).reduce((a, b) => a + (b ?? 0), 0);
    if (confirm(`Delete project "${current.name}"${n ? ` and its ${n} tasks` : ""}? This can't be undone.`)) {
      api.deleteProject(current.id).then(() => { setProjectId(undefined); refresh(); }).catch(onError);
    }
  };

  const ThemeIcon = THEME_ICON[theme];

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Spool size={20} strokeWidth={2.25} /><h1>ffloom</h1></div>
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={view === "board"} className={view === "board" ? "active" : ""} onClick={() => setView("board")}>
            <LayoutGrid size={15} />Board
          </button>
          <button role="tab" aria-selected={view === "activity"} className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}>
            <ActivityIcon size={15} />Activity
          </button>
        </div>
        <div className="spacer" />
        <div className="project-picker">
          <Select value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
            aria-label="Project">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          {current && (
            <>
              <IconButton label={`Rename ${current.name}`} onClick={renameProject}><Pencil size={15} /></IconButton>
              <IconButton label={`Delete ${current.name}`} className="danger" onClick={deleteProject}><Trash2 size={15} /></IconButton>
            </>
          )}
          <IconButton label="New project" onClick={newProject}><FolderPlus size={16} /></IconButton>
        </div>
        <IconButton label={`${THEME_LABEL[theme]} (click to change)`} onClick={() => setTheme(NEXT_THEME[theme])}>
          <ThemeIcon size={17} />
        </IconButton>
        <button className="btn primary" onClick={() => setOpen({ status: "todo" })} disabled={projects.length === 0}
          title={projects.length === 0 ? "Create a project first" : undefined}>
          <Plus size={16} strokeWidth={2.5} />New task
        </button>
      </header>
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <IconButton label="Dismiss" onClick={() => setError(null)}><X size={16} /></IconButton>
        </div>
      )}
      <main>
        {projects.length === 0 ? (
          <div className="empty">
            <FolderPlus size={32} strokeWidth={1.5} />
            <p>No projects yet.</p>
            <button className="btn primary" onClick={newProject}><Plus size={16} strokeWidth={2.5} />New project</button>
          </div>
        ) : view === "board" ? (
          <Board
            tasks={tasks} showProject={!projectId} collapsed={collapsed ?? new Set()}
            onToggle={toggleColumn} onOpen={setOpen} onMove={move} onAdd={(status) => setOpen({ status })}
          />
        ) : (
          <Activity projectId={projectId} refreshKey={refreshKey} onOpen={setOpen} onError={onError} />
        )}
      </main>
      {open !== null && (
        <TaskModal
          key={typeof open === "number" ? open : `new-${open.status}`}
          taskId={typeof open === "number" ? open : null}
          defaultStatus={typeof open === "number" ? undefined : open.status}
          projects={projects}
          defaultProjectId={projectId}
          knownAgents={knownAgents}
          onClose={() => setOpen(null)}
          onChanged={refresh}
          onError={onError}
        />
      )}
    </div>
  );
}
