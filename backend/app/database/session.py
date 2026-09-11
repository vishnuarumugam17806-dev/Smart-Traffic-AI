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
            engine = create_engine(db_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
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
        try:
            conn.execute(text("ALTER TABLE intersections ADD COLUMN num_approaches INTEGER DEFAULT 4;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE intersections ADD COLUMN approaches_config JSON;"))
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
