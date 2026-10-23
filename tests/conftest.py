"""
Shared test fixtures.

The API normally talks to the real Docker daemon. Tests inject FakeDocker,
an in-memory stand-in that records what the orchestrator asks Docker to do
(containers, networks, published ports, labels) so behaviour can be checked
without Docker installed.
"""

import itertools
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

ROOT = Path(__file__).resolve().parents[1]

# api/ first so `import challenges` finds api/challenges.py, not the challenges/ folder
sys.path[:0] = [str(ROOT / "api"), str(ROOT)]

# The API refuses to start without a real key
os.environ.setdefault("FLAG_SECRET_KEY", "test-key-" + "0" * 40)


class FakeContainer:
    _ids = itertools.count(1)
    _ports = itertools.count(40000)

    def __init__(self, client, name, labels=None, ports=None, **kwargs):
        self.client = client
        self.id = f"cid{next(self._ids):04d}"
        self.name = name
        self.labels = labels or {}
        self.kwargs = kwargs
        self.status = "running"
        self.removed = False
        published = {}
        for container_port, binding in (ports or {}).items():
            host_ip = binding[0] if isinstance(binding, tuple) else "0.0.0.0"
            published[container_port] = [{"HostIp": host_ip, "HostPort": str(next(self._ports))}]
        self.attrs = {"Config": {"Labels": self.labels}, "NetworkSettings": {"Ports": published}}

    def stop(self, timeout=None):
        self.status = "exited"

    def kill(self):
        self.status = "exited"

    def remove(self, force=False):
        self.removed = True
        self.client.containers.items.pop(self.id, None)

    def reload(self):
        pass


class FakeContainers:
    def __init__(self, client):
        self.client = client
        self.items = {}
        self.run_calls = []

    def run(self, image, name=None, labels=None, ports=None, **kwargs):
        self.run_calls.append(dict(image=image, name=name, labels=labels, ports=ports, **kwargs))
        container = FakeContainer(self.client, name, labels, ports, image=image, **kwargs)
        self.items[container.id] = container
        return container

    def get(self, id_or_name):
        for container in self.items.values():
            if id_or_name in (container.id, container.name):
                return container
        import docker
        raise docker.errors.NotFound(f"No such container: {id_or_name}")

    def list(self, filters=None, all=False):
        result = list(self.items.values())
        if not all:
            result = [c for c in result if c.status == "running"]
        label = (filters or {}).get("label")
        for wanted in ([label] if isinstance(label, str) else label or []):
            key, _, value = wanted.partition("=")
            result = [c for c in result if key in c.labels and (not value or c.labels[key] == value)]
        return result


class FakeNetwork:
    def __init__(self, client, name, **kwargs):
        self.client = client
        self.name = name
        self.kwargs = kwargs
        self.labels = kwargs.get("labels") or {}
        self.connected = []

    def connect(self, container):
        self.connected.append(container.name)

    def remove(self):
        self.client.networks.items.pop(self.name, None)


class FakeNetworks:
    def __init__(self, client):
        self.client = client
        self.items = {}

    def create(self, name, **kwargs):
        network = FakeNetwork(self.client, name, **kwargs)
        self.items[name] = network
        return network

    def get(self, name):
        return self.items[name]

    def list(self, names=None, filters=None):
        result = list(self.items.values())
        if names:
            result = [n for n in result if n.name in names]
        label = (filters or {}).get("label")
        if label:
            key, _, value = label.partition("=")
            result = [n for n in result if n.labels.get(key) == value]
        return result


class FakeDocker:
    def __init__(self):
        self.containers = FakeContainers(self)
        self.networks = FakeNetworks(self)
        self.images = MagicMock()  # every image "exists"

    def ping(self):
        return True


@pytest.fixture
def fake_docker():
    return FakeDocker()


@pytest.fixture
def api(fake_docker, tmp_path, monkeypatch):
    """A test client for a fresh API wired to FakeDocker"""
    monkeypatch.chdir(ROOT)
    monkeypatch.setenv("IMPORTED_CHALLENGES_DIR", str(tmp_path / "imported"))

    import challenges
    import import_handler
    from engine import session_manager as sm
    from engine.orchestrator import ChallengeOrchestrator

    monkeypatch.setattr(import_handler, "IMPORT_DIR", str(tmp_path / "imported"))
    monkeypatch.setattr(sm, "_session_manager_instance", None)

    orchestrator = ChallengeOrchestrator(
        challenges_path=str(ROOT / "challenges/definitions/challenges.json"),
        security_profiles_path=str(ROOT / "security/container-profiles.json"),
        docker_client=fake_docker,
    )
    orchestrator.health_monitor = MagicMock()
    monkeypatch.setattr(challenges, "_orchestrator_instance", orchestrator)

    import app as app_module
    flask_app = app_module.create_app({"TESTING": True})
    client = flask_app.test_client()
    client.orchestrator = orchestrator
    client.docker = fake_docker
    client.session_manager = sm.get_session_manager()
    yield client
    client.session_manager.shutdown()
