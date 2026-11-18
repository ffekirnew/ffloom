---
name: ffloom-plan
description: Turn a one-line goal ("learn driving in 2027", "run a half marathon", "ship opengym v1") into a SMART project on the user's ffloom board. Interviews the user one question at a time to pin down scope and requirements, checks the goal against SMART, then creates the project, milestones and first tasks with the `ffloom` CLI once the user approves. Use when the user asks to plan a project or goal, or gives a bare one-line goal and wants help making it real.
---

# Plan a project from one line

The user gives you a goal in a sentence. By the end, there is a project on their ffloom board with a goal that is Specific, Measurable, Achievable, Relevant and Time-bound, a short list of dated milestones, and the next few tasks, so they know what to do this week.

Read the `ffloom` skill before writing to the board: it covers the CLI, the `FFLOOM_AGENT`/`FFLOOM_MODEL` variables and the rule that you never delete anything.

Run the steps in order. Don't skip ahead to a plan before the interview has given you what it needs.

## 1. Restate and check the board

- Say back what you understood in one sentence, and say you'll ask a few questions, one at a time.
- Run `date +%F` so every date you propose is real. Don't guess today's date.
- Run `ffloom projects --json` and `ffloom list -q <key words> --all --json`. If a project or tasks for this goal already exist, say so and ask whether to plan inside it or start fresh.

## 2. Interview, one question at a time

Ask **one** question per message and wait for the answer. Build each question on the last answer; don't run down a fixed list. Use the AskUserQuestion tool when the answer has a few likely options (offer them, with your recommendation first); ask in plain text when it's open-ended.

Cover these areas, in roughly this order, skipping any the user has already answered:

| Area | What you need to learn | SMART |
| --- | --- | --- |
| Why | What having this changes for them. Why now. | Relevant |
| Done | What exactly is true when it's finished. One observable result, not an activity ("pass the practical test", not "learn driving"). | Specific |
| Evidence | How they'll know: a test, a number, a date, a thing that exists. | Measurable |
| Deadline | The date it must be done by, and whether that date is hard or soft. Turn "in 2027" into a day. | Time-bound |
| Starting point | What they already have: skills, gear, progress, paperwork. | Achievable |
| Capacity | Hours per week, money, other people they depend on, seasons or events in the way. | Achievable |
| Out of scope | What they are deliberately *not* doing (e.g. "no motorway lessons", "no own car yet"). | Specific |
| Risks | What has stopped them before, and what could stop them now. | Achievable |

Rules for the interview:

- Look up facts you can find yourself (how a licence process works where they live, typical lesson counts, waiting times) instead of asking. If you can search the web, do; say where a number comes from and how sure you are. Then ask the user to confirm what applies to them.
- When an answer is vague ("soon", "get fit", "a few hours"), ask a follow-up that makes it concrete before moving on.
- Stop when you can fill in every row of the SMART check below. That's usually 5–10 questions. If the user says "just plan it", stop and state the assumptions you're making instead.

## 3. Check it against SMART

Write the goal as one sentence, then show the check:

```markdown
**Goal:** Pass the practical driving test by 30 June 2027.

| | Check | Verdict |
| --- | --- | --- |
| Specific | One result: a passed practical test, manual car | ✅ |
| Measurable | Test result; mock test scores on the way | ✅ |
| Achievable | ~45 hours of lessons at 2 h/week = 23 weeks; budget covers 30 lessons | ⚠️ budget short by ~8 lessons |
| Relevant | Needed for the new job in Q3 2027 | ✅ |
| Time-bound | 30 June 2027; test slots book ~8 weeks ahead | ✅ |
```

Do the arithmetic for Achievable out loud (hours needed ÷ hours a week, cost against budget, lead times). Where something fails or is tight, say so plainly and offer two or three ways to fix it: move the date, cut the scope, add capacity. Let the user choose. Don't quietly plan around a goal that doesn't fit.

## 4. Draft the plan

Show the whole plan before touching the board:

- **Project name**: short kebab-case, e.g. `driving-licence`.
- **Goal**: the SMART sentence. This becomes the project description, which the UI shows as plain text, so keep it to one or two sentences.
- **Scope**: in and out, as two short lists.
- **Milestones**: 3–6, each an observable result with a date. Work backwards from the deadline and leave slack (about 10–20%) before it. Account for lead times (bookings, deliveries, approvals).
- **First tasks**: 3–7 concrete next actions for the first milestone, each something they can do in one sitting, starting with a verb ("Book theory test", not "Theory"). The first one should be doable this week.
- **Later milestones**: list the steps you expect, but don't create tasks for them yet; they get broken down when the previous milestone is done.
- **Risks**: each with what they'll do if it happens.
- **Reviews**: a check-in at every milestone date.

Then show the exact `ffloom` commands you'll run, and ask for approval. Change the plan as many times as they want. Write nothing to the board until they say yes.

## 5. Write it to ffloom

Only after approval. Set your identity on every command, as the `ffloom` skill says. Map the plan like this:

| Plan part | In ffloom |
| --- | --- |
| Project | `ffloom project add <name> -d "<SMART goal sentence>"` |
| Full plan | One task, `Review plan: <goal>`, tag `plan`, status `todo`, due at the first milestone, assigned `--user`, description = the whole plan in markdown (goal, SMART table, scope, milestones, risks), passed with `-d -` on stdin |
| Milestone | One task per milestone, title = the result ("Theory test passed"), tag `milestone`, status `backlog` (the first one `todo`), `--due` = its date, assigned `--user`, description = what done means and the steps you expect |
| First tasks | Status `todo`, assigned `--user`, a due date only where there is a real one (a booking, a deadline), priority `medium` unless the user said otherwise |

ffloom has no child tasks or dependencies yet, so milestones carry the order through their due dates and descriptions. Don't encode it any other way.

For example:

```bash
export FFLOOM_AGENT="Claude Code" FFLOOM_MODEL="Opus 5.5"
ffloom project add driving-licence -d "Pass the practical driving test (manual) by 30 June 2027."
ffloom add "Review plan: pass the driving test by 30 June 2027" -p driving-licence -t plan --user --due 2027-01-31 -d - <<'EOF'
## Goal
...
EOF
ffloom add "Provisional licence received" -p driving-licence -t milestone --user --due 2026-12-15 -d "Done when the licence has arrived. Steps: apply online, send ID."
ffloom add "Apply for a provisional licence" -p driving-licence --user
```

Then run `ffloom list -p <project> --json` and check that every task is there with the right status, tags and dates. Finish with a short summary: the goal, the milestones with dates, and the one task to do first.

## When a milestone comes due later

If the user asks you to review a project made with this skill, read its `plan` task and milestones, then:

- Ask how the milestone went, one question at a time, and record the answer as a comment on the milestone.
- Move finished milestones to `done`, and break the next milestone into tasks the same way as step 4.
- If the dates no longer hold, rerun the Achievable check and propose new dates. Update the plan task's description and the milestones' due dates, and comment on what changed and why.
- Move the `plan` task's due date to the next milestone, so the review keeps coming back.
