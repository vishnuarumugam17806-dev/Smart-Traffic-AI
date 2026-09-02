# System Deployment & Scaling Specification

This document details the production deployment, orchestration, and scaling parameters.

---

## 1. Production Docker Orchestration

The platform is fully containerized and orchestrated via `docker-compose.yml`:
- **`vigitra_postgres`**: Persistent PostgreSQL 15 database storing system tables.
- **`vigitra_redis`**: Memory cache layer for quick token validation and socket tracking.
- **`vigitra_rabbitmq`**: Message queue broker handling worker tasks.
- **`vigitra_backend`**: Async FastAPI application running OCR and AI processors.
- **`vigitra_frontend`**: Nginx web service serving React production build files.

---

## 2. Environment Configuration

Use `.env` file to customize deployment details:
- `POSTGRES_SERVER`: Hostname of the Postgres container (`postgres`).
- `POSTGRES_USER` / `POSTGRES_PASSWORD`: Database credentials.
- `REDIS_URL`: Link to Redis instance (`redis://redis:6379/0`).
- `RABBITMQ_URL`: Queue broker credentials.

---

## 3. Launching Services

Build and run all services in detached mode:
```bash
docker compose up -d --build
```
Verify container statuses:
```bash
docker compose ps
```
To check system log outputs:
```bash
docker compose logs -f backend
```
