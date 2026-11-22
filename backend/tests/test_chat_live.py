"""Calls the real model through /api/chat. Skipped without OPENROUTER_API_KEY."""

import os

import pytest

pytestmark = pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")


def column_titles(board, index):
    return [board["cards"][i]["title"] for i in board["columns"][index]["cardIds"]]


def chat(authed, message, history=None):
    board_id = authed.get("/api/boards").json()[0]["id"]
    r = authed.post(f"/api/boards/{board_id}/chat", json={"message": message, "history": history or []})
    assert r.status_code == 200, r.text
    return r.json()


def board(authed):
    return authed.get(f"/api/boards/{authed.get('/api/boards').json()[0]['id']}").json()


def test_live_add_a_column_and_a_card_with_details(authed):
    result = chat(authed, "Add a column called 'Blocked' at the end, with a high priority card 'Fix login' due 2026-12-24.")
    assert result["board"]["columns"][-1]["title"] == "Blocked"
    [card_id] = result["board"]["columns"][-1]["cardIds"]
    card = result["board"]["cards"][card_id]
    assert (card["priority"], card["dueDate"]) == ("high", "2026-12-24")


def test_live_create_a_card(authed):
    result = chat(authed, "Add a card titled 'Buy milk' to the To Do column.")
    assert any("milk" in t.lower() for t in column_titles(result["board"], 1))
    assert board(authed) == result["board"]


def test_live_move_a_card(authed):
    result = chat(authed, "Move the card 'Set up CI pipeline' to the Backlog column.")
    assert "Set up CI pipeline" in column_titles(result["board"], 0)
    assert "Set up CI pipeline" not in column_titles(result["board"], 4)


def test_live_question_does_not_change_the_board(authed):
    before = board(authed)
    result = chat(authed, "How many cards are in the Done column? Do not change anything.")
    assert "2" in result["message"]
    assert board(authed) == before


def test_live_uses_the_conversation_history(authed):
    history = [
        {"role": "user", "content": "I need to track a task called 'Zeta review'."},
        {"role": "assistant", "content": "Okay. Which column should it go in?"},
    ]
    result = chat(authed, "Put it in the Done column.", history)
    assert any("zeta" in t.lower() for t in column_titles(result["board"], 4))
