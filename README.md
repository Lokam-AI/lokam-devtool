# Lokam DevTool

Internal developer productivity platform with a FastAPI backend and React frontend.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Alembic |
| Frontend | React, TypeScript, Vite, Bun |
| Database | PostgreSQL 14+ |
| Auth | JWT (HS256) + Fernet encryption |

## Prerequisites

- Python 3.11+
- Node.js 18+ or [Bun](https://bun.sh)
- PostgreSQL 14+

---

## Quick Start

### 1. Backend

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in values (see table below)
./setup_local_db.sh           # interactive: creates DB + runs migrations
python start_server.py
```

API available at `http://localhost:8000` · Docs at `http://localhost:8000/docs`

### 2. Frontend

```bash
cd client
bun install                   # or: npm install
bun run dev                   # or: npm run dev
```

App available at `http://localhost:8080` (proxies `/api/*` → `http://localhost:8000`)

---

## Environment Variables

Copy `.env.example` to `.env` in the `server/` directory and fill in:

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | yes | PostgreSQL host (default: `localhost`) |
| `DB_PORT` | yes | PostgreSQL port (default: `5432`) |
| `DB_USER` | yes | PostgreSQL user |
| `DB_PASSWORD` | yes | PostgreSQL password |
| `DB_NAME` | yes | Database name (default: `devtool`) |
| `SECRET_KEY` | yes | JWT signing key — `openssl rand -hex 32` |
| `FERNET_KEY` | yes | Encryption key — `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ENVIRONMENT` | no | `development` \| `staging` \| `production` (default: `development`) |
| `PLAYGROUND_BASE_URL` | no | Base URL for the lokamspace playground |
| `PLAYGROUND_API_KEY` | no | API key for the calls-export endpoint |

---

## Database Management

```bash
./setup_local_db.sh --setup-db    # create database (idempotent)
./setup_local_db.sh --migrate     # run pending Alembic migrations
./setup_local_db.sh --reset-db    # drop + recreate + migrate (destructive)
./setup_local_db.sh --drop-db     # drop database (destructive)
```

---

## Backend Server Options

```bash
python start_server.py                # default: port 8000, auto-reload on
python start_server.py --port 9000    # custom port
python start_server.py --no-reload    # disable auto-reload
```

---

## Testing

```bash
# Backend
cd server && pytest

# Frontend
cd client && bun run test
```

---

## Project Structure

```
lokam-devtool/
├── server/          # FastAPI application
│   ├── routers/     # HTTP layer (routes only)
│   ├── services/    # Business logic
│   ├── repositories/# Database access
│   ├── models/      # SQLAlchemy ORM models
│   ├── schemas/     # Pydantic request/response models
│   └── alembic/     # Database migrations
└── client/          # React + TypeScript frontend
    └── src/
```

---

## Running Both Servers

```bash
# Terminal 1 — backend
cd server && source .venv/bin/activate && python start_server.py

# Terminal 2 — frontend
cd client && bun run dev
```
