import os

STATUSES = ["backlog", "todo", "in_progress", "blocked", "done", "cancelled"]
PRIORITIES = ["low", "medium", "high", "urgent"]


def env(name: str, default: str | None = None) -> str | None:
    """RAIL_<name>, falling back to FFLOOM_<name> from before the rename."""
    return os.environ.get(f"RAIL_{name}") or os.environ.get(f"FFLOOM_{name}") or default
