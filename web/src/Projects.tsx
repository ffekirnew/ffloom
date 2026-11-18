import { ChevronDown, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Project, STATUS_LABELS, Status, Task, who } from "./api";
import { DueChip, PriorityBadge } from "./Board";
import { isOpen } from "./filters";
import { Avatar, IconButton, StatusDot } from "./ui";

// Work in progress first, finished work last.
const ORDER: Status[] = ["in_progress", "blocked", "todo", "backlog", "done", "cancelled"];
const RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

const sortTasks = (ts: Task[]) =>
  [...ts].sort((a, b) =>
    ORDER.indexOf(a.status) - ORDER.indexOf(b.status)
    || RANK[a.priority] - RANK[b.priority]
    || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
    || a.id - b.id);

function Row({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const closed = !isOpen(task);
  return (
    <li className={`task-row ${closed ? "closed" : ""}`} onClick={onOpen} tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}>
      <span className="status-pill"><StatusDot status={task.status} />{STATUS_LABELS[task.status]}</span>
      <span className="row-main">
        <span className="row-title"><PriorityBadge task={task} />{task.title}</span>
        {task.status === "blocked" && task.latest_comment && <span className="blocked-reason">{task.latest_comment.body}</span>}
      </span>
      <span className="row-meta">
        <span className="chip mono">#{task.id}</span>
        <DueChip task={task} />
        {task.tags.map((g) => <span key={g} className="chip mono">{g}</span>)}
        <span className="row-assignee" title={task.assignee ? who(task.assignee) : "Unassigned"}>
          {task.assignee && <Avatar actor={task.assignee} size={20} />}
        </span>
      </span>
    </li>
  );
}

function Group({ project, tasks, filtered, onOpenTask, onAdd, onEdit, onDelete }: {
  project: Project;
  tasks: Task[];
  filtered: boolean;
  onOpenTask: (id: number) => void;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [folded, setFolded] = useState(false);
  const open = tasks.filter(isOpen).length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  return (
    <section className={`group ${folded ? "folded" : ""}`}>
      <header className="group-head">
        <IconButton label={folded ? `Expand ${project.name}` : `Fold ${project.name}`} onClick={() => setFolded(!folded)}>
          <ChevronDown size={16} className="fold-icon" />
        </IconButton>
        <div className="group-title">
          <h2>{project.name}</h2>
          {project.description && <p>{project.description}</p>}
        </div>
        <span className="group-stats">
          {open} open{blocked > 0 && <> · <span className="bad">{blocked} blocked</span></>}
        </span>
        <div className="group-actions">
          <IconButton label={`Edit ${project.name}`} onClick={onEdit}><Pencil size={15} /></IconButton>
          <IconButton label={`Delete ${project.name}`} className="danger" onClick={onDelete}><Trash2 size={15} /></IconButton>
        </div>
      </header>
      {!folded && (
        <ul className="rows">
          {sortTasks(tasks).map((t) => <Row key={t.id} task={t} onOpen={() => onOpenTask(t.id)} />)}
          {tasks.length === 0 && <li className="rows-empty">{filtered ? "No matching tasks" : "No tasks yet"}</li>}
          <li><button type="button" className="add-row" onClick={onAdd}><Plus size={15} strokeWidth={2.5} />Add task</button></li>
        </ul>
      )}
    </section>
  );
}

export function Projects({ projects, tasks, filtered, projectId, onOpenTask, onAdd, onNew, onEdit, onDelete }: {
  projects: Project[];
  tasks: Task[]; // already filtered
  filtered: boolean;
  projectId?: number;
  onOpenTask: (id: number) => void;
  onAdd: (p: Project) => void;
  onNew: () => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const shown = projectId ? projects.filter((p) => p.id === projectId) : projects;
  // While filtering, hide projects with nothing to show so the list stays short.
  const groups = shown
    .map((p) => ({ project: p, tasks: tasks.filter((t) => t.project_id === p.id) }))
    .filter((g) => !filtered || g.tasks.length > 0);
  return (
    <div className="list-view">
      <div className="list-toolbar">
        <button className="btn" onClick={onNew}><FolderPlus size={16} />New project</button>
      </div>
      {groups.length === 0 && <div className="empty"><p>No tasks match these filters.</p></div>}
      {groups.map(({ project, tasks }) => (
        <Group
          key={project.id} project={project} tasks={tasks} filtered={filtered}
          onOpenTask={onOpenTask} onAdd={() => onAdd(project)}
          onEdit={() => onEdit(project)} onDelete={() => onDelete(project)}
        />
      ))}
    </div>
  );
}
