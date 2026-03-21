#!/usr/bin/env python3
"""
One-off: set a user's password hash in the database (bcrypt, same as the API).

Usage (from repo root or backend/):
  export DATABASE_URL='postgresql://...'   # copy from Railway → Postgres → Connect
  cd backend && python3 set_user_password.py 'aseem.munshi@gmail.com' 'YourNewPassword'

Requires: pip install from ../requirements.txt (bcrypt, sqlalchemy, psycopg2-binary).
"""
from __future__ import annotations

import argparse
import os
import sys

# auth.py requires SECRET_KEY when DATABASE_URL is PostgreSQL (import-time check)
os.environ.setdefault("SECRET_KEY", "set_user_password_script_unused")

# Ensure backend package imports resolve when run as script
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from sqlalchemy import func  # noqa: E402

from auth import get_password_hash  # noqa: E402
from database import SessionLocal  # noqa: E402
import models  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset a user's login password (production DB).")
    parser.add_argument("email", help="User email (case-insensitive match)")
    parser.add_argument("password", help="New password (min 8 chars recommended)")
    args = parser.parse_args()

    if not os.getenv("DATABASE_URL"):
        print("Error: set DATABASE_URL to your Railway Postgres connection string.", file=sys.stderr)
        sys.exit(1)

    if len(args.password) < 8:
        print("Warning: password is shorter than 8 characters (app registration requires 8+).", file=sys.stderr)

    normalized = args.email.strip().lower()
    db = SessionLocal()
    try:
        user = (
            db.query(models.User)
            .filter(func.lower(models.User.email) == normalized)
            .first()
        )
        if not user:
            print(f"No user found for email matching: {args.email!r}", file=sys.stderr)
            sys.exit(2)

        user.hashed_password = get_password_hash(args.password)
        db.commit()
        print(f"Updated password for user id={user.id} email={user.email!r}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
