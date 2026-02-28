from fastapi import APIRouter, Depends, Request
from app.auth import get_current_user
import json, base64

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.get("/debug-token")
async def debug_token(request: Request):
    """Temporary debug endpoint - remove before production."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"error": "no bearer token"}
    token = auth_header.split(" ", 1)[1]
    try:
        header = json.loads(base64.urlsafe_b64decode(token.split(".")[0] + "=="))
        return {"token_header": header, "token_first_50": token[:50]}
    except Exception as e:
        return {"error": str(e)}
