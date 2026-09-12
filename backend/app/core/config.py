import os
from typing import List, Optional
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict

_env_backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
_env_root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

if os.path.exists(_env_backend_path):
    load_dotenv(_env_backend_path)
if os.path.exists(_env_root_path):
    load_dotenv(_env_root_path)

class Settings(BaseSettings):
    PROJECT_NAME: str = "VIGITRA"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "vigitra_super_secret_jwt_key_2026_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Domain & Base URLs
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    BACKEND_BASE_URL: str = "http://localhost:8000"
    WEBSOCKET_BASE_URL: str = "ws://localhost:8000/ws"
    
    # WebRTC STUN/TURN Server Configuration
    TURN_SERVER_URL: str = "stun:stun.l.google.com:19302"
    TURN_USERNAME: Optional[str] = None
    TURN_CREDENTIAL: Optional[str] = None

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "vigitra_db"
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: Optional[str] = None

    # MongoDB Atlas
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "vigitra_db"


    # Fallback to local SQLite if Postgres is unavailable
    USE_SQLITE_FALLBACK: bool = True
    SQLITE_URL: str = os.getenv(
        "SQLITE_URL",
        f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'vigitra.db'))}"
        if not os.path.exists(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'vigitra.db')))
        else f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'vigitra.db'))}"
    )

    # Redis & RabbitMQ
    REDIS_URL: str = "redis://localhost:6379/0"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://vigitra-frontend.onrender.com",
        "*"
    ]

    # Signal Safety Boundaries
    MIN_GREEN_TIME: int = 15
    MAX_GREEN_TIME: int = 120
    YELLOW_TIME: int = 3
    ALL_RED_TIME: int = 2
    PEDESTRIAN_CLEARANCE_TIME: int = 10

    # Vision & Processing
    DETECTION_FPS: int = 10
    CONFIDENCE_THRESHOLD: float = 0.45

    # GIS Map Provider Configuration
    MAP_PROVIDER: str = "CartoDB"
    MAP_API_KEY: Optional[str] = None
    GEOCODING_API_KEY: Optional[str] = None
    ROUTING_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=(_env_backend_path, _env_root_path, ".env"),
        extra="ignore"
    )

    def get_db_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()

