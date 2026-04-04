#!/bin/bash

# Lokam DevTool — DB Setup & Migration Script
# Usage: ./setup_local_db.sh [--setup-db | --migrate | --drop-db | --reset-db | --help]
# If no option provided, runs interactive mode.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    echo "=========================================="
    echo "    Lokam DevTool — DB Setup & Migration"
    echo "=========================================="
    echo
    echo "Usage: $0 [option]"
    echo
    echo "Options:"
    echo "  --setup-db    Create database (idempotent)"
    echo "  --migrate     Run alembic upgrade head"
    echo "  --drop-db     Drop database (DESTRUCTIVE)"
    echo "  --reset-db    Drop + recreate + migrate (DESTRUCTIVE)"
    echo "  --help, -h    Show this help"
    echo
    echo "Reads DB_* variables from .env or environment."
    echo "Defaults: DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_NAME=devtool"
    echo
}

load_env_vars() {
    if [ -f ".env" ]; then
        print_status "Loading .env..."
        set -a
        # shellcheck disable=SC1091
        source .env
        set +a
    else
        print_warning ".env not found — using environment or defaults"
    fi

    export DB_HOST="${DB_HOST:-localhost}"
    export DB_PORT="${DB_PORT:-5432}"
    export DB_USER="${DB_USER:-postgres}"
    export DB_PASSWORD="${DB_PASSWORD:-zero}"
    export DB_NAME="${DB_NAME:-devtool}"

    print_status "DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
}

check_postgres() {
    print_status "Checking PostgreSQL..."
    if PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
        print_success "PostgreSQL is accessible"
    else
        print_error "Cannot reach PostgreSQL at ${DB_HOST}:${DB_PORT} as ${DB_USER}"
        print_error "Make sure Postgres is running and credentials in .env are correct"
        exit 1
    fi
}

activate_venv() {
    if [ -n "$VIRTUAL_ENV" ]; then
        print_success "Virtual env active: $VIRTUAL_ENV"
        return
    fi
    if [ -d ".venv" ]; then
        print_status "Activating .venv..."
        # shellcheck disable=SC1091
        source .venv/bin/activate
        print_success "Virtual env activated"
    else
        print_warning "No .venv found — run: python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    fi
}

db_exists() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"
}

create_database() {
    print_status "Creating database '${DB_NAME}'..."
    if db_exists; then
        print_success "Database '${DB_NAME}' already exists"
        return
    fi
    PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    print_success "Database '${DB_NAME}' created"
}

drop_database() {
    print_status "Dropping database '${DB_NAME}'..."
    if ! db_exists; then
        print_warning "Database '${DB_NAME}' does not exist — nothing to drop"
        return
    fi
    # Terminate active connections first
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
        >/dev/null 2>&1 || true
    PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    print_success "Database '${DB_NAME}' dropped"
}

run_migrations() {
    print_status "Running alembic upgrade head..."
    if ! command -v alembic &>/dev/null; then
        print_error "alembic not found — activate your venv and run: pip install -r requirements.txt"
        exit 1
    fi
    alembic upgrade head
    print_success "Migrations applied"
}

# ── Compound actions ──────────────────────────────────────────────────────────

do_setup() {
    check_postgres
    create_database
}

do_migrate() {
    activate_venv
    run_migrations
}

do_reset() {
    check_postgres
    drop_database
    create_database
    activate_venv
    run_migrations
}

# ── Interactive mode ──────────────────────────────────────────────────────────

main_interactive() {
    echo "=========================================="
    echo "    Lokam DevTool — DB Setup & Migration"
    echo "=========================================="
    echo
    load_env_vars
    check_postgres
    echo
    echo "Choose an action:"
    echo "  1) Create database"
    echo "  2) Run migrations (alembic upgrade head)"
    echo "  3) Create database + run migrations"
    echo "  4) Reset database (drop + recreate + migrate)  ⚠️  DESTRUCTIVE"
    echo "  5) Drop database  ⚠️  DESTRUCTIVE"
    echo "  6) Exit"
    echo
    read -r -p "Option [1-6]: " choice
    echo
    case "$choice" in
        1) do_setup ;;
        2) do_migrate ;;
        3) do_setup && do_migrate ;;
        4)
            read -r -p "Type 'yes' to confirm reset of '${DB_NAME}': " confirm
            [ "$confirm" = "yes" ] && do_reset || print_status "Cancelled"
            ;;
        5)
            read -r -p "Type 'yes' to confirm drop of '${DB_NAME}': " confirm
            [ "$confirm" = "yes" ] && { check_postgres; drop_database; } || print_status "Cancelled"
            ;;
        6) print_status "Bye"; exit 0 ;;
        *) print_error "Invalid option"; exit 1 ;;
    esac
    echo
    print_success "Done"
}

# ── Entry point ───────────────────────────────────────────────────────────────

load_env_vars

case "${1:-interactive}" in
    "--setup-db")  do_setup ;;
    "--migrate")   do_migrate ;;
    "--drop-db")
        check_postgres
        read -r -p "Type 'yes' to confirm drop of '${DB_NAME}': " confirm
        [ "$confirm" = "yes" ] && drop_database || print_status "Cancelled"
        ;;
    "--reset-db")
        read -r -p "Type 'yes' to confirm reset of '${DB_NAME}': " confirm
        [ "$confirm" = "yes" ] && do_reset || print_status "Cancelled"
        ;;
    "--help"|"-h") show_usage ;;
    "interactive") main_interactive ;;
    *) print_error "Unknown option: $1"; echo; show_usage; exit 1 ;;
esac
