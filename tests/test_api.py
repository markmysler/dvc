"""
API tests against a fake Docker client (see conftest.py).

They cover the platform's own guarantees: isolation of spawned challenges,
flag validation, session limits and lifecycle, and import hardening.
"""

import io
import json
import zipfile

import pytest

CHALLENGE = "web-path-traversal"
CSRF = {"X-DVC-Request": "1"}


def spawn(api, user="alice", **extra):
    return api.post("/api/challenges", json={"challenge_id": CHALLENGE, "user_id": user, **extra})


def challenge_container(api, user="alice"):
    return api.docker.containers.list(filters={"label": f"dvc.challenge.user={user}"})[0]


def flag_of(container):
    return container.kwargs["environment"]["CHALLENGE_FLAG"]


# ── Spawning and isolation ────────────────────────────────────────────────

def test_catalogue_lists_shipped_challenge(api):
    response = api.get("/api/challenges")
    assert response.status_code == 200
    ids = [c["id"] for c in response.get_json()["challenges"]]
    assert ids == [CHALLENGE]


def test_spawn_returns_session_and_local_url(api):
    response = spawn(api)
    assert response.status_code == 201
    body = response.get_json()
    assert body["session_id"]
    assert body["access_url"].startswith("http://localhost:")


def test_challenge_runs_alone_on_internal_network(api):
    spawn(api)
    container = challenge_container(api)
    network_name = container.kwargs["network"]
    network = api.docker.networks.get(network_name)

    assert network.kwargs["internal"] is True
    assert container.attrs["NetworkSettings"]["Ports"] == {}  # nothing published directly
    # Only the proxy joins the challenge's network
    assert network.connected == [f"{container.name}-proxy"]


def test_proxy_publishes_on_localhost_only(api):
    spawn(api)
    container = challenge_container(api)
    proxy = api.docker.containers.get(f"{container.name}-proxy")
    bindings = proxy.attrs["NetworkSettings"]["Ports"]["5000/tcp"]
    assert bindings[0]["HostIp"] == "127.0.0.1"


def test_challenge_gets_hardened_profile(api):
    spawn(api)
    run = next(c for c in api.docker.containers.run_calls if c["labels"] and "dvc.challenge.id" in c["labels"])
    assert run["read_only"] is True
    assert run["cap_drop"] == ["ALL"]
    assert run["cap_add"] == []
    assert "seccomp=unconfined" not in run["security_opt"]
    assert "no-new-privileges:true" in run["security_opt"]
    assert run["user"] == "1000:1000"
    assert "/app/runtime" in run["tmpfs"]


# ── Flags ─────────────────────────────────────────────────────────────────

def test_correct_and_wrong_flags(api):
    session_id = spawn(api).get_json()["session_id"]
    flag = flag_of(challenge_container(api))

    wrong = api.post("/api/flags", json={"flag": "flag{0000000000000000}", "session_id": session_id})
    assert wrong.get_json()["valid"] is False

    right = api.post("/api/flags", json={"flag": flag, "session_id": session_id})
    assert right.get_json()["valid"] is True


def test_batch_flags(api):
    session_id = spawn(api).get_json()["session_id"]
    flag = flag_of(challenge_container(api))
    response = api.post("/api/flags/batch", json={"submissions": [
        {"flag": flag, "session_id": session_id},
        {"flag": "flag{0000000000000000}", "session_id": session_id},
    ]})
    body = response.get_json()
    assert [r["valid"] for r in body["results"]] == [True, False]
    assert body["valid_count"] == 1


def test_flag_for_unknown_session_is_404(api):
    response = api.post("/api/flags", json={"flag": "flag{0000000000000000}", "session_id": "nope"})
    assert response.status_code == 404


# ── Limits and lifecycle ──────────────────────────────────────────────────

def test_session_limit_is_checked_before_spawning(api):
    manager = api.session_manager
    for i in range(manager.max_sessions_per_user):
        manager.create_session("alice", f"other-{i}", {"container_id": f"x{i}"})

    runs_before = len(api.docker.containers.run_calls)
    response = spawn(api)
    assert response.status_code == 429
    assert len(api.docker.containers.run_calls) == runs_before  # nothing was started


def test_stop_removes_challenge_proxy_and_network(api):
    session_id = spawn(api).get_json()["session_id"]
    assert api.docker.containers.items and api.docker.networks.items

    response = api.delete(f"/api/challenges/{session_id}")
    assert response.status_code == 200
    assert api.docker.containers.items == {}
    assert api.docker.networks.items == {}
    assert api.session_manager.get_session_by_id(session_id) is None


