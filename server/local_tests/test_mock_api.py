import json

import pytest

import main as api


@pytest.fixture(autouse=True)
def force_mock_firestore(monkeypatch):
    monkeypatch.setattr(api, "get_firestore_client", lambda: None)
    with api.MOCK_SESSIONS_LOCK:
        api.MOCK_SESSIONS.clear()
    yield
    with api.MOCK_SESSIONS_LOCK:
        api.MOCK_SESSIONS.clear()


@pytest.fixture
def client():
    api.app.testing = True
    return api.app.test_client()


def test_mock_session_full_flow(client):
    create_resp = client.post(
        "/session/create",
        json={"rotationFrequency": 5},
        headers={"Content-Type": "application/json"},
    )
    assert create_resp.status_code == 200
    create_data = json.loads(create_resp.data)
    session_id = create_data["sessionId"]
    assert create_data["gameState"]["rotationFrequency"] == 5
    assert create_data["gameState"]["status"] == "waiting"

    state_resp = client.get(f"/session/{session_id}")
    assert state_resp.status_code == 200
    state_data = json.loads(state_resp.data)
    assert state_data["sessionId"] == session_id
    assert state_data["status"] == "waiting"

    join_resp = client.post(
        "/session/join",
        json={"sessionId": session_id},
        headers={"Content-Type": "application/json"},
    )
    assert join_resp.status_code == 200
    join_data = json.loads(join_resp.data)
    assert join_data["playerId"] == 2
    assert join_data["gameState"]["status"] == "playing"

    move_resp = client.post(
        "/move",
        json={"sessionId": session_id, "playerId": 1, "column": 3},
        headers={"Content-Type": "application/json"},
    )
    assert move_resp.status_code == 200
    move_data = json.loads(move_resp.data)
    assert move_data["success"] is True
    assert move_data["moveNumber"] == 1

    moves_resp = client.get(f"/moves/{session_id}?since=0")
    assert moves_resp.status_code == 200
    moves_data = json.loads(moves_resp.data)
    assert moves_data["currentMoveCount"] == 1
    assert len(moves_data["moves"]) == 1
    assert moves_data["moves"][0]["column"] == 3

    incremental_resp = client.get(f"/moves/{session_id}?since=1")
    assert incremental_resp.status_code == 200
    incremental_data = json.loads(incremental_resp.data)
    assert incremental_data["currentMoveCount"] == 1
    assert incremental_data["moves"] == []


def test_mock_session_not_found_paths(client):
    missing_id = "does-not-exist"

    get_resp = client.get(f"/session/{missing_id}")
    assert get_resp.status_code == 404
    assert json.loads(get_resp.data)["error"] == "Session not found"

    join_resp = client.post(
        "/session/join",
        json={"sessionId": missing_id},
        headers={"Content-Type": "application/json"},
    )
    assert join_resp.status_code == 404
    assert json.loads(join_resp.data)["error"] == "Session not found"

    move_resp = client.post(
        "/move",
        json={"sessionId": missing_id, "playerId": 1, "column": 1},
        headers={"Content-Type": "application/json"},
    )
    assert move_resp.status_code == 404
    assert json.loads(move_resp.data)["error"] == "Session not found"

    moves_resp = client.get(f"/moves/{missing_id}")
    assert moves_resp.status_code == 404
    assert json.loads(moves_resp.data)["error"] == "Session not found"
