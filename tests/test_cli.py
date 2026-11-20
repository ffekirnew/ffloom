import json
import threading

import pytest
import uvicorn

from rail import cli, server


@pytest.fixture
def url(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "DB_PATH", str(tmp_path / "rail.db"))
    config = uvicorn.Config(server.app, host="127.0.0.1", port=0, log_level="error")
    srv = uvicorn.Server(config)
    thread = threading.Thread(target=srv.run, daemon=True)
    thread.start()
    while not srv.started:
        pass
    port = srv.servers[0].sockets[0].getsockname()[1]
    yield f"http://127.0.0.1:{port}"
    srv.should_exit = True
    thread.join()


@pytest.fixture
def run(url, monkeypatch, capsys):
    monkeypatch.setenv("RAIL_URL", url)
    monkeypatch.setenv("RAIL_AGENT", "Claude Code")
    monkeypatch.setenv("RAIL_MODEL", "Opus 5.5")

    def run(*argv):
        code = cli.main(list(argv))
        out = capsys.readouterr()
        return code, out.out, out.err

    return run


def as_json(run, *argv):
    code, out, err = run(*argv, "--json")
    assert code == 0, err
    return json.loads(out)


def test_agent_workflow(run):
    as_json(run, "project", "add", "self-host")
    t = as_json(run, "add", "Upgrade Jellyfin", "-p", "SELF-HOST", "-t", "coding", "--priority", "high", "--me")
    assert t["assignee"] == {"kind": "agent", "agent": "Claude Code", "model": "Opus 5.5"}

    as_json(run, "move", str(t["id"]), "blocked", "-c", "waiting on upstream release")
    shown = as_json(run, "show", str(t["id"]))
    assert shown["status"] == "blocked"
    assert shown["comments"][0]["body"] == "waiting on upstream release"

    assert [x["id"] for x in as_json(run, "list", "--assignee", "me")] == [t["id"]]
    as_json(run, "move", str(t["id"]), "done")
    assert as_json(run, "list") == []
    assert len(as_json(run, "list", "--all")) == 1

    code, out, _ = run("activity")
    assert code == 0 and "Claude Code (Opus 5.5)" in out and "status: blocked → done" in out


def test_changes_need_an_agent_name(run, monkeypatch):
    monkeypatch.delenv("RAIL_AGENT")
    code, _, err = run("project", "add", "x")
    assert code == 1 and "RAIL_AGENT" in err


def test_unknown_project_lists_the_real_ones(run):
    as_json(run, "project", "add", "home")
    code, _, err = run("add", "x", "-p", "nope")
    assert code == 1 and "home" in err


def test_there_is_no_delete_command(run):
    with pytest.raises(SystemExit):
        run("delete", "1")
