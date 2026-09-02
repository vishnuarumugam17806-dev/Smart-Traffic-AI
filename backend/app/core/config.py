import os
from typing import List, Optional
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "VIGITRA"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "vigitra_super_secret_jwt_key_2026_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Domain & Base URLs
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    BACKEND_BASE_URL: str = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
    WEBSOCKET_BASE_URL: str = os.getenv("WEBSOCKET_BASE_URL", "ws://localhost:8000/ws")
    
    # WebRTC STUN/TURN Server Configuration
    TURN_SERVER_URL: str = os.getenv("TURN_SERVER_URL", "stun:stun.l.google.com:19302")
    TURN_USERNAME: Optional[str] = os.getenv("TURN_USERNAME", None)
    TURN_CREDENTIAL: Optional[str] = os.getenv("TURN_CREDENTIAL", None)

    # Database
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "vigitra_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    DATABASE_URL: Optional[str] = None

    # MongoDB Atlas
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb+srv://vigitra_admin:<db_password>@vigitra.0faq4de.mongodb.net/vigitra_db?retryWrites=true&w=majority&appName=VIGITRA")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "vigitra_db")

    # Fallback to local SQLite if Postgres is unavailable
    USE_SQLITE_FALLBACK: bool = True
    SQLITE_URL: str = f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'vigitra.db'))}"

    # Redis & RabbitMQ
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
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
    MAP_PROVIDER: str = os.getenv("MAP_PROVIDER", "CartoDB")
    MAP_API_KEY: Optional[str] = os.getenv("MAP_API_KEY", None)
    GEOCODING_API_KEY: Optional[str] = os.getenv("GEOCODING_API_KEY", None)
    ROUTING_API_KEY: Optional[str] = os.getenv("ROUTING_API_KEY", None)

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

    def get_db_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
