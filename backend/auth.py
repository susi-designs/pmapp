import sqlite3
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, StringConstraints

import db

router = APIRouter(prefix="/api")

Username = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9._-]{3,32}$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class Credentials(BaseModel):
    username: str
    password: str


class NewAccount(BaseModel):
    username: Username
    password: Password


class PasswordChange(BaseModel):
    current: str
    new: Password


class PasswordCheck(BaseModel):
    password: str


def current_user(session: str | None = Cookie(None)) -> dict:
    """The signed-in user as {id, username}; 401 without a valid session."""
    user = db.session_user(session) if session else None
    if not user:
        raise HTTPException(status_code=401, detail="Not signed in")
    return user


def _start_session(response: Response, user_id: int):
    token = db.create_session(user_id)
    response.set_cookie("session", token, httponly=True, samesite="lax", max_age=db.SESSION_DAYS * 86400)


def _require_password(user: dict, password: str):
    if not db.check_password(password, db.get_user(user["username"])["password_hash"]):
        raise HTTPException(status_code=403, detail="Wrong password")


@router.post("/register", status_code=201)
def register(account: NewAccount, response: Response):
    try:
        user_id = db.create_user(account.username, account.password)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="That username is taken")
    _start_session(response, user_id)
    return {"username": account.username}


@router.post("/login")
def login(creds: Credentials, response: Response):
    user = db.get_user(creds.username)
    if not user or not db.check_password(creds.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    _start_session(response, user["id"])
    return {"username": user["username"]}


@router.post("/logout")
def logout(response: Response, session: str | None = Cookie(None)):
    if session:
        db.delete_session(session)
    response.delete_cookie("session")
    return {}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return {"username": user["username"]}


@router.put("/me/password")
def change_password(change: PasswordChange, session: str = Cookie(), user: dict = Depends(current_user)):
    _require_password(user, change.current)
    db.set_password(user["id"], change.new)
    db.delete_other_sessions(user["id"], session)
    return {}


@router.delete("/me")
def delete_account(check: PasswordCheck, response: Response, user: dict = Depends(current_user)):
    _require_password(user, check.password)
    db.delete_user(user["id"])
    response.delete_cookie("session")
    return {}
