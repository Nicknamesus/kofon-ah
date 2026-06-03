"""Bootstrap the first superadmin.

Idempotent: if any admin user already exists, this is a no-op. Otherwise it
creates one `superadmin` from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD
(env / .env) or from --email/--password flags.

    python -m app.admin.bootstrap
    python -m app.admin.bootstrap --email boss@kofon.com --password 's3cret!'

`deploy.sh` runs this after migrations; once the superadmin exists, reruns do
nothing.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import func, select

from app.admin.security import hash_password
from app.config import get_settings
from app.db import SessionLocal, engine
from app.models import AdminUser


async def run(email: str | None, password: str | None) -> int:
    settings = get_settings()
    email = (email or settings.admin_bootstrap_email or "").strip().lower()
    password = password or settings.admin_bootstrap_password

    try:
        async with SessionLocal() as session:
            count = (
                await session.execute(select(func.count()).select_from(AdminUser))
            ).scalar_one()
            if count and count > 0:
                print("Admin users already exist — nothing to do.")
                return 0

            if not email or not password:
                print(
                    "No admin users yet, and no bootstrap credentials provided.\n"
                    "Set ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD in .env, "
                    "or pass --email/--password.",
                    file=sys.stderr,
                )
                return 2

            session.add(
                AdminUser(
                    email=email,
                    password_hash=hash_password(password),
                    role="superadmin",
                    is_active=True,
                )
            )
            await session.commit()
            print(f"Created superadmin: {email}")
            return 0
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the first superadmin.")
    parser.add_argument("--email", default=None)
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    code = asyncio.run(run(args.email, args.password))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
