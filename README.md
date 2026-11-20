# rail

A task board for one person and their AI agents. Agents use the `rail` CLI to add and move tasks; the person uses the web UI. Every change records who made it: an agent and its model (`Claude Code` · `Opus 5.5`), or the user.

- **Server:** FastAPI + SQLite (`src/rail/server.py`), serving the JSON API under `/api` and the UI at `/`.
- **UI:** React + Vite (`web/`). Kanban board with collapsible columns, plus an activity feed.
- **CLI:** `src/rail/cli.py`. Standard library only, so it installs with no dependencies.
- **Agent skills:** `skill/rail/SKILL.md` teaches agents the CLI and the no-delete rule. `skill/rail-plan/SKILL.md` turns a one-line goal into a SMART project: it interviews you one question at a time, then creates the project, milestones and first tasks once you approve.

The server trusts whatever reaches it: it has no login and doesn't verify the agent name. Put it behind something that authenticates people (e.g. Cloudflare Access), and run the CLI only where the API isn't exposed to anyone else. See [self-host RFC-0010](https://github.com/ffekirnew/self-host/blob/master/docs/rfcs/0010-task-manager.md) for the design.

## Install the CLI

```bash
uv tool install git+https://github.com/ffekirnew/rail   # or: uv tool install ~/code/rail
export RAIL_URL=http://127.0.0.1:8020                   # the default
export RAIL_AGENT="Claude Code" RAIL_MODEL="Opus 5.5"  # needed to make changes
rail --help
```

The CLI has no delete command: deleting is done in the UI only.

## Install the agent skill (Claude Code)

```bash
ln -s ~/code/rail/skill/rail ~/.claude/skills/rail
ln -s ~/code/rail/skill/rail-plan ~/.claude/skills/rail-plan
```

## Run it

```bash
docker run -p 127.0.0.1:8020:8000 -v ~/rail-data:/data -u 1000:1000 ghcr.io/ffekirnew/rail
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `RAIL_DB` | `/data/rail.db` in the image | SQLite file. Schema migrations run on startup. |
| `RAIL_WEB_DIR` | `/app/web` in the image | built UI; not served if the folder is missing |

## Upgrading from ffloom

rail was called ffloom. Existing setups keep working:

- The old `FFLOOM_*` variables are read when the `RAIL_*` one is unset.
- On startup, a `ffloom.db` next to the configured database is renamed to it, with its WAL files, unless that database already exists.
- The server accepts the old `X-Ffloom-Agent` / `X-Ffloom-Model` headers, so an old CLI still records changes under its agent. Update the server first: a new CLI sends `X-Rail-*`, which an old server reads as the user.
- The UI picks up your saved theme and project from before.

Reinstall the CLI (`uv tool uninstall ffloom && uv tool install ...`) and re-point the skill symlinks to `skill/rail` and `skill/rail-plan`.

## Develop

```bash
uv venv && uv pip install -e '.[dev]'
.venv/bin/pytest
RAIL_DB=dev.db .venv/bin/uvicorn rail.server:app --port 8020 --reload
cd web && npm install && npm run dev   # proxies /api to :8020
```

Pushing to `main` runs the tests and publishes `ghcr.io/ffekirnew/rail:latest`; a `v*` tag also publishes that version.
