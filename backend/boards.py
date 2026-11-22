import sqlite3
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

import db
from auth import current_user

router = APIRouter(prefix="/api")

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]


class Card(BaseModel):
    id: str
    title: Title
    details: str = ""
    dueDate: date | None = None
    priority: Literal["low", "medium", "high"] | None = None
    labels: list[Label] = Field(default=[], max_length=8)

    @field_validator("labels")
    @classmethod
    def unique_labels(cls, labels):
        return list(dict.fromkeys(labels))


class Column(BaseModel):
    id: Title
    title: Title
    cardIds: list[str]


class Board(BaseModel):
    cards: dict[str, Card]
    columns: list[Column] = Field(min_length=1)

    @model_validator(mode="after")
    def consistent(self):
        if any(key != card.id for key, card in self.cards.items()):
            raise ValueError("Card keys must match card ids")
        if len({c.id for c in self.columns}) != len(self.columns):
            raise ValueError("Column ids must be unique")
        listed = [card_id for column in self.columns for card_id in column.cardIds]
        if sorted(listed) != sorted(self.cards):
            raise ValueError("Columns must list every card exactly once")
        return self


class BoardName(BaseModel):
    name: Name


def not_found():
    return HTTPException(status_code=404, detail="Board not found")


@router.get("/boards")
def list_boards(user: dict = Depends(current_user)):
    return db.list_boards(user["id"])


@router.post("/boards", status_code=201)
def create_board(body: BoardName, user: dict = Depends(current_user)):
    return db.create_board(user["id"], body.name)


@router.patch("/boards/{board_id}")
def rename_board(board_id: int, body: BoardName, user: dict = Depends(current_user)):
    if not db.rename_board(user["id"], board_id, body.name):
        raise not_found()
    return {"id": board_id, "name": body.name}


@router.delete("/boards/{board_id}")
def delete_board(board_id: int, user: dict = Depends(current_user)):
    if not db.delete_board(user["id"], board_id):
        raise not_found()
    return {}


@router.get("/boards/{board_id}", response_model=Board)
def read_board(board_id: int, user: dict = Depends(current_user)):
    board = db.get_board(user["id"], board_id)
    if board is None:
        raise not_found()
    return board


def save(user_id: int, board_id: int, board: Board):
    """Save a validated board; 404 if it is not the user's, 409 if it uses another board's column or card id."""
    try:
        if not db.save_board(user_id, board_id, board.model_dump(mode="json")):
            raise not_found()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Column or card id already in use")


@router.put("/boards/{board_id}", response_model=Board)
def write_board(board_id: int, board: Board, user: dict = Depends(current_user)):
    save(user["id"], board_id, board)
    return board
