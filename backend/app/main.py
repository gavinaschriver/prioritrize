from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import get_pool, close_pool
from app.routers import auth, prioritries, entries, days, todos, projects, categories, scratch_pad, dashboard, daily_notes, spending, tags, attachments


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="PRIORI-TRIZE", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(prioritries.router)
app.include_router(entries.router)
app.include_router(days.router)
app.include_router(todos.router)
app.include_router(projects.router)
app.include_router(categories.router)
app.include_router(scratch_pad.router)
app.include_router(dashboard.router)
app.include_router(daily_notes.router)
app.include_router(spending.router)
app.include_router(tags.router)
app.include_router(attachments.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
