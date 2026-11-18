import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { Calendar, ChevronsLeftRight, ChevronsRightLeft, Flag, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { STATUSES, STATUS_LABELS, Status, Task, today, who } from "./api";
import { inDays, isOverdue } from "./filters";
import { Avatar, IconButton, StatusDot, StatusIcon } from "./ui";

// Done only shows what was finished recently; everything stays in the Projects list.
const DONE_DAYS = 14;

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);

export function dueLabel(iso: string): string {
  const diff = daysBetween(today(), iso);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff < 0) return `Overdue ${-diff}d`;
  if (diff < 7) return `Due ${new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}`;
  return `Due ${new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function DueChip({ task }: { task: Task }) {
  if (!task.due_date) return null;
  const overdue = isOverdue(task);
  const Icon = overdue ? Flag : Calendar;
  const soon = !overdue && task.due_date === today();
  return (
    <span className={`chip due ${overdue ? "overdue" : soon ? "today" : ""}`}>
      <Icon size={12} strokeWidth={2.25} />{dueLabel(task.due_date)}
    </span>
  );
}

export function PriorityBadge({ task }: { task: Task }) {
  // Medium is the default, so only the others get a badge.
  if (task.priority === "medium") return null;
  return <span className={`prio ${task.priority}`}>{task.priority[0].toUpperCase() + task.priority.slice(1)}</span>;
}

function CardBody({ task, showProject }: { task: Task; showProject: boolean }) {
  return (
    <>
      <div className="card-top">
        <StatusIcon status={task.status} />
        <PriorityBadge task={task} />
        <span className="card-title">{task.title}</span>
      </div>
      {task.status === "blocked" && task.latest_comment && (
        <div className="blocked-reason" title={`${who(task.latest_comment.actor)}: ${task.latest_comment.body}`}>
          {task.latest_comment.body}
        </div>
      )}
      <div className="meta">
        <span className="chip mono">#{task.id}</span>
        {showProject && <span className="chip">{task.project}</span>}
        <DueChip task={task} />
        {task.tags.map((g) => <span key={g} className="chip mono">{g}</span>)}
        <span className="spacer" />
        {task.assignee && <span title={who(task.assignee)}><Avatar actor={task.assignee} size={20} /></span>}
      </div>
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

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = daysBetween(d.toLocaleDateString("sv"), today());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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
        <IconButton label={`Expand ${label}`} onClick={onToggle}><ChevronsLeftRight size={15} /></IconButton>
        <StatusDot status={status} />
        <span className="collapsed-label">{label}</span>
        <span className="count">{tasks.length}</span>
      </section>
    );
  }
  // Done is grouped by the day each task was finished (its last update).
  let lastDay = "";
  return (
    <section ref={setNodeRef} className={`column ${isOver ? "over" : ""}`}>
      <header className="column-head">
        <StatusDot status={status} />
        <h2>{label}</h2>
        {status === "done" && <span className="column-note">last {DONE_DAYS} days</span>}
        <span className="spacer" />
        <span className="count">{tasks.length}</span>
        <IconButton label={`Collapse ${label}`} onClick={onToggle}><ChevronsRightLeft size={15} /></IconButton>
      </header>
      <div className="cards">
        {tasks.map((t) => {
          let divider = null;
          if (status === "done") {
            const day = dayLabel(t.updated_at);
            if (day !== lastDay) {
              const n = tasks.filter((x) => dayLabel(x.updated_at) === day).length;
              divider = <div className="day-divider"><span>{day}</span><hr /><span>{n}</span></div>;
              lastDay = day;
            }
          }
          return (
            <Fragment key={t.id}>
              {divider}
              <Card task={t} showProject={showProject} onOpen={() => onOpen(t.id)} />
            </Fragment>
          );
        })}
      </div>
      {status !== "done" && status !== "cancelled" && (
        <button type="button" className="add-card" onClick={onAdd}><Plus size={15} strokeWidth={2.25} />Add task</button>
      )}
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
  const cutoff = inDays(-DONE_DAYS);
  const inColumn = (s: Status) => {
    const ts = tasks.filter((t) => t.status === s);
    if (s !== "done") return ts;
    return ts.filter((t) => t.updated_at.slice(0, 10) >= cutoff).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  };
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="board">
        {STATUSES.map((s) => (
          <Column
            key={s} status={s} tasks={inColumn(s)} showProject={showProject}
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
