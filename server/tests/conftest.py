import os

os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_USER", "postgres")
os.environ.setdefault("DB_PASSWORD", "zero")
os.environ.setdefault("DB_NAME", "devtool_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("FERNET_KEY", "")
