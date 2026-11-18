# ffloom

A task board for one person and their AI agents. Agents use the `ffloom` CLI to add and move tasks; the person uses the web UI. Every change records who made it: an agent and its model (`Claude Code` · `Opus 5.5`), or the user.

- **Server:** FastAPI + SQLite (`src/ffloom/server.py`), serving the JSON API under `/api` and the UI at `/`.
- **UI:** React + Vite (`web/`). Kanban board with collapsible columns, plus an activity feed.
- **CLI:** `src/ffloom/cli.py`. Standard library only, so it installs with no dependencies.
- **Agent skills:** `skill/ffloom/SKILL.md` teaches agents the CLI and the no-delete rule. `skill/ffloom-plan/SKILL.md` turns a one-line goal into a SMART project: it interviews you one question at a time, then creates the project, milestones and first tasks once you approve.

The server trusts whatever reaches it: it has no login and doesn't verify the agent name. Put it behind something that authenticates people (e.g. Cloudflare Access), and run the CLI only where the API isn't exposed to anyone else. See [self-host RFC-0010](https://github.com/ffekirnew/self-host/blob/master/docs/rfcs/0010-task-manager.md) for the design.

## Install the CLI

```bash
uv tool install git+https://github.com/ffekirnew/ffloom   # or: uv tool install ~/code/ffloom
export FFLOOM_URL=http://127.0.0.1:8020                   # the default
export FFLOOM_AGENT="Claude Code" FFLOOM_MODEL="Opus 5.5"  # needed to make changes
ffloom --help
```

The CLI has no delete command: deleting is done in the UI only.

## Install the agent skill (Claude Code)

```bash
ln -s ~/code/ffloom/skill/ffloom ~/.claude/skills/ffloom
ln -s ~/code/ffloom/skill/ffloom-plan ~/.claude/skills/ffloom-plan
```

## Run it

```bash
docker run -p 127.0.0.1:8020:8000 -v ~/ffloom-data:/data -u 1000:1000 ghcr.io/ffekirnew/ffloom
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `FFLOOM_DB` | `/data/ffloom.db` in the image | SQLite file. Schema migrations run on startup. |
| `FFLOOM_WEB_DIR` | `/app/web` in the image | built UI; not served if the folder is missing |

## Develop

```bash
uv venv && uv pip install -e '.[dev]'
.venv/bin/pytest
FFLOOM_DB=dev.db .venv/bin/uvicorn ffloom.server:app --port 8020 --reload
cd web && npm install && npm run dev   # proxies /api to :8020
```

Pushing to `main` runs the tests and publishes `ghcr.io/ffekirnew/ffloom:latest`; a `v*` tag also publishes that version.
