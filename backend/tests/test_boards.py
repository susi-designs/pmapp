import copy

import pytest


def get(client, board_id):
    return client.get(f"/api/boards/{board_id}").json()


def put(client, board_id, board):
    return client.put(f"/api/boards/{board_id}", json=board)


def titles(board, column):
    return [board["cards"][i]["title"] for i in board["columns"][column]["cardIds"]]


def card(card_id, title="New", **fields):
    return {"id": card_id, "title": title, "details": "", "dueDate": None, "priority": None, "labels": [], **fields}


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/boards"),
        ("POST", "/api/boards"),
        ("GET", "/api/boards/1"),
        ("PUT", "/api/boards/1"),
        ("PATCH", "/api/boards/1"),
        ("DELETE", "/api/boards/1"),
    ],
)
def test_routes_require_a_session(client, method, path):
    assert client.request(method, path, json={}).status_code == 401


def test_the_demo_user_starts_with_one_seeded_board(authed, board_id):
    assert authed.get("/api/boards").json() == [{"id": board_id, "name": "My first board"}]
    board = get(authed, board_id)
    assert [c["title"] for c in board["columns"]] == ["Backlog", "To Do", "In Progress", "Review", "Done"]
    assert len(board["cards"]) == 8


def test_create_rename_and_delete_boards(authed, board_id):
    r = authed.post("/api/boards", json={"name": "  Launch  "})
    assert r.status_code == 201
    created = r.json()
    assert created["name"] == "Launch"
    board = get(authed, created["id"])
    assert len(board["columns"]) == 5 and board["cards"] == {}
    assert authed.patch(f"/api/boards/{created['id']}", json={"name": "Launch plan"}).json() == {
        "id": created["id"],
        "name": "Launch plan",
    }
    assert [b["name"] for b in authed.get("/api/boards").json()] == ["My first board", "Launch plan"]
    assert authed.delete(f"/api/boards/{board_id}").status_code == 200
    assert authed.get(f"/api/boards/{board_id}").status_code == 404
    assert authed.get("/api/boards").json() == [{"id": created["id"], "name": "Launch plan"}]


def test_the_last_board_can_be_deleted(authed, board_id):
    authed.delete(f"/api/boards/{board_id}")
    assert authed.get("/api/boards").json() == []


@pytest.mark.parametrize("name", ["", "   ", "x" * 61])
def test_board_names_are_validated(authed, board_id, name):
    assert authed.post("/api/boards", json={"name": name}).status_code == 422
    assert authed.patch(f"/api/boards/{board_id}", json={"name": name}).status_code == 422


def test_other_users_boards_are_hidden(authed, board_id, alice):
    assert board_id not in [b["id"] for b in alice.get("/api/boards").json()]
    board = get(authed, board_id)
    assert alice.get(f"/api/boards/{board_id}").status_code == 404
    assert put(alice, board_id, board).status_code == 404
    assert alice.patch(f"/api/boards/{board_id}", json={"name": "Mine"}).status_code == 404
    assert alice.delete(f"/api/boards/{board_id}").status_code == 404
    assert get(authed, board_id) == board
    assert authed.get("/api/boards").json()[0]["name"] == "My first board"


def test_missing_boards_are_404(authed):
    assert authed.get("/api/boards/999").status_code == 404
    assert authed.get("/api/boards/not-a-number").status_code == 422


def test_card_changes_round_trip(authed, board_id):
    board = get(authed, board_id)
    moved = board["columns"][0]["cardIds"].pop(0)
    board["columns"][2]["cardIds"].insert(0, moved)
    board["columns"][1]["title"] = "Next"
    deleted = board["columns"][4]["cardIds"].pop()
    del board["cards"][deleted]
    board["cards"]["new-card"] = card("new-card", "Ship it", details="Today")
    board["columns"][3]["cardIds"].append("new-card")
    r = put(authed, board_id, board)
    assert r.status_code == 200
    saved = get(authed, board_id)
    assert saved == board
    assert titles(saved, 2) == ["Define product vision", "Build settings page"]


def test_card_fields_round_trip(authed, board_id):
    board = get(authed, board_id)
    first = board["columns"][0]["cardIds"][0]
    board["cards"][first].update(dueDate="2026-12-01", priority="high", labels=[" design ", "design", "ux"])
    assert put(authed, board_id, board).status_code == 200
    assert get(authed, board_id)["cards"][first] | {"details": ""} == card(
        first, "Define product vision", dueDate="2026-12-01", priority="high", labels=["design", "ux"]
    )


