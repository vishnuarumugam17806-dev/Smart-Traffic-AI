import logging
from typing import Dict, Any, Optional
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

class MongoDBManager:
    """
    MongoDB Atlas Dual Engine Manager.
    Supports synchronous PyMongo operations and asynchronous Motor client for FastAPI endpoints.
    Manages MongoDB Atlas collections:
    - anpr_observations (Raw high-velocity ANPR detections)
    - vehicle_trajectories (Cross-camera journey correlation graphs)
    - ai_agent_logs (Coordinator and Optimization decision logs)
    - system_telemetry (Camera feed metrics and stream health)
    """

    def __init__(self):
        self.sync_client: Optional[MongoClient] = None
        self.async_client: Optional[AsyncIOMotorClient] = None
        self.db_name = settings.MONGODB_DB_NAME
        self.is_connected = False
        self.connection_error: Optional[str] = None
        self._init_connections()

    def _init_connections(self):
        uri = settings.MONGODB_URI
        if not uri or "<db_password>" in uri:
            self.connection_error = "MongoDB Atlas URI contains unpopulated '<db_password>' placeholder. Update backend/.env file."
            logger.info(f"[MongoDBManager] {self.connection_error}")
            return

        try:
            # Initialize Synchronous PyMongo Client
            self.sync_client = MongoClient(
                uri,
                server_api=ServerApi('1'),
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000
            )
            # Test Connection Ping
            self.sync_client.admin.command('ping')
            
            # Initialize Async Motor Client
            self.async_client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
            
            self.is_connected = True
            self.connection_error = None
            logger.info(f"[MongoDBManager] Successfully connected to MongoDB Atlas Cluster database '{self.db_name}'.")
        except Exception as e:
            self.is_connected = False
            self.connection_error = str(e)
            logger.warning(f"[MongoDBManager] Could not connect to MongoDB Atlas Cluster: {e}")

    def get_sync_db(self):
        """Returns synchronous PyMongo Database instance."""
        if self.sync_client and self.is_connected:
            return self.sync_client[self.db_name]
        return None

    def get_async_db(self):
        """Returns asynchronous Motor Database instance for async FastAPI endpoints."""
        if self.async_client and self.is_connected:
            return self.async_client[self.db_name]
        return None

    def ping(self) -> Dict[str, Any]:
        """Performs connection health check and returns status metadata."""
        if not self.is_connected:
            # Re-attempt connection in case credentials/env were updated
            self._init_connections()

        if self.is_connected and self.sync_client:
            try:
                ping_res = self.sync_client.admin.command('ping')
                collections = self.sync_client[self.db_name].list_collection_names()
                return {
                    "status": "ONLINE",
                    "connected": True,
                    "database": self.db_name,
                    "collections": collections,
                    "ping": ping_res,
                    "error": None
                }
            except Exception as e:
                self.is_connected = False
                self.connection_error = str(e)

        return {
            "status": "OFFLINE_CONFIG_NEEDED",
            "connected": False,
            "database": self.db_name,
            "uri_template": settings.MONGODB_URI,
            "error": self.connection_error or "Not connected to MongoDB Atlas Cluster."
        }

mongo_manager = MongoDBManager()
