import copy
import json
from datetime import date

import openai
import pytest

import ai
import chat


@pytest.fixture
def model(monkeypatch):
    """Script the model's replies; `model.calls` records what the backend sent."""

    class Fake:
        def __init__(self):
            self.replies, self.calls = [], []

        def say(self, message="ok", board=None):
            self.replies.append(json.dumps({"message": message, "board": board}))

    fake = Fake()

    def ask(messages, schema=None):
        fake.calls.append({"messages": messages, "schema": schema})
        reply = fake.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(ai, "ask", ask)
    return fake


@pytest.fixture
def api_board(authed, board_id):
    """Read the demo board in the API shape (call it again for a fresh copy)."""
    return lambda: authed.get(f"/api/boards/{board_id}").json()


@pytest.fixture
def ai_board(api_board):
    """The board in the shape the AI uses."""
    return lambda: chat.to_ai_board(api_board())


@pytest.fixture
def send(authed, board_id):
    return lambda message="hi", history=None: authed.post(
        f"/api/boards/{board_id}/chat", json={"message": message, "history": history or []}
    )


def new_card(title, details="", **fields):
    return {"id": None, "title": title, "details": details, "dueDate": None, "priority": None, "labels": [], **fields}


def titles(board, column):
    return [board["cards"][i]["title"] for i in board["columns"][column]["cardIds"]]


def test_chat_requires_session(client):
    assert client.post("/api/boards/1/chat", json={"message": "hi"}).status_code == 401


def test_chat_on_another_users_board_is_404(alice, board_id, model):
    assert alice.post(f"/api/boards/{board_id}/chat", json={"message": "hi"}).status_code == 404
    assert model.calls == []


def test_plain_reply_leaves_the_board_alone(authed, model, api_board, ai_board, send, board_id):
    model.say("There are 2 cards in Backlog.")
    before = api_board()
    r = send("How many cards are in Backlog?")
    assert r.status_code == 200
    assert r.json() == {"message": "There are 2 cards in Backlog.", "board": None}
    assert api_board() == before


