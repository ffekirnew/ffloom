import { useEffect, useState } from "react";
import {
  Actor, PRIORITIES, Priority, Project, STATUSES, STATUS_LABELS, Status, TaskDetail,
  api, describeEvent, relTime, who,
} from "./api";
import { Eye, Pencil, Send, Trash2, X } from "lucide-react";
import { renderMarkdown } from "./markdown";
import { Avatar, IconButton, Select } from "./ui";

interface Draft {
  title: string;
  description: string;
  project_id: number;
  status: Status;
  priority: Priority;
  due_date: string;
  tags: string;
  assignee: string; // key into the assignee options
}

export const keyOf = (a: Actor | null) =>
  !a ? "" : a.kind === "user" ? "user" : JSON.stringify([a.agent ?? null, a.model ?? null]);

function actorOf(key: string): Actor | null {
  if (!key) return null;
  if (key === "user") return { kind: "user" };
  const [agent, model] = JSON.parse(key);
  return { kind: "agent", agent, model };
}

const parseTags = (s: string) => s.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean);

export function TaskModal({ taskId, projects, defaultProjectId, defaultStatus, knownAgents, onClose, onChanged, onError }: {
  taskId: number | null; // null = new task
  projects: Project[];
  defaultProjectId?: number;
  defaultStatus?: Status;
  knownAgents: Actor[];
  onClose: () => void;
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingDesc, setEditingDesc] = useState(taskId === null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const fromTask = (t: TaskDetail): Draft => ({
    title: t.title, description: t.description, project_id: t.project_id, status: t.status,
    priority: t.priority, due_date: t.due_date ?? "", tags: t.tags.map((g) => "#" + g).join(" "),
    assignee: keyOf(t.assignee),
  });

  const load = () => api.task(taskId!).then((t) => { setTask(t); setDraft(fromTask(t)); }).catch((e) => { onError(e); onClose(); });

  useEffect(() => {
    if (taskId === null) {
      setDraft({
        title: "", description: "", project_id: defaultProjectId ?? projects[0]?.id ?? 0,
        status: defaultStatus ?? "todo", priority: "medium", due_date: "", tags: "", assignee: "",
      });
    } else {
      load();
    }
  }, [taskId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!draft) return null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const agents = [...knownAgents];
  if (task?.assignee?.kind === "agent" && !agents.some((a) => keyOf(a) === keyOf(task.assignee))) agents.push(task.assignee);

  const patch = (): Record<string, unknown> => {
    if (!task) return {};
    const p: Record<string, unknown> = {};
    const base = fromTask(task);
    for (const k of ["title", "description", "project_id", "status", "priority"] as const) {
      if (draft[k] !== base[k]) p[k] = draft[k];
    }
    if (draft.due_date !== base.due_date) p.due_date = draft.due_date || null;
    if (draft.tags !== base.tags) p.tags = parseTags(draft.tags);
    if (draft.assignee !== base.assignee) p.assignee = actorOf(draft.assignee);
    return p;
  };
  const dirty = taskId === null ? draft.title.trim() !== "" : Object.keys(patch()).length > 0;

  const run = async (fn: () => Promise<unknown>, close = true) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
      if (close) onClose();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(() =>
    taskId === null
      ? api.createTask({
          title: draft.title, description: draft.description, project_id: draft.project_id, status: draft.status,
          priority: draft.priority, due_date: draft.due_date || null, tags: parseTags(draft.tags),
          assignee: actorOf(draft.assignee),
        })
      : api.updateTask(taskId, patch()),
  );

  const addComment = () => run(async () => { await api.comment(taskId!, comment); setComment(""); await load(); }, false);

  const remove = () => {
    if (confirm(`Delete #${taskId} "${task?.title}"? This can't be undone.`)) run(() => api.deleteTask(taskId!));
  };

  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <input
            className="title-input" type="text" placeholder="Task title" autoFocus={taskId === null}
            value={draft.title} onChange={(e) => set("title", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && dirty) save(); }}
          />
          {task && <span className="task-id">#{task.id}</span>}
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>

        <div className="fields">
          <label>Project
            <Select value={draft.project_id} onChange={(e) => set("project_id", Number(e.target.value))}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </label>
          <label>Status
            <Select value={draft.status} onChange={(e) => set("status", e.target.value as Status)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </Select>
          </label>
          <label>Priority
            <Select value={draft.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </label>
          <label>Due
            <input type="date" value={draft.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </label>
          <label>Assignee
            <Select value={draft.assignee} onChange={(e) => set("assignee", e.target.value)}>
              <option value="">Unassigned</option>
              <option value="user">You</option>
              {agents.map((a) => <option key={keyOf(a)} value={keyOf(a)}>{who(a)}</option>)}
            </Select>
          </label>
          <label>Tags
            <input type="text" placeholder="#coding #urgent" value={draft.tags} onChange={(e) => set("tags", e.target.value)} />
          </label>
        </div>

        <div>
          <div className="section-title">
            <span>Description</span>
            {taskId !== null && (
              <IconButton label={editingDesc ? "Preview" : "Edit description"} onClick={() => setEditingDesc(!editingDesc)}>
                {editingDesc ? <Eye size={15} /> : <Pencil size={15} />}
              </IconButton>
            )}
          </div>
          {editingDesc
            ? <textarea rows={8} placeholder="Markdown" value={draft.description} onChange={(e) => set("description", e.target.value)} />
            : draft.description
              ? <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.description) }} />
              : <button type="button" className="placeholder" onClick={() => setEditingDesc(true)}>Add a description…</button>}
        </div>

        <div className="actions">
          {task ? <button className="btn danger" onClick={remove} disabled={busy}><Trash2 size={15} />Delete</button> : <span />}
          <div className="right">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={!dirty || busy || !draft.project_id}>
              {taskId === null ? "Create" : "Save"}
            </button>
          </div>
        </div>

        {task && (
          <>
            <div>
              <div className="section-title"><span>Comments</span></div>
              {task.comments.map((c) => (
                <div key={c.id} className="comment">
                  <Avatar actor={c.actor} size={26} />
                  <div>
                    <div className="by"><strong>{who(c.actor)}</strong> · {relTime(c.created_at)}</div>
                    <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }} />
                  </div>
                </div>
              ))}
              <div className="comment-box">
                <textarea rows={2} placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                <IconButton label="Post comment" className="accent" onClick={addComment} disabled={!comment.trim() || busy}>
                  <Send size={16} />
                </IconButton>
              </div>
            </div>
            <div>
              <div className="section-title"><span>History</span></div>
              <div className="history">
                {task.history.map((e) => (
                  <div key={e.id} className="history-row">
                    <Avatar actor={e.actor} size={18} />
                    <span><strong>{who(e.actor)}</strong> {describeEvent(e)} · {relTime(e.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
