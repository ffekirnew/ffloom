import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { Calendar, ChevronsLeftRight, ChevronsRightLeft, Flag, Plus } from "lucide-react";
import { useState } from "react";
import { STATUSES, STATUS_LABELS, Status, Task, today, who } from "./api";
import { Avatar, IconButton } from "./ui";

export function dueLabel(iso: string): string {
  const t = today();
  if (iso === t) return "Today";
  const d = new Date(iso + "T00:00:00");
  const diff = Math.round((d.getTime() - new Date(t + "T00:00:00").getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskMeta({ task, showProject }: { task: Task; showProject: boolean }) {
  const t = today();
  const open = !["done", "cancelled"].includes(task.status);
  const dueClass = task.due_date && open ? (task.due_date < t ? "overdue" : task.due_date === t ? "today" : "") : "";
  const flagged = task.priority === "high" || task.priority === "urgent";
  if (!flagged && !task.due_date && !task.assignee && !showProject && task.tags.length === 0) return null;
  return (
    <>
      {task.tags.length > 0 && (
        <div className="chips">{task.tags.map((g) => <span key={g} className="chip">#{g}</span>)}</div>
      )}
      <div className="meta">
        {showProject && <span className="project-name">{task.project}</span>}
        {flagged && (
          <span className={`flag ${task.priority}`} title={`${task.priority} priority`}>
            <Flag size={12} strokeWidth={2.5} fill="currentColor" />
            {task.priority === "urgent" ? "Urgent" : "High"}
          </span>
        )}
        {task.due_date && (
          <span className={`due ${dueClass}`}><Calendar size={12} strokeWidth={2.5} />{dueLabel(task.due_date)}</span>
        )}
        <span className="spacer" />
        {task.assignee && <span title={who(task.assignee)}><Avatar actor={task.assignee} /></span>}
      </div>
    </>
  );
}

function CardBody({ task, showProject }: { task: Task; showProject: boolean }) {
  return (
    <>
      <div className="card-title">{task.title}</div>
      {task.status === "blocked" && task.latest_comment && (
        <div className="blocked-reason" title={`${who(task.latest_comment.actor)}: ${task.latest_comment.body}`}>
          {task.latest_comment.body}
        </div>
      )}
      <TaskMeta task={task} showProject={showProject} />
    </>
  );
}

const closedClass = (t: Task) => (t.status === "done" || t.status === "cancelled" ? "closed" : "");

// The card stays in its column as a faded placeholder while a copy follows the
// pointer in <DragOverlay>: the column's card list scrolls, which would clip it.
function Card({ task, showProject, onOpen }: { task: Task; showProject: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      className={`card ${isDragging ? "placeholder-card" : ""} ${closedClass(task)}`}
      onClick={onOpen}
      {...listeners}
      {...attributes}
    >
      <CardBody task={task} showProject={showProject} />
    </div>
  );
}

function Column({ status, tasks, showProject, collapsed, onToggle, onOpen, onAdd }: {
  status: Status; tasks: Task[]; showProject: boolean; collapsed: boolean;
  onToggle: () => void; onOpen: (id: number) => void; onAdd: () => void;
}) {
  // A collapsed column still takes drops, so a card can be sent to Done without opening it.
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const label = STATUS_LABELS[status];
  if (collapsed) {
    return (
      <section ref={setNodeRef} className={`column collapsed ${isOver ? "over" : ""}`}>
        <IconButton label={`Expand ${label}`} onClick={onToggle}><ChevronsLeftRight size={16} /></IconButton>
        <span className="count">{tasks.length}</span>
        <span className="collapsed-label">{label}</span>
      </section>
    );
  }
  return (
    <section ref={setNodeRef} className={`column ${isOver ? "over" : ""}`}>
      <header className="column-head">
        <h2>{label}</h2>
        <span className="count">{tasks.length}</span>
        <span className="spacer" />
        <IconButton label={`Collapse ${label}`} onClick={onToggle}><ChevronsRightLeft size={16} /></IconButton>
      </header>
      <div className="cards">
        {tasks.map((t) => <Card key={t.id} task={t} showProject={showProject} onOpen={() => onOpen(t.id)} />)}
      </div>
      <button type="button" className="add-card" onClick={onAdd}><Plus size={16} strokeWidth={2.5} />Add task</button>
    </section>
  );
}

export function Board({ tasks, showProject, collapsed, onToggle, onOpen, onMove, onAdd }: {
  tasks: Task[];
  showProject: boolean;
  collapsed: Set<Status>;
  onToggle: (s: Status) => void;
  onOpen: (id: number) => void;
  onMove: (task: Task, status: Status) => void;
  onAdd: (s: Status) => void;
}) {
  // A small distance threshold keeps a click on a card from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = tasks.find((t) => t.id === activeId);
  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const task = tasks.find((t) => t.id === e.active.id);
    const status = e.over?.id as Status | undefined;
    if (task && status && status !== task.status) onMove(task, status);
  };
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="board">
        {STATUSES.map((s) => (
          <Column
            key={s} status={s} tasks={tasks.filter((t) => t.status === s)} showProject={showProject}
            collapsed={collapsed.has(s)} onToggle={() => onToggle(s)} onOpen={onOpen} onAdd={() => onAdd(s)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className={`card lifted ${closedClass(active)}`}>
            <CardBody task={active} showProject={showProject} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
