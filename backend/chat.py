import json
import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAIError
from pydantic import BaseModel

import ai
import db
from auth import current_user
import boards
from boards import Board

router = APIRouter(prefix="/api")

SYSTEM_PROMPT = """You are the assistant in a Kanban project management app. Today is {today}. \
The user's current board is below as JSON.

{board}

Answer the user's message. If they ask you to change the board (create, edit, move or delete cards; add, rename, \
reorder or delete columns), return the complete updated board in "board"; otherwise set "board" to null.
Rules for the board:
- Columns are listed left to right and cards top to bottom within each column. Moving a card means removing it from \
one column's list and adding it to another's.
- Keep the id of every existing column and card. Use null for the id of a new column or card. Leaving out a column \
deletes it and its cards, so only do that when asked.
- Every column and card needs a non-empty title. There must be at least one column.
- Cards have "dueDate" (YYYY-MM-DD or null), "priority" ("low", "medium", "high" or null) and "labels" (up to 8 \
short strings). Keep these unchanged unless asked.
"message" is your reply to the user: say briefly what you did or answer their question."""

COULD_NOT_APPLY = "Sorry, I could not apply that change to the board. Please try again."
BOARD_CHANGED = "The board changed while I was working, so I did not apply my change. Please ask again."


class AiCard(BaseModel):
    id: str | None
    title: str
    details: str
    dueDate: str | None
    priority: Literal["low", "medium", "high"] | None
    labels: list[str]


class AiColumn(BaseModel):
    id: str | None
    title: str
    cards: list[AiCard]


class AiBoard(BaseModel):
    columns: list[AiColumn]


class AiReply(BaseModel):
    message: str
    board: AiBoard | None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


def to_ai_board(board: dict) -> dict:
    """The AI works with cards nested inside columns; the API uses a card lookup plus card id lists."""
    return {
        "columns": [
            {"id": c["id"], "title": c["title"], "cards": [board["cards"][i] for i in c["cardIds"]]}
            for c in board["columns"]
        ]
    }


def from_ai_board(ai_board: AiBoard, current: dict) -> Board:
    """Unknown or missing column and card ids get a new uuid, so the AI can never claim another board's ids.

    Raises ValueError (pydantic's ValidationError) if the result is not a valid board."""
    column_ids = {c["id"] for c in current["columns"]}
    cards, columns = {}, []
    for column in ai_board.columns:
        card_ids = []
        for card in column.cards:
            card_id = card.id if card.id in current["cards"] else str(uuid.uuid4())
            cards[card_id] = {**card.model_dump(), "id": card_id}
            card_ids.append(card_id)
        column_id = column.id if column.id in column_ids else str(uuid.uuid4())
        columns.append({"id": column_id, "title": column.title, "cardIds": card_ids})
    return Board(cards=cards, columns=columns)


@router.post("/boards/{board_id}/chat")
def chat(board_id: int, request: ChatRequest, user: dict = Depends(current_user)):
    before = db.get_board(user["id"], board_id)
    if before is None:
        raise boards.not_found()
    prompt = SYSTEM_PROMPT.format(today=date.today().isoformat(), board=json.dumps(to_ai_board(before)))
    messages = [
        {"role": "system", "content": prompt},
        *[m.model_dump() for m in request.history],
        {"role": "user", "content": request.message},
    ]
    try:
        reply = AiReply.model_validate_json(ai.ask(messages, AiReply))
    except (OpenAIError, ValueError):
        raise HTTPException(status_code=502, detail="The AI request failed")
    if reply.board is None:
        return {"message": reply.message, "board": None}
    if db.get_board(user["id"], board_id) != before:
        # The user edited the board while the AI was working; saving would overwrite that edit.
        return {"message": BOARD_CHANGED, "board": None}
    try:
        board = from_ai_board(reply.board, before)
    except ValueError:
        return {"message": COULD_NOT_APPLY, "board": None}
    boards.save(user["id"], board_id, board)
    after = db.get_board(user["id"], board_id)
    return {"message": reply.message, "board": after if after != before else None}
