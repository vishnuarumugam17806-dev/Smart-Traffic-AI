"""
WebSocket Connection Manager for live updates.
Provides thread-safe registration, connection tracking, broadcast with isolated client error handling,
and graceful socket cleanup upon disconnects.
"""

import logging
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket client connections and safe broadcast message delivery."""

    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accepts and records a new WebSocket client connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            "WebSocket client connected. Total connections: %d",
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Removes a disconnected WebSocket client from the active registry."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(
                "WebSocket client disconnected. Remaining connections: %d",
                len(self.active_connections),
            )

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket) -> None:
        """Sends a JSON message to a single specific client."""
        try:
            await websocket.send_json(message)
        except Exception as exc:
            logger.warning("Error sending personal message to WebSocket client: %s", exc)
            self.disconnect(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """
        Broadcasts a JSON message to all active WebSocket clients.
        Isolates failures so a broken client cannot interrupt broadcast to other healthy clients.
        """
        # Iterate over a snapshot list copy to prevent runtime modification issues
        connections_snapshot = list(self.active_connections)
        disconnected: List[WebSocket] = []

        for connection in connections_snapshot:
            try:
                await connection.send_json(message)
            except Exception as exc:
                logger.warning("Error broadcasting to WebSocket client: %s", exc)
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)
            try:
                await conn.close()
            except Exception:
                pass


ws_manager = ConnectionManager()
