#!/usr/bin/env python3
"""
Lokam DevTool — Backend Server Launcher

Usage:
    python start_server.py              # Start with uvicorn (auto-reload)
    python start_server.py --help       # Show help
    python start_server.py --no-reload  # Start without auto-reload
    python start_server.py --port 9000  # Start on custom port
"""

import argparse
import os
import sys
import textwrap
from pathlib import Path

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def print_banner(host: str, port: int) -> None:
    banner = textwrap.dedent(f"""\
    ╔══════════════════════════════════════════════╗
    ║       Lokam DevTool API Server               ║
    ╠══════════════════════════════════════════════╣
    ║  🌐  http://{host}:{port}                    ║
    ║  📖  Docs: http://{host}:{port}/docs         ║
    ╚══════════════════════════════════════════════╝
    """)
    print(banner)


def check_env() -> None:
    """Warn about missing required environment variables."""
    required = ["SECRET_KEY", "FERNET_KEY"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"⚠️  Warning: Missing env vars: {', '.join(missing)}")
        print("   Create a .env file (copy .env.example) or export them.\n")


def check_venv() -> None:
    """Warn if no virtual environment is active."""
    if not os.environ.get("VIRTUAL_ENV") and not hasattr(sys, "real_prefix"):
        print("⚠️  Warning: No virtual environment detected.")
        print("   Consider creating one: python -m venv .venv && source .venv/bin/activate\n")


def check_db() -> None:
    """Quick check that the database is reachable."""
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = os.environ.get("DB_NAME", "devtool")
    print(f"🗄️  Database: {db_host}:{db_port}/{db_name}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Start the Lokam DevTool backend server.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to bind to (default: 8000)"
    )
    parser.add_argument(
        "--no-reload", action="store_true", help="Disable auto-reload"
    )
    parser.add_argument(
        "--workers", type=int, default=1, help="Number of worker processes (default: 1)"
    )
    args = parser.parse_args()

    # Change to the directory containing this script so that relative imports work
    os.chdir(Path(__file__).resolve().parent)

    # Pre-flight checks
    check_venv()
    check_env()
    check_db()

    # Load .env file if python-dotenv is available
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv()
    except ImportError:
        # Manual .env loading fallback
        env_file = Path(".env")
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())

    print_banner(args.host, args.port)

    # Import and run uvicorn
    try:
        import uvicorn
    except ImportError:
        print("❌ uvicorn not found. Install dependencies:")
        print("   pip install -r requirements.txt")
        sys.exit(1)

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
        workers=args.workers,
        log_level="info",
    )


if __name__ == "__main__":
    main()
