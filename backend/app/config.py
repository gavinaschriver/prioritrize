from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    database_url: str = ""
    # Supabase's session-mode pooler (port 5432) caps the whole project at 15
    # clients, and a laptop plus a deployed instance both draw from it. Ten each
    # overruns that ceiling and the loser gets EMAXCONNSESSION on connect, so the
    # default leaves room for both plus a psql session. Raise it only on the
    # transaction-mode pooler (port 6543), which has no such cap.
    db_pool_min_size: int = 1
    db_pool_max_size: int = 5
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = {"env_file": ".env"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
