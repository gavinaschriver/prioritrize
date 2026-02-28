import json
import base64
import urllib.request
from fastapi import HTTPException, Request
from app.config import settings
import jwt as pyjwt
from jwt import PyJWKClient

# Cache the JWKS client (fetches public keys from Supabase)
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = auth_header.split(" ", 1)[1]

    # Peek at the token header to determine algorithm
    try:
        header = json.loads(base64.urlsafe_b64decode(token.split(".")[0] + "=="))
        alg = header.get("alg", "")
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed token")

    try:
        if alg == "ES256":
            # New ECC key: verify with JWKS public key
            client = get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        else:
            # Legacy HS256: verify with shared secret
            payload = pyjwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        return {"id": payload["sub"], "email": payload.get("email")}
    except pyjwt.exceptions.PyJWTError as e:
        print(f"[AUTH DEBUG] alg={alg}, error={e}")
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")
