from fastapi import APIRouter, Depends, HTTPException
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.item_ref import ItemRefOut
from app.services import ref_service

router = APIRouter(prefix="/api/item-refs", tags=["item-refs"])


@router.get("/{number}", response_model=ItemRefOut)
async def resolve_ref(
    number: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Resolve a #NNNN reference to the todo or task it names."""
    found = await ref_service.resolve(conn, user["id"], number)
    if not found:
        raise HTTPException(404, f"Nothing is numbered {number}")
    return ItemRefOut(ref_number=number, **found)
