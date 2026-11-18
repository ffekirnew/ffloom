import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { TaskEvent, api, describeEvent, relTime, who } from "./api";
import { Avatar } from "./ui";

const PAGE = 50;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function Activity({ projectId, refreshKey, onOpen, onError }: {
  projectId?: number;
  refreshKey: number;
  onOpen: (id: number) => void;
  onError: (e: unknown) => void;
}) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [more, setMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.activity({ limit: PAGE, projectId })
      .then((ev) => { setEvents(ev); setMore(ev.length === PAGE); setLoaded(true); })
      .catch(onError);
  }, [projectId, refreshKey]);

  const loadMore = () =>
    api.activity({ limit: PAGE, projectId, beforeId: events[events.length - 1]?.id })
      .then((ev) => { setEvents([...events, ...ev]); setMore(ev.length === PAGE); })
      .catch(onError);

  if (loaded && events.length === 0) return <div className="empty"><History size={32} strokeWidth={1.5} /><p>No activity yet.</p></div>;

  let lastDay = "";
  return (
    <div className="activity">
      {events.map((e) => {
        const day = dayLabel(e.created_at);
        const header = day !== lastDay ? <h3>{day}</h3> : null;
        lastDay = day;
        const live = e.task_id !== null && e.kind !== "deleted";
        return (
          <div key={e.id}>
            {header}
            <div className="event">
              <Avatar actor={e.actor} size={30} />
              <div className="line">
                <span className={`actor ${e.actor.kind}`}>{who(e.actor)}</span>{" "}
                {describeEvent(e)}
                {e.task_title && (
                  <>
                    {" "}
                    {live
                      ? <button className="task-link" onClick={() => onOpen(e.task_id!)}>#{e.task_id} {e.task_title}</button>
                      : <span>#{e.task_id} {e.task_title}</span>}
                  </>
                )}
                {e.kind === "commented" && <div className="quote">{e.data.body}</div>}
              </div>
              <div className="sub">{e.project ?? ""}{e.project ? " · " : ""}{relTime(e.created_at)}</div>
            </div>
          </div>
        );
      })}
      {more && <div className="load-more"><button className="btn" onClick={loadMore}>Load more</button></div>}
    </div>
  );
}