def test_create_a_card(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"][3]["cards"].append(new_card("Write docs", "Readme"))
    model.say("Added it.", board)
    r = send("Add a card Write docs to Review").json()
    assert r["message"] == "Added it."
    assert titles(r["board"], 3) == ["Accessibility audit", "Write docs"]
    new_id = r["board"]["columns"][3]["cardIds"][-1]
    assert r["board"]["cards"][new_id] == new_card("Write docs", "Readme") | {"id": new_id}
    assert len(new_id) == 36
    assert api_board() == r["board"]


def test_edit_a_card(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"][0]["cards"][0].update(title="Sharper vision", details="New details")
    model.say("Edited.", board)
    r = send().json()
    original_id = api_board()["columns"][0]["cardIds"][0]
    assert r["board"]["columns"][0]["cardIds"][0] == original_id
    assert r["board"]["cards"][original_id]["title"] == "Sharper vision"


def test_move_a_card(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    card = board["columns"][0]["cards"].pop(0)
    board["columns"][4]["cards"].append(card)
    model.say("Moved.", board)
    r = send().json()
    assert titles(r["board"], 0) == ["Competitor research"]
    assert titles(r["board"], 4) == ["Set up CI pipeline", "Launch landing page", "Define product vision"]
    assert r["board"]["columns"][4]["cardIds"][-1] == card["id"]


def test_delete_a_card(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"][0]["cards"].pop(0)
    model.say("Deleted.", board)
    r = send().json()
    assert len(r["board"]["cards"]) == 7


def test_rename_a_column(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"][1]["title"] = "Next up"
    model.say("Renamed.", board)
    assert send().json()["board"]["columns"][1]["title"] == "Next up"


def test_several_changes_in_one_message(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"][0]["title"] = "Ideas"
    moved = board["columns"][1]["cards"].pop(0)
    board["columns"][2]["cards"].insert(0, moved)
    board["columns"][4]["cards"].pop()
    board["columns"][1]["cards"].append(new_card("A"))
    board["columns"][1]["cards"].append(new_card("B"))
    model.say("Did several things.", board)
    result = send().json()["board"]
    assert result["columns"][0]["title"] == "Ideas"
    assert titles(result, 1) == ["Onboarding flow", "A", "B"]
    assert titles(result, 2) == ["Design system tokens", "Build settings page"]
    assert titles(result, 4) == ["Set up CI pipeline"]
    assert len(result["cards"]) == 9


def test_unchanged_board_is_not_returned(authed, model, api_board, ai_board, send, board_id):
    model.say("Nothing to change.", ai_board())
    r = send().json()
    assert r == {"message": "Nothing to change.", "board": None}


def test_invalid_card_title_is_rejected_and_the_board_unchanged(authed, model, api_board, ai_board, send, board_id):
    before = api_board()
    board = ai_board()
    board["columns"][0]["cards"].append(new_card("  "))
    model.say("Done!", board)
    r = send().json()
    assert r == {"message": chat.COULD_NOT_APPLY, "board": None}
    assert api_board() == before


def test_add_and_reorder_columns(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"].insert(0, {"id": None, "title": "Ideas", "cards": [new_card("Dark mode")]})
    board["columns"][-1], board["columns"][-2] = board["columns"][-2], board["columns"][-1]
    model.say("Added a column.", board)
    result = send().json()["board"]
    assert [c["title"] for c in result["columns"]] == ["Ideas", "Backlog", "To Do", "In Progress", "Done", "Review"]
    assert titles(result, 0) == ["Dark mode"]
    assert len(result["columns"][0]["id"]) == 36


def test_delete_a_column_and_its_cards(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"].pop(0)
    model.say("Removed Backlog.", board)
    result = send().json()["board"]
    assert [c["title"] for c in result["columns"]] == ["To Do", "In Progress", "Review", "Done"]
    assert len(result["cards"]) == 6


def test_unknown_column_ids_get_new_ids(authed, model, api_board, ai_board, send, board_id, alice):
    theirs = alice.get(f"/api/boards/{alice.board_id}").json()["columns"][0]["id"]
    board = ai_board()
    board["columns"].append({"id": theirs, "title": "Claimed", "cards": []})
    board["columns"].append({"id": "made-up", "title": "Invented", "cards": []})
    model.say("Added.", board)
    result = send().json()["board"]
    assert theirs not in {c["id"] for c in result["columns"]}
    assert "made-up" not in {c["id"] for c in result["columns"]}
    assert alice.get(f"/api/boards/{alice.board_id}").json()["columns"][0]["title"] == "Backlog"


@pytest.mark.parametrize("break_it", ["no_columns", "duplicate_column", "blank_column_title", "bad_date"])
def test_invalid_boards_from_the_model_are_rejected(authed, model, api_board, ai_board, send, board_id, break_it):
    before = api_board()
    board = ai_board()
    if break_it == "no_columns":
        board["columns"] = []
    elif break_it == "duplicate_column":
        board["columns"][1]["id"] = board["columns"][0]["id"]
    elif break_it == "blank_column_title":
        board["columns"][0]["title"] = " "
    else:
        board["columns"][0]["cards"][0]["dueDate"] = "next week"
    model.say("Done!", board)
    assert send().json() == {"message": chat.COULD_NOT_APPLY, "board": None}
    assert api_board() == before


def test_set_card_details(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"][0]["cards"][0].update(dueDate="2026-12-24", priority="high", labels=["launch", "launch"])
    board["columns"][1]["cards"].append(new_card("Book venue", priority="low", labels=["events"]))
    model.say("Updated.", board)
    result = send().json()["board"]
    first = result["cards"][result["columns"][0]["cardIds"][0]]
    assert (first["dueDate"], first["priority"], first["labels"]) == ("2026-12-24", "high", ["launch"])
    added = result["cards"][result["columns"][1]["cardIds"][-1]]
    assert (added["title"], added["priority"], added["labels"]) == ("Book venue", "low", ["events"])


def test_card_listed_twice_is_rejected(authed, model, api_board, ai_board, send, board_id):
    before = api_board()
    board = ai_board()
    board["columns"][1]["cards"].append(copy.deepcopy(board["columns"][0]["cards"][0]))
    model.say("Done!", board)
    assert send().json()["board"] is None
    assert api_board() == before


def test_unknown_card_ids_get_new_ids(authed, model, api_board, ai_board, send, board_id):
    board = ai_board()
    board["columns"][0]["cards"].append(new_card("Invented id") | {"id": "made-up"})
    model.say("Added.", board)
    result = send().json()["board"]
    assert "made-up" not in result["cards"]
    assert "Invented id" in titles(result, 0)


def test_another_users_card_id_cannot_be_claimed(authed, model, api_board, ai_board, send, board_id, alice):
    theirs = alice.get(f"/api/boards/{alice.board_id}").json()
    other_id = theirs["columns"][0]["cardIds"][0]
    board = ai_board()
    board["columns"][0]["cards"].append(new_card("Taken") | {"id": other_id})
    model.say("Added.", board)
    result = send().json()["board"]
    assert other_id not in result["cards"]
    assert alice.get(f"/api/boards/{alice.board_id}").json() == theirs


def test_the_model_receives_the_board_history_and_message(authed, model, api_board, ai_board, send, board_id):
    model.say("ok")
    history = [{"role": "user", "content": "first"}, {"role": "assistant", "content": "reply"}]
    send("second", history)
    call = model.calls[0]
    system, *rest = call["messages"]
    assert system["role"] == "system"
    assert "Define product vision" in system["content"]
    assert json.loads(system["content"].split("\n\n")[1]) == ai_board()
    assert rest == [*history, {"role": "user", "content": "second"}]
    assert call["schema"] is chat.AiReply
    assert f"Today is {date.today().isoformat()}." in system["content"]


def test_the_model_sees_the_latest_saved_board(authed, model, api_board, ai_board, send, board_id):
    board = api_board()
    board["columns"][0]["title"] = "Renamed by user"
    authed.put(f"/api/boards/{board_id}", json=board)
    model.say("ok")
    send()
    assert "Renamed by user" in model.calls[0]["messages"][0]["content"]


def test_history_is_optional(authed, model, api_board, ai_board, send, board_id):
    model.say("ok")
    assert authed.post(f"/api/boards/{board_id}/chat", json={"message": "hi"}).status_code == 200
    assert model.calls[0]["messages"][1:] == [{"role": "user", "content": "hi"}]


def test_rejects_bad_requests(authed, model, api_board, ai_board, send, board_id):
    assert authed.post(f"/api/boards/{board_id}/chat", json={}).status_code == 422
    bad_role = {"message": "hi", "history": [{"role": "system", "content": "x"}]}
    assert authed.post(f"/api/boards/{board_id}/chat", json=bad_role).status_code == 422
    assert model.calls == []


def test_model_failure_returns_502_and_changes_nothing(authed, model, api_board, ai_board, send, board_id):
    before = api_board()
    model.replies.append(openai.APIConnectionError(request=None))
    r = send()
    assert r.status_code == 502
    assert api_board() == before


@pytest.mark.parametrize("raw", ["not json", "{}", '{"message": "x", "board": {"columns": "no"}}', ""])
def test_malformed_model_output_returns_502(authed, model, api_board, ai_board, send, board_id, raw):
    model.replies.append(raw)
    assert send().status_code == 502


def test_board_edited_during_the_ai_call_is_not_overwritten(authed, model, api_board, ai_board, send, board_id, monkeypatch):
    board = ai_board()
    board["columns"][0]["cards"][0]["title"] = "Changed by the AI"
    model.say("Renamed it.", board)
    scripted = ai.ask

    def ask_while_user_edits(messages, schema=None):
        reply = scripted(messages, schema)
        edited = api_board()
        edited["columns"][4]["title"] = "Finished"
        assert authed.put(f"/api/boards/{board_id}", json=edited).status_code == 200
        return reply

    monkeypatch.setattr(ai, "ask", ask_while_user_edits)
    r = send("Rename the first card")
    assert r.json() == {"message": chat.BOARD_CHANGED, "board": None}
    saved = api_board()
    assert saved["columns"][4]["title"] == "Finished"
    assert titles(saved, 0)[0] != "Changed by the AI"
