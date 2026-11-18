import { Activity as ActivityIcon, FolderPlus, LayoutGrid, List, Monitor, Moon, Plus, RefreshCw, Search, Spool, Sun, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "./Activity";
import { Actor, Project, STATUSES, Status, Task, api } from "./api";
import { Board } from "./Board";
import { FilterMenu } from "./FilterMenu";
import { EMPTY_FILTERS, Filters, hasTaskFilters, isOpen, isOverdue, matches } from "./filters";
import { Projects } from "./Projects";
import { TaskModal, keyOf } from "./TaskModal";
import { ProjectDialog } from "./ProjectDialog";
import { ConfirmDialog, IconButton, Select } from "./ui";

type View = "board" | "projects" | "activity";
type Theme = "system" | "light" | "dark";
const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };
const THEME_LABEL = { system: "System theme", light: "Light theme", dark: "Dark theme" };

const VIEWS: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "projects", label: "Projects", icon: List },
  { id: "activity", label: "Activity", icon: ActivityIcon },
];

// Kanban on desktop, the activity feed on narrow screens; every view is reachable from the tabs.
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

const defaultCollapsed = (ts: Task[]) => new Set(STATUSES.filter((s) => s === "done" || !ts.some((t) => t.status === s)));

export function App() {
  const [view, setView] = useState<View>(defaultView);
  const [projects, setProjects] = useState<Project[]>([]);
  // Every task is loaded once and filtered here: one person's board is small.
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, projectId: load("ffloom.project", undefined) ?? undefined }));
  // a task id, or what a new task starts with
  const [open, setOpen] = useState<number | { status: Status; projectId?: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => load("ffloom.theme", "system"));
  // Columns start collapsed when they're Done or empty, worked out again whenever the project changes.
  const [collapsed, setCollapsed] = useState<Set<Status> | null>(null);
  // { project } edits one, {} creates one
  const [projectDialog, setProjectDialog] = useState<{ project?: Project } | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const onError = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const refresh = () => setRefreshKey((k) => k + 1);
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    Promise.all([api.projects(), api.tasks()]).then(([ps, ts]) => {
      setProjects(ps);
      setTasks(ts);
      setSyncedAt(new Date());
      if (filters.projectId && !ps.some((p) => p.id === filters.projectId)) setFilter("projectId", undefined);
    }).catch(onError);
  }, [refreshKey]);

  useEffect(() => setCollapsed(null), [filters.projectId]);
  useEffect(() => {
    if (tasks && collapsed === null) {
      setCollapsed(defaultCollapsed(tasks.filter((t) => !filters.projectId || t.project_id === filters.projectId)));
    }
  }, [tasks, collapsed]);

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    save("ffloom.theme", theme);
  }, [theme]);

  useEffect(() => save("ffloom.project", filters.projectId ?? null), [filters.projectId]);

  // No live updates yet: pick up agents' changes when the tab comes back into focus.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const all = tasks ?? [];
  const shown = useMemo(() => all.filter((t) => matches(t, filters, keyOf)), [all, filters]);
  const inProject = useMemo(() => all.filter((t) => !filters.projectId || t.project_id === filters.projectId), [all, filters.projectId]);

  const knownAgents = useMemo(() => {
    const seen = new Map<string, Actor>();
    for (const t of all) if (t.assignee?.kind === "agent") seen.set(keyOf(t.assignee), t.assignee);
    return [...seen.values()];
  }, [all]);
  const allTags = useMemo(() => [...new Set(all.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b)), [all]);

  const toggleColumn = (s: Status) => {
    const next = new Set(collapsed);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setCollapsed(next);
  };

  const move = (task: Task, status: Status) => {
    setTasks(all.map((t) => (t.id === task.id ? { ...t, status } : t)));
    api.updateTask(task.id, { status }).then(refresh).catch((e) => { onError(e); refresh(); });
  };

  const newProject = () => setProjectDialog({});
  const editProject = (p: Project) => setProjectDialog({ project: p });
  const deleteProject = (p: Project) =>
    api.deleteProject(p.id).then(() => {
      if (filters.projectId === p.id) setFilter("projectId", undefined);
      refresh();
    }).catch(onError);
  const deletingCount = deleting ? all.filter((t) => t.project_id === deleting.id).length : 0;

  const current = projects.find((p) => p.id === filters.projectId);
  const taskFiltersApply = view !== "activity";
  const anyFilter = !!filters.search || !!filters.projectId || (taskFiltersApply && hasTaskFilters(filters));
  const ThemeIcon = THEME_ICON[theme];

  const stats = {
    open: inProject.filter(isOpen).length,
    blocked: inProject.filter((t) => t.status === "blocked").length,
    overdue: inProject.filter(isOverdue).length,
  };

  return (
    <div className={`app view-${view}`}>
      <header className="top glass">
        <div className="brand"><Spool size={20} strokeWidth={2.25} /><h1>ffloom</h1></div>
        <nav className="segmented" role="tablist" aria-label="Views">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={view === id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
              <Icon size={15} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <IconButton label={`${THEME_LABEL[theme]} (click to change)`} onClick={() => setTheme(NEXT_THEME[theme])}>
          <ThemeIcon size={17} />
        </IconButton>
        <button className="btn primary" onClick={() => setOpen({ status: "todo" })} disabled={projects.length === 0}
          title={projects.length === 0 ? "Create a project first" : undefined}>
          <Plus size={16} strokeWidth={2.5} /><span>New task</span>
        </button>
      </header>

      {projects.length > 0 && (
        <div className="filters">
          <label className="search">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="Search" value={filters.search} aria-label="Search"
              onChange={(e) => setFilter("search", e.target.value)} />
          </label>
          <Select value={filters.projectId ?? ""} aria-label="Project" className={filters.projectId ? "set" : ""}
            onChange={(e) => setFilter("projectId", e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          {taskFiltersApply && <FilterMenu filters={filters} agents={knownAgents} tags={allTags} onChange={setFilter} />}
          {anyFilter && <button className="btn ghost" onClick={() => setFilters(EMPTY_FILTERS)}><X size={14} />Clear</button>}
        </div>
      )}

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <IconButton label="Dismiss" onClick={() => setError(null)}><X size={16} /></IconButton>
        </div>
      )}

      <main>
        {tasks === null ? null : projects.length === 0 ? (
          <div className="empty">
            <FolderPlus size={32} strokeWidth={1.5} />
            <p>No projects yet.</p>
            <button className="btn primary" onClick={newProject}><Plus size={16} strokeWidth={2.5} />New project</button>
          </div>
        ) : view === "board" ? (
          <Board
            tasks={shown} showProject={!filters.projectId} collapsed={collapsed ?? new Set()}
            onToggle={toggleColumn} onOpen={setOpen} onMove={move} onAdd={(status) => setOpen({ status })}
          />
        ) : view === "projects" ? (
          <Projects
            projects={projects} tasks={shown} filtered={!!filters.search || hasTaskFilters(filters)} projectId={filters.projectId}
            onOpenTask={setOpen} onAdd={(p) => setOpen({ status: "todo", projectId: p.id })}
            onNew={newProject} onEdit={editProject} onDelete={setDeleting}
          />
        ) : (
          <Activity projectId={filters.projectId} search={filters.search} refreshKey={refreshKey} onOpen={setOpen} onError={onError} />
        )}
      </main>

      <footer className="bottom">
        <span className="footer-brand"><Spool size={13} strokeWidth={2.25} />ffloom</span>
        <span className="footer-stats">
          {current ? `${current.name}: ` : ""}{stats.open} open
          {stats.blocked > 0 && <> · <span className="bad">{stats.blocked} blocked</span></>}
          {stats.overdue > 0 && <> · <span className="bad">{stats.overdue} overdue</span></>}
          {taskFiltersApply && shown.length !== inProject.length && <> · showing {shown.length} of {inProject.length}</>}
        </span>
        <span className="footer-sync">
          {syncedAt && <>Synced {syncedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</>}
          <IconButton label="Refresh" onClick={refresh}><RefreshCw size={14} /></IconButton>
        </span>
      </footer>

      {projectDialog && (
        <ProjectDialog
          project={projectDialog.project}
          onClose={() => setProjectDialog(null)}
          onSaved={(p) => { if (!projectDialog.project) setFilter("projectId", p.id); refresh(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message={deletingCount
            ? <>This deletes the project and its <strong>{deletingCount} {deletingCount === 1 ? "task" : "tasks"}</strong>, with their comments. It can't be undone.</>
            : "This can't be undone."}
          confirmLabel="Delete project"
          onConfirm={() => deleteProject(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      {open !== null && (
        <TaskModal
          key={typeof open === "number" ? open : `new-${open.status}-${open.projectId ?? ""}`}
          taskId={typeof open === "number" ? open : null}
          defaultStatus={typeof open === "number" ? undefined : open.status}
          projects={projects}
          defaultProjectId={(typeof open === "number" ? undefined : open.projectId) ?? filters.projectId}
          knownAgents={knownAgents}
          onClose={() => setOpen(null)}
          onChanged={refresh}
          onError={onError}
        />
      )}
    </div>
  );
}