def test_card_fields_default_when_left_out(authed, board_id):
    board = get(authed, board_id)
    board["cards"]["bare"] = {"id": "bare", "title": "Bare"}
    board["columns"][0]["cardIds"].append("bare")
    assert put(authed, board_id, board).status_code == 200
    assert get(authed, board_id)["cards"]["bare"] == card("bare", "Bare")


@pytest.mark.parametrize(
    "fields",
    [
        {"dueDate": "tomorrow"},
        {"dueDate": "2026-13-01"},
        {"priority": "urgent"},
        {"labels": [str(i) for i in range(9)]},
        {"labels": ["x" * 25]},
        {"labels": [" "]},
        {"title": " "},
    ],
)
def test_invalid_card_fields_are_rejected(authed, board_id, fields):
    board = get(authed, board_id)
    board["cards"][board["columns"][0]["cardIds"][0]].update(fields)
    assert put(authed, board_id, board).status_code == 422


def test_add_reorder_and_delete_columns(authed, board_id):
    board = get(authed, board_id)
    board["columns"].insert(1, {"id": "col-new", "title": "Ideas", "cardIds": []})
    board["columns"][-1], board["columns"][-2] = board["columns"][-2], board["columns"][-1]
    assert put(authed, board_id, board).status_code == 200
    saved = get(authed, board_id)
    assert [c["title"] for c in saved["columns"]] == ["Backlog", "Ideas", "To Do", "In Progress", "Done", "Review"]
    # Deleting a column deletes its cards.
    removed = saved["columns"].pop(0)
    for card_id in removed["cardIds"]:
        del saved["cards"][card_id]
    assert put(authed, board_id, saved).status_code == 200
    after = get(authed, board_id)
    assert [c["title"] for c in after["columns"]] == ["Ideas", "To Do", "In Progress", "Done", "Review"]
    assert len(after["cards"]) == 6


@pytest.mark.parametrize("break_it", ["no_columns", "duplicate_column", "blank_column_title", "blank_column_id"])
def test_invalid_columns_are_rejected(authed, board_id, break_it):
    board = get(authed, board_id)
    if break_it == "no_columns":
        board = {"columns": [], "cards": {}}
    elif break_it == "duplicate_column":
        board["columns"][1]["id"] = board["columns"][0]["id"]
    elif break_it == "blank_column_title":
        board["columns"][0]["title"] = " "
    else:
        board["columns"][0]["id"] = ""
    assert put(authed, board_id, board).status_code == 422


@pytest.mark.parametrize("break_it", ["listed_twice", "not_listed", "unknown_listed", "key_mismatch"])
def test_inconsistent_boards_are_rejected(authed, board_id, break_it):
    board = get(authed, board_id)
    first = board["columns"][0]["cardIds"][0]
    if break_it == "listed_twice":
        board["columns"][1]["cardIds"].append(first)
    elif break_it == "not_listed":
        board["columns"][0]["cardIds"].remove(first)
    elif break_it == "unknown_listed":
        board["columns"][0]["cardIds"].append("ghost")
    else:
        board["cards"]["other-key"] = board["cards"].pop(first)
    assert put(authed, board_id, board).status_code == 422
    assert len(get(authed, board_id)["cards"]) == 8


def test_ids_from_another_board_cannot_be_taken(authed, board_id, alice):
    theirs = get(alice, alice.board_id)
    their_card = theirs["columns"][0]["cardIds"][0]
    before = get(authed, board_id)

    board = copy.deepcopy(before)
    board["cards"][their_card] = card(their_card, "Stolen")
    board["columns"][0]["cardIds"].append(their_card)
    r = put(authed, board_id, board)
    assert r.status_code == 409

    board = copy.deepcopy(before)
    board["columns"].append({"id": theirs["columns"][0]["id"], "title": "Stolen", "cardIds": []})
    assert put(authed, board_id, board).status_code == 409

    assert get(authed, board_id) == before
    assert get(alice, alice.board_id) == theirs


def test_boards_of_one_user_keep_their_own_ids(authed, board_id):
    second = authed.post("/api/boards", json={"name": "Second"}).json()["id"]
    board = get(authed, second)
    board["columns"].append({"id": get(authed, board_id)["columns"][0]["id"], "title": "Moved", "cardIds": []})
    assert put(authed, second, board).status_code == 409
