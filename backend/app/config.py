from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    database_url: str = ""
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Google Calendar integration
    google_client_id: str = ""
    google_client_secret: str = ""
    # Must byte-match the URI registered in the Google Cloud console and be
    # sent identically on both the authorization request and the token
    # exchange. Never reconstruct it from request.url.
    google_redirect_uri: str = "http://localhost:8000/api/integrations/google/callback"
    # Where the OAuth callback sends the browser back to.
    frontend_url: str = "http://localhost:5173"
    # Fernet key. Rotating or losing it invalidates every stored refresh token.
    token_encryption_key: str = ""
    # Shared secret for the nightly reconcile endpoint.
    cron_secret: str = ""

    model_config = {"env_file": ".env"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.token_encryption_key)


settings = Settings()
