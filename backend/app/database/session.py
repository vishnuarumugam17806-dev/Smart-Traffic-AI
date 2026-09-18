import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

def get_engine():
    db_url = settings.get_db_url()
    try:
        if db_url.startswith("postgresql"):
            engine = create_engine(db_url, pool_pre_ping=True, pool_recycle=300, pool_size=10, max_overflow=20)
            # Test connection
            with engine.connect() as conn:
                pass
            logger.info("Connected to PostgreSQL database successfully.")
            return engine
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to SQLite database.")
    
    # Fallback to local SQLite
    sqlite_url = settings.SQLITE_URL
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    logger.info(f"Using SQLite database engine at {sqlite_url}")
    return engine

from sqlalchemy import text

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Auto-create tables & migration helper for new SQLite columns
Base.metadata.create_all(bind=engine)
try:
    with engine.connect() as conn:
        for col_stmt in [
            "ALTER TABLE intersections ADD COLUMN num_approaches INTEGER DEFAULT 4;",
            "ALTER TABLE intersections ADD COLUMN approaches_config JSON;",
            "ALTER TABLE blacklist ADD COLUMN directory_type VARCHAR(50) DEFAULT 'SECURITY_WATCHLIST';",
            "ALTER TABLE blacklist ADD COLUMN severity VARCHAR(50) DEFAULT 'CRITICAL';",
            "ALTER TABLE blacklist ADD COLUMN vehicle_model VARCHAR(100);",
            "ALTER TABLE blacklist ADD COLUMN owner_name VARCHAR(100);",
            "ALTER TABLE blacklist ADD COLUMN fir_number VARCHAR(100);",
            "ALTER TABLE blacklist ADD COLUMN police_station VARCHAR(100);",
            "ALTER TABLE blacklist ADD COLUMN auto_alert BOOLEAN DEFAULT 1;",
            "ALTER TABLE blacklist ADD COLUMN scan_count INTEGER DEFAULT 0;",
            "ALTER TABLE blacklist ADD COLUMN last_scanned_at DATETIME;",
            "ALTER TABLE plate_observations ADD COLUMN location VARCHAR(255);",
            "ALTER TABLE mobile_devices ADD COLUMN device_name VARCHAR(100);",
            "ALTER TABLE mobile_devices ADD COLUMN registered_by VARCHAR(100);",
            "ALTER TABLE mobile_devices ADD COLUMN browser VARCHAR(100);",
            "ALTER TABLE mobile_devices ADD COLUMN camera_capabilities TEXT;",
            "ALTER TABLE mobile_devices ADD COLUMN permission_camera VARCHAR(50) DEFAULT 'GRANTED';",
            "ALTER TABLE mobile_devices ADD COLUMN permission_location VARCHAR(50) DEFAULT 'WAITING';",
            "ALTER TABLE mobile_devices ADD COLUMN latitude FLOAT;",
            "ALTER TABLE mobile_devices ADD COLUMN longitude FLOAT;",
            "ALTER TABLE mobile_devices ADD COLUMN accuracy_meters FLOAT;",
            "ALTER TABLE mobile_devices ADD COLUMN last_location_status VARCHAR(50) DEFAULT 'UNAVAILABLE';",
            "ALTER TABLE mobile_devices ADD COLUMN last_location_timestamp DATETIME;",
            "ALTER TABLE mobile_devices ADD COLUMN source_mode VARCHAR(20) DEFAULT 'LIVE';",
            "ALTER TABLE mobile_devices ADD COLUMN revoked_at DATETIME;",
        ]:
            try:
                conn.execute(text(col_stmt))
                conn.commit()
            except Exception:
                pass
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
