from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

import db
from auth import router as auth_router
from boards import router as boards_router
from chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)
app.include_router(boards_router)
app.include_router(chat_router)


@app.get("/api/hello")
def hello():
    return {"message": "Hello from the API"}


app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True, check_dir=False))
