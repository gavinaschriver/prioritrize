from fastapi import APIRouter, Depends
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.scratch_pad import ScratchPadOut, ScratchPadUpdate
from app.services import scratch_pad_service

router = APIRouter(prefix="/api/scratch-pad", tags=["scratch-pad"])


@router.get("", response_model=ScratchPadOut)
async def get_scratch_pad(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await scratch_pad_service.get_scratch_pad(conn, user["id"])


@router.put("", response_model=ScratchPadOut)
async def update_scratch_pad(
    data: ScratchPadUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await scratch_pad_service.update_scratch_pad(conn, user["id"], data)