def test_ending_a_session_stops_its_container(api):
    session_id = spawn(api).get_json()["session_id"]
    assert api.session_manager.cleanup_session(session_id)
    assert api.docker.containers.items == {}


def test_expired_sessions_stop_their_containers(api):
    session_id = spawn(api).get_json()["session_id"]
    api.session_manager._sessions[session_id].expires_at = 0
    assert api.session_manager.cleanup_expired_sessions() == 1
    assert api.docker.containers.items == {}


def test_reaper_removes_expired_orphans(api):
    spawn(api)
    container = challenge_container(api)
    container.labels["dvc.challenge.started"] = "0"  # expired long ago
    assert api.orchestrator.cleanup_expired() == 1
    assert api.docker.containers.items == {}


# ── Import hardening ──────────────────────────────────────────────────────

def challenge_json(**overrides):
    challenge = {
        "id": "imported-one", "name": "Imported", "description": "A test challenge",
        "difficulty": "easy", "category": "misc", "points": 10,
        "container_spec": {"image": "dvc/web-path-traversal:latest", "ports": {"5000": None}},
    }
    challenge.update(overrides)
    return challenge


def upload(api, data, filename, headers=CSRF):
    return api.post("/api/import/", headers=headers,
                    data={"challengeFile": (io.BytesIO(data), filename)},
                    content_type="multipart/form-data")


def test_import_requires_csrf_header(api):
    response = upload(api, json.dumps(challenge_json()).encode(), "c.json", headers={})
    assert response.status_code == 403


def test_import_ignores_user_build_context_and_forces_profile(api):
    payload = challenge_json(build_context="/app/engine")
    payload["container_spec"]["security_profile"] = "default"
    response = upload(api, json.dumps(payload).encode(), "c.json")
    assert response.get_json()["success"] is True

    stored = api.orchestrator.get_challenge("imported-one")
    assert "build_context" not in stored
    assert stored["container_spec"]["security_profile"] == "challenge"


def test_import_rejects_excessive_resources(api):
    payload = challenge_json()
    payload["container_spec"]["resource_limits"] = {"memory": "100g"}
    body = upload(api, json.dumps(payload).encode(), "c.json").get_json()
    assert body["success"] is False
    assert "above 1g" in body["data"]["validationResult"]["errors"][0]["message"]


def test_import_cannot_override_builtin_challenge(api):
    upload(api, json.dumps(challenge_json(id=CHALLENGE, name="Evil")).encode(), "c.json")
    assert api.orchestrator.get_challenge(CHALLENGE)["name"] != "Evil"


def make_zip(entries):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buffer.getvalue()


def test_import_rejects_zip_with_unsafe_paths(api):
    data = make_zip({"config.json": json.dumps(challenge_json()), "../escape.txt": "x"})
    body = upload(api, data, "c.zip").get_json()
    assert body["success"] is False
    assert "unsafe path" in body["error"]


def test_import_rejects_zip_bombs(api):
    data = make_zip({"config.json": json.dumps(challenge_json()), "zeros.bin": b"\0" * (101 * 1024 * 1024)})
    body = upload(api, data, "c.zip").get_json()
    assert body["success"] is False
    assert "too large" in body["error"]


def test_zip_import_builds_from_its_own_folder(api, tmp_path):
    data = make_zip({"config.json": json.dumps(challenge_json(id="zipped")), "Dockerfile": "FROM scratch\n"})
    assert upload(api, data, "c.zip").get_json()["success"] is True
    build_context = api.orchestrator.get_challenge("zipped")["build_context"]
    assert build_context == str(tmp_path / "imported" / "zipped")


def test_delete_never_removes_folders_outside_import_dir(api, tmp_path):
    victim = tmp_path / "victim"
    victim.mkdir()
    import_dir = tmp_path / "imported"
    import_dir.mkdir()
    (import_dir / "imported_challenges.json").write_text(json.dumps(
        {"challenges": [challenge_json(id="legacy", build_context=str(victim))]}))

    response = api.delete("/api/import/legacy")
    assert response.get_json()["success"] is True
    assert victim.exists()


def test_oversized_upload_is_413(api):
    response = upload(api, b" " * (21 * 1024 * 1024), "big.json")
    assert response.status_code == 413


# ── Startup ───────────────────────────────────────────────────────────────

def test_api_refuses_to_start_without_flag_key(api, monkeypatch):
    import app as app_module
    monkeypatch.delenv("FLAG_SECRET_KEY")
    with pytest.raises(RuntimeError, match="FLAG_SECRET_KEY"):
        app_module.create_app({"TESTING": True})
