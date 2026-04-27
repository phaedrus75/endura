"""Transactional support replies to anonymous feedback submitters (email)."""
from __future__ import annotations

import html
import logging
import os

logger = logging.getLogger(__name__)


def send_support_reply_email_sync(to_email: str, reply_body: str, feedback_title: str | None) -> bool:
    """Send a plain support reply via Resend. No DB access — safe from daemon threads.

    Returns True if Resend accepted the message (or dev no-op), False on hard failure.
    """
    resend_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM", "Endura <onboarding@resend.dev>")
    subject = "Re: your Endura feedback"
    if feedback_title and feedback_title.strip():
        subject = f"Re: {feedback_title.strip()[:80]}"

    safe_body = html.escape(reply_body or "").replace("\n", "<br>\n")
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#E7EFEA;border-radius:16px">
      <h2 style="color:#5F8C87;margin:0 0 12px">Endura</h2>
      <p style="color:#555;margin:0 0 16px">We read your feedback and wanted to follow up:</p>
      <div style="background:#fff;border-radius:12px;padding:20px;color:#2D3B36;line-height:1.5">
        {safe_body}
      </div>
      <p style="color:#999;font-size:12px;margin:20px 0 0">You can reply to this email if you need anything else.</p>
    </div>
    """

    if not resend_key:
        logger.warning("RESEND_API_KEY not set — support reply email not sent")
        return False

    try:
        import resend
        from resend.http_client_requests import RequestsClient

        resend.api_key = resend_key
        resend.default_http_client = RequestsClient(timeout=12)
        resend.Emails.send({
            "from": resend_from,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        })
        logger.info(f"Support reply email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send support reply email to {to_email}: {e}", exc_info=True)
        return False
