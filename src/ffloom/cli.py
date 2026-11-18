"""`ffloom`: the command-line client agents use. Standard library only.

Configuration (flags override):
  FFLOOM_URL    API base URL (default http://127.0.0.1:8020)
  FFLOOM_AGENT  who is making changes, e.g. "Claude Code" (required for changes)
  FFLOOM_MODEL  the model, e.g. "Opus 5.5"

There is deliberately no delete command: deleting is done in the UI only.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

from . import PRIORITIES, STATUSES


class CLIError(Exception):
    pass


class Client:
    def __init__(self, url: str, agent: str | None, model: str | None):
        self.url = url.rstrip("/")
        self.agent = agent
        self.model = model

    def request(self, method: str, path: str, body=None, params=None, write=False):
        if write and not self.agent:
            raise CLIError("set FFLOOM_AGENT (or pass --agent) so the change is recorded under your name")
        url = self.url + path
        if params:
            url += "?" + urllib.parse.urlencode(
                [(k, x) for k, v in params.items() if v is not None for x in (v if isinstance(v, list) else [v])]
            )
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if self.agent:
            headers["X-Ffloom-Agent"] = self.agent
        if self.model:
            headers["X-Ffloom-Model"] = self.model
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            try:
                detail = json.loads(detail)["detail"]
            except (ValueError, KeyError, TypeError):
                pass
            raise CLIError(f"{e.code}: {detail}") from None
        except urllib.error.URLError as e:
            raise CLIError(f"can't reach {self.url}: {e.reason}") from None
        return json.loads(raw) if raw else None

    def project_id(self, ref: str) -> int:
        projects = self.request("GET", "/api/projects")
        for p in projects:
            if str(p["id"]) == ref or p["name"].lower() == ref.lower():
                return p["id"]
        names = ", ".join(p["name"] for p in projects) or "none yet"
        raise CLIError(f"no project {ref!r} (projects: {names}). Create it with `ffloom project add`.")


# --- output -----------------------------------------------------------------


def who(a: dict | None) -> str:
    if not a:
        return "-"
    if a["kind"] == "user":
        return "you"
    return f"{a['agent']} ({a['model']})" if a.get("model") else a["agent"]


def table(rows: list[list[str]], headers: list[str]) -> str:
    widths = [max(len(str(x)) for x in col) for col in zip(headers, *rows)]
    fmt = "  ".join(f"{{:<{w}}}" for w in widths)
    return "\n".join(fmt.format(*r).rstrip() for r in [headers, *rows])


def print_tasks(tasks: list[dict]) -> None:
    if not tasks:
        print("no tasks")
        return
    rows = [
        [
            f"#{t['id']}", t["status"], t["priority"], t["project"], t["title"],
            t["due_date"] or "", who(t["assignee"]), " ".join(f"#{g}" for g in t["tags"]),
        ]
        for t in tasks
    ]
    print(table(rows, ["ID", "STATUS", "PRIORITY", "PROJECT", "TITLE", "DUE", "ASSIGNEE", "TAGS"]))


def describe_event(e: dict) -> str:
    kind, data = e["kind"], e["data"]
    if kind == "created":
        return f"created in {data.get('status')}"
    if kind == "commented":
        return f"commented: {data.get('body', '')}"
    if kind == "deleted":
        return "deleted"
    if kind == "updated":
        parts = []
        for field, (old, new) in data.get("changes", {}).items():
            if field == "assignee":
                old, new = who(old), who(new)
            elif field == "description":
                parts.append("edited the description")
                continue
            parts.append(f"{field}: {old or '-'} → {new or '-'}")
        return "; ".join(parts)
    if kind.startswith("project_"):
        return f"{kind.replace('_', ' ')} {data.get('name', '')}".strip()
    return kind


def print_task(t: dict) -> None:
    print(f"#{t['id']} {t['title']}")
    print(f"  project:  {t['project']}")
    print(f"  status:   {t['status']}")
    print(f"  priority: {t['priority']}")
    print(f"  due:      {t['due_date'] or '-'}")
    print(f"  assignee: {who(t['assignee'])}")
    print(f"  tags:     {' '.join('#' + g for g in t['tags']) or '-'}")
    if t["description"]:
        print("\n" + t["description"])
    if t.get("comments"):
        print("\ncomments:")
        for c in t["comments"]:
            print(f"  [{c['created_at']}] {who(c['actor'])}: {c['body']}")
    if t.get("history"):
        print("\nhistory:")
        for e in t["history"]:
            print(f"  [{e['created_at']}] {who(e['actor'])}: {describe_event(e)}")


def output(args, data, printer) -> None:
    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()
    else:
        printer(data)


# --- commands ---------------------------------------------------------------


def cmd_projects(c: Client, args) -> None:
    def show(projects):
        if not projects:
            print("no projects")
            return
        rows = [
            [str(p["id"]), p["name"], " ".join(f"{s}:{n}" for s, n in p["counts"].items()), p["description"]]
            for p in projects
        ]
        print(table(rows, ["ID", "NAME", "TASKS", "DESCRIPTION"]))

    output(args, c.request("GET", "/api/projects"), show)


def cmd_project_add(c: Client, args) -> None:
    p = c.request("POST", "/api/projects", {"name": args.name, "description": args.description}, write=True)
    output(args, p, lambda p: print(f"created project {p['id']} {p['name']}"))


def assignee_from(args, c: Client) -> dict | None:
    if getattr(args, "me", False):
        if not c.agent:
            raise CLIError("--me needs FFLOOM_AGENT")
        return {"kind": "agent", "agent": c.agent, "model": c.model}
    if getattr(args, "user", False):
        return {"kind": "user"}
    if getattr(args, "assign_agent", None):
        return {"kind": "agent", "agent": args.assign_agent, "model": args.assign_model}
    return None


def cmd_add(c: Client, args) -> None:
    body = {
        "project_id": c.project_id(args.project),
        "title": args.title,
        "description": read_text(args.description),
        "status": args.status,
        "priority": args.priority,
        "due_date": args.due,
        "tags": args.tag,
        "assignee": assignee_from(args, c),
    }
    t = c.request("POST", "/api/tasks", body, write=True)
    output(args, t, lambda t: print(f"created #{t['id']} {t['title']} ({t['project']}, {t['status']})"))


def cmd_list(c: Client, args) -> None:
    status = args.status or (None if args.all else [s for s in STATUSES if s not in ("done", "cancelled")])
    params = {
        "project_id": c.project_id(args.project) if args.project else None,
        "status": status,
        "tag": args.tag,
        "q": args.search,
    }
    if args.assignee == "me":
        if not c.agent:
            raise CLIError("--assignee me needs FFLOOM_AGENT")
        params.update(assignee_kind="agent", assignee_agent=c.agent)
    elif args.assignee == "user":
        params["assignee_kind"] = "user"
    elif args.assignee == "none":
        params["assignee_kind"] = "none"
    elif args.assignee:
        params.update(assignee_kind="agent", assignee_agent=args.assignee)
    output(args, c.request("GET", "/api/tasks", params=params), print_tasks)


def cmd_show(c: Client, args) -> None:
    output(args, c.request("GET", f"/api/tasks/{args.id}"), print_task)


def read_text(value: str | None) -> str:
    if value == "-":
        return sys.stdin.read()
    return value or ""


def cmd_update(c: Client, args) -> None:
    body: dict = {}
    if args.title:
        body["title"] = args.title
    if args.description is not None:
        body["description"] = read_text(args.description)
    if args.priority:
        body["priority"] = args.priority
    if args.due:
        body["due_date"] = None if args.due == "none" else args.due
    if args.project:
        body["project_id"] = c.project_id(args.project)
    if args.status:
        body["status"] = args.status
    if args.add_tag:
        body["add_tags"] = args.add_tag
    if args.remove_tag:
        body["remove_tags"] = args.remove_tag
    if not body:
        raise CLIError("nothing to update; see `ffloom update --help`")
    t = c.request("PATCH", f"/api/tasks/{args.id}", body, write=True)
    output(args, t, lambda t: print(f"updated #{t['id']} {t['title']}"))


def cmd_move(c: Client, args) -> None:
    # Comment first, so the history reads "why" before "what".
    if args.comment:
        c.request("POST", f"/api/tasks/{args.id}/comments", {"body": args.comment}, write=True)
    t = c.request("PATCH", f"/api/tasks/{args.id}", {"status": args.status}, write=True)
    output(args, t, lambda t: print(f"#{t['id']} {t['title']} → {t['status']}"))


def cmd_assign(c: Client, args) -> None:
    if args.none:
        assignee = None
    else:
        assignee = assignee_from(args, c)
        if assignee is None:
            raise CLIError("say who: --me, --user, --agent NAME [--model MODEL] or --none")
    t = c.request("PATCH", f"/api/tasks/{args.id}", {"assignee": assignee}, write=True)
    output(args, t, lambda t: print(f"#{t['id']} assigned to {who(t['assignee'])}"))


def cmd_comment(c: Client, args) -> None:
    out = c.request("POST", f"/api/tasks/{args.id}/comments", {"body": read_text(args.body)}, write=True)
    output(args, out, lambda _: print(f"commented on #{args.id}"))


def cmd_activity(c: Client, args) -> None:
    params = {"limit": args.limit, "project_id": c.project_id(args.project) if args.project else None}

    def show(events):
        for e in reversed(events):
            task = f"#{e['task_id']} {e['task_title']}" if e["task_id"] else ""
            print(f"[{e['created_at']}] {who(e['actor'])}: {task} {describe_event(e)}".replace("  ", " "))

    output(args, c.request("GET", "/api/activity", params=params), show)


# --- parser -----------------------------------------------------------------


def add_assignee_flags(p, *, with_none=False) -> None:
    g = p.add_mutually_exclusive_group()
    g.add_argument("--me", action="store_true", help="assign to yourself (FFLOOM_AGENT/FFLOOM_MODEL)")
    g.add_argument("--user", action="store_true", help="assign to the human")
    g.add_argument("--agent", dest="assign_agent", metavar="NAME", help="assign to another agent")
    if with_none:
        g.add_argument("--none", action="store_true", help="unassign")
    p.add_argument("--model", dest="assign_model", help="model of the agent given with --agent")


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", help="print JSON")
    common.add_argument("--url", default=os.environ.get("FFLOOM_URL", "http://127.0.0.1:8020"))
    common.add_argument("--as", dest="agent", default=os.environ.get("FFLOOM_AGENT"), metavar="AGENT",
                        help="who is making the change (default FFLOOM_AGENT)")
    common.add_argument("--as-model", dest="model", default=os.environ.get("FFLOOM_MODEL"), metavar="MODEL",
                        help="your model (default FFLOOM_MODEL)")

    parser = argparse.ArgumentParser(prog="ffloom", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    def cmd(name, fn, help):
        p = sub.add_parser(name, help=help, parents=[common])
        p.set_defaults(fn=fn)
        return p

    cmd("projects", cmd_projects, "list projects")

    p = sub.add_parser("project", help="manage projects")
    psub = p.add_subparsers(dest="project_command", required=True)
    pa = psub.add_parser("add", help="create a project", parents=[common])
    pa.add_argument("name")
    pa.add_argument("-d", "--description", default="")
    pa.set_defaults(fn=cmd_project_add)

    p = cmd("add", cmd_add, "create a task")
    p.add_argument("title")
    p.add_argument("-p", "--project", required=True, help="project name or id")
    p.add_argument("-d", "--description", help="markdown body; '-' reads stdin")
    p.add_argument("-s", "--status", choices=STATUSES, default="todo")
    p.add_argument("--priority", choices=PRIORITIES, default="medium")
    p.add_argument("--due", metavar="YYYY-MM-DD")
    p.add_argument("-t", "--tag", action="append", default=[], help="repeatable")
    add_assignee_flags(p)

    p = cmd("list", cmd_list, "list tasks (open ones unless --all or --status)")
    p.add_argument("-p", "--project")
    p.add_argument("-s", "--status", action="append", choices=STATUSES, help="repeatable")
    p.add_argument("--all", action="store_true", help="include done and cancelled")
    p.add_argument("-t", "--tag")
    p.add_argument("--assignee", help="me, user, none, or an agent name")
    p.add_argument("-q", "--search", help="text in title or description")

    p = cmd("show", cmd_show, "show a task with its comments and history")
    p.add_argument("id", type=int)

    p = cmd("update", cmd_update, "change a task's fields")
    p.add_argument("id", type=int)
    p.add_argument("--title")
    p.add_argument("-d", "--description", help="markdown body; '-' reads stdin")
    p.add_argument("--priority", choices=PRIORITIES)
    p.add_argument("--due", metavar="YYYY-MM-DD|none")
    p.add_argument("-p", "--project", help="move to another project")
    p.add_argument("-s", "--status", choices=STATUSES)
    p.add_argument("--add-tag", action="append", default=[])
    p.add_argument("--remove-tag", action="append", default=[])

    p = cmd("move", cmd_move, "change a task's status")
    p.add_argument("id", type=int)
    p.add_argument("status", choices=STATUSES)
    p.add_argument("-c", "--comment", help="add a comment explaining the move (use for blocked)")

    p = cmd("assign", cmd_assign, "set a task's assignee")
    p.add_argument("id", type=int)
    add_assignee_flags(p, with_none=True)

    p = cmd("comment", cmd_comment, "comment on a task")
    p.add_argument("id", type=int)
    p.add_argument("body", help="'-' reads stdin")

    p = cmd("activity", cmd_activity, "recent changes, oldest first")
    p.add_argument("-p", "--project")
    p.add_argument("-n", "--limit", type=int, default=30)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    client = Client(args.url, args.agent, args.model)
    try:
        args.fn(client, args)
    except CLIError as e:
        print(f"ffloom: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
