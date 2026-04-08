# Lokam DevTool

Internal developer tool with a FastAPI backend and React frontend.

## Prerequisites

- Python 3.11+
- Node.js 18+ / Bun
- PostgreSQL 14+

---

## Backend Setup

### 1. Create and activate a virtual environment

```bash
cd server
python -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | yes | PostgreSQL host (default: `localhost`) |
| `DB_PORT` | yes | PostgreSQL port (default: `5432`) |
| `DB_USER` | yes | PostgreSQL user |
| `DB_PASSWORD` | yes | PostgreSQL password |
| `DB_NAME` | yes | Database name (default: `devtool`) |
| `SECRET_KEY` | yes | JWT signing key — generate with `openssl rand -hex 32` |
| `FERNET_KEY` | yes | Encryption key — generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ENVIRONMENT` | no | `development` \| `staging` \| `production` (default: `development`) |
| `PLAYGROUND_BASE_URL` | no | Base URL for the lokamspace playground environment |
| `PLAYGROUND_API_KEY` | no | API key for the calls-export endpoint |

### 4. Create the database and run migrations

```bash
./setup_local_db.sh --setup-db   # creates the database
./setup_local_db.sh --migrate    # runs alembic upgrade head
```

Or interactively:

```bash
./setup_local_db.sh
```

### 5. Start the backend server

```bash
python start_server.py
```

The API is available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

Optional flags:

```bash
python start_server.py --port 9000     # custom port
python start_server.py --no-reload     # disable auto-reload
```

---

## Frontend Setup

### 1. Install dependencies

```bash
cd client
npm install        # or: bun install
```

### 2. Start the dev server

```bash
npm run dev        # or: bun run dev
```

The app is available at `http://localhost:8080`.  
API requests to `/api/*` are proxied to `http://localhost:8000`.

---

## Running Both Together

Open two terminals:

```bash
# Terminal 1 — backend
cd server && source .venv/bin/activate && python start_server.py

# Terminal 2 — frontend
cd client && npm run dev
```

---

## Database Management

```bash
./setup_local_db.sh --setup-db    # create database (idempotent)
./setup_local_db.sh --migrate     # run pending migrations
./setup_local_db.sh --reset-db    # drop + recreate + migrate (destructive)
./setup_local_db.sh --drop-db     # drop database (destructive)
```

---

## Running Tests

### Backend

```bash
cd server
pytest
```

### Frontend

```bash
cd client
npm run test
```
