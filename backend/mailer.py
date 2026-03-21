"""Send transactional email via SMTP (optional — env-configured)."""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    Send plain-text password reset instructions. Returns True if handed off to SMTP successfully.
    """
    if not _smtp_configured():
        logger.warning(
            "SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD). "
            "Password reset email not sent to %s",
            to_email,
        )
        return False

    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("EMAIL_FROM", user).strip()
    app_name = os.getenv("EMAIL_APP_NAME", "Endura")

    deep_link_base = os.getenv("PASSWORD_RESET_DEEP_LINK_BASE", "endura://reset-password").rstrip(
        "/"
    )
    deep_link = f"{deep_link_base}?token={reset_token}"

    body = f"""Someone requested a password reset for your {app_name} account.

Copy the code below into the app (Forgot password → I have a reset code), or open this link on your phone if the app is installed:

{deep_link}

Reset code:
{reset_token}

This code expires in 1 hour.

If you did not request this, you can ignore this email.
"""

    msg = EmailMessage()
    msg["Subject"] = f"Reset your {app_name} password"
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except Exception:
        logger.exception("SMTP send failed for password reset to %s", to_email)
        return False
