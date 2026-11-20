---
name: rail
description: Read and update the user's task board (coding work and life admin) with the `rail` CLI. Use when the user asks you to add, find, move, assign or comment on a task, mentions their board, todo list or backlog, or when you start, finish or get blocked on work that has a task.
---

# The rail CLI

The user tracks their work in one board: projects (e.g. `self-host`, `life-admin`) holding tasks. You can read and change everything in it, except deleting, which you must never do.

## Who you are

Every change is recorded under an agent name and a model. Set both on every call, using your own product name and model:

```bash
export RAIL_AGENT="Claude Code" RAIL_MODEL="Opus 5.5"
```

Exports don't always survive between shell calls, so if a command says to set `RAIL_AGENT`, put the variables on the command itself: `RAIL_AGENT="Claude Code" RAIL_MODEL="Opus 5.5" rail move 12 done`. Never borrow another agent's name, and never leave the agent name out to make a change look like it came from the user.

## Always use `--json` when you'll read the output

```bash
rail projects --json                        # projects and task counts per status
rail list --json                            # open tasks (not done/cancelled) in every project
rail list -p self-host -s blocked --json    # filter: project, status (repeatable), -t tag, -q text
rail list --assignee me --json              # yours; also: user, none, or an agent name
rail list --all --json                      # include done and cancelled
rail show 12 --json                         # one task with its comments and history
rail activity -n 20                         # recent changes by anyone
```

## Changing things

```bash
rail add "Upgrade Jellyfin" -p self-host -t coding --priority high --due 2026-12-01 -d "Context for whoever picks it up"
rail add "Renew passport" -p life-admin --user   # assign to the user
rail move 12 in_progress
rail move 12 blocked -c "Waiting on upstream fix for #4521"
rail assign 12 --me                    # or --user, --agent "Codex" --model "GPT-6.1-Sol", --none
rail update 12 --priority urgent --add-tag waiting --due none
rail comment 12 "Opened PR #31"
rail project add opengym -d "Gym tracker"
```

`-d -` and `rail comment 12 -` read the text from stdin, which is useful for long markdown.

## Statuses

| Status | Use it when |
| --- | --- |
| `backlog` | captured, not planned |
| `todo` | planned, ready to pick up |
| `in_progress` | someone is working on it now. Move a task here when you start it |
| `blocked` | can't move. **Always** pass `-c` with the reason |
| `done` | finished. You may close your own work |
| `cancelled` | dropped. Use this instead of deleting |

## Rules

- **Never delete** tasks or projects. There's no CLI command for it, and you must not call the API's DELETE routes directly. To get rid of a task, move it to `cancelled` with a comment saying why; the user deletes things in the UI.
- Comment when something happens that the user would want to know: a PR opened, a decision made, why a task is blocked or cancelled. Don't comment just to say you moved something; the history already shows that.
- Before you add a task, check that it isn't already there (`rail list -q <words> --all --json`).
- Use an existing project. Create one only when the work clearly belongs to none of them.
- When you finish work that has a task, move it to `done` and comment with what changed (PR, commit, or a one-line summary).
- If the CLI says it can't reach the server, tell the user; don't retry in a loop.
