"""
Email Service — Interview Invitation with .ics Calendar Attachment
Sends from techbeechronical@hcltech.com via configurable SMTP.

SMTP is configured in .env — set SMTP_ENABLED=True once credentials are ready.
Until then, all invitation details are logged for development/testing.
"""
import logging
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Dict

from app.core.config import settings

logger = logging.getLogger(__name__)

APP_URL = settings.FRONTEND_URL


def generate_ics(
    batch_name: str,
    scheduled_dt: datetime,
    expires_at: datetime,
    candidate_name: str,
    candidate_email: str,
    interview_url: str,
) -> bytes:
    """
    Generate an iCalendar (.ics) file for calendar blocking.
    Compatible with Outlook, Google Calendar, Apple Calendar.
    """
    organizer_email = settings.SMTP_USER or "techbeechronical@hcltech.com"
    uid = f"{candidate_name.replace(' ', '-')}-{scheduled_dt.strftime('%Y%m%d%H%M%S')}@techbeechronicle.com"
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtstart = scheduled_dt.strftime("%Y%m%dT%H%M%SZ")
    dtend = expires_at.strftime("%Y%m%dT%H%M%SZ")

    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TechBee Chronicle//AI Interview Platform//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{dtstamp}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:TechBee Chronicle AI Interview — {batch_name}
DESCRIPTION:Your Techbee Chronicle AI Interview has been scheduled.\\n\\nClick the link below to start your interview when ready:\\n{interview_url}\\n\\nPlease ensure:\\n• You are in a quiet environment\\n• Your camera and microphone are working\\n• You have a stable internet connection\\n\\nThis link is personal and valid until {expires_at.strftime('%d %b %Y %I:%M %p')} IST.
LOCATION:Online — {interview_url}
ORGANIZER;CN=TechBee Chronicle HR:mailto:{organizer_email}
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN={candidate_name}:mailto:{candidate_email}
STATUS:CONFIRMED
SEQUENCE:0
TRANSP:OPAQUE
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Your TechBee Chronicle interview starts in 15 minutes!
END:VALARM
BEGIN:VALARM
TRIGGER:-PT60M
ACTION:DISPLAY
DESCRIPTION:Your TechBee Chronicle interview is in 1 hour.
END:VALARM
END:VEVENT
END:VCALENDAR"""

    return ics_content.encode("utf-8")


def generate_html_email(
    candidate_name: str,
    batch_name: str,
    scheduled_dt: datetime,
    expires_at: datetime,
    interview_url: str,
    module_level: int,
) -> str:
    """Generate a premium HTML email for the interview invitation."""
    scheduled_str = scheduled_dt.strftime("%A, %d %B %Y at %I:%M %p IST")
    expires_str = expires_at.strftime("%d %b %Y %I:%M %p IST")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechBee Chronicle — Interview Invitation</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Inter,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);padding:40px 40px 30px;">
            <table width="100%"><tr>
              <td>
                <div style="font-family:'Segoe UI',sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                  Tech<span style="color:#fbbf24;">bee</span> Chronicle
                </div>
                <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:2px;margin-top:2px;">AI-Powered Interview Platform</div>
              </td>
              <td align="right">
                <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 14px;font-size:11px;color:#c7d2fe;font-weight:600;">
                  Module {module_level} Interview
                </div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Hero Section -->
        <tr>
          <td style="background:linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%);padding:40px 40px 30px;border-bottom:1px solid #e0e7ff;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">Interview Invitation</p>
            <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#1e1b4b;line-height:1.2;">Hello, {candidate_name} 👋</h1>
            <p style="margin:0;font-size:16px;color:#4338ca;font-weight:500;">{batch_name}</p>
          </td>
        </tr>

        <!-- Details Card -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              Your <strong>TechBee Chronicle AI Interview</strong> has been scheduled. 
              Aria, our AI interviewer, will conduct a personalised interview designed to understand your strengths and career aspirations.
            </p>

            <!-- Schedule Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;border-radius:12px;padding:24px;margin-bottom:24px;">
              <tr>
                <td style="padding:0 0 16px;">
                  <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Scheduled For</div>
                  <div style="font-size:18px;font-weight:700;color:#1e1b4b;">{scheduled_str}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Link Valid Until</div>
                  <div style="font-size:15px;font-weight:600;color:#dc2626;">{expires_str}</div>
                </td>
              </tr>
            </table>

            <!-- CTA Button (Bulletproof for Outlook / O365 / Webmail) -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{interview_url}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="20%" stroke="f" fillcolor="#4f46e5">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Segoe UI',sans-serif;font-size:16px;font-weight:bold;">Start My Interview &rarr;</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                    <tr>
                      <td align="center" bgcolor="#4f46e5" style="border-radius:12px;background-color:#4f46e5;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);box-shadow:0 4px 16px rgba(79,70,229,0.4);">
                        <a href="{interview_url}" target="_blank" style="display:inline-block;padding:16px 44px;font-family:'Segoe UI',Inter,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;border:1px solid #4f46e5;background-color:#4f46e5;mso-padding-alt:0;">
                          <span style="color:#ffffff;font-weight:700;text-decoration:none;">Start My Interview &rarr;</span>
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>

            <!-- Instructions -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#92400e;">Before You Begin — Please Ensure:</p>
                <ul style="margin:0;padding-left:20px;color:#78350f;font-size:13px;line-height:1.8;">
                  <li>You are in a <strong>quiet, well-lit environment</strong></li>
                  <li>Your <strong>camera and microphone</strong> are working correctly</li>
                  <li>You have a <strong>stable internet connection</strong></li>
                  <li>You speak <strong>clearly and confidently</strong> — Aria listens and understands</li>
                  <li>This is your <strong>personal link</strong> — do not share it</li>
                </ul>
              </td></tr>
            </table>

            <!-- Link fallback -->
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
              If the button above doesn't work, copy and paste this link into your browser:<br>
              <a href="{interview_url}" style="color:#6366f1;word-break:break-all;">{interview_url}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.8;">
              This email was sent from <strong>techbeechronical@hcltech.com</strong><br>
              TechBee Chronicle HR Portal — HCL Technologies<br>
              If you have questions, contact your HR team.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send_via_aws_ses(
    msg: MIMEMultipart,
    candidate_email: str,
) -> bool:
    """Send email via AWS SES over HTTPS (Port 443) — never blocked by firewalls."""
    try:
        import boto3
        ses = boto3.client(
            "ses",
            region_name=settings.AWS_REGION or "ap-southeast-2",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        ses.send_raw_email(
            Source=settings.SMTP_FROM,
            Destinations=[candidate_email],
            RawMessage={"Data": msg.as_string()},
        )
        return True
    except Exception as e:
        logger.warning(f"AWS SES send failed for {candidate_email}: {e}")
        return False


def send_batch_invitations(
    sessions: List[Dict],
    batch_name: str,
    batch_id: str,
    scheduled_dt: datetime,
    expires_at: datetime,
    module_level: int,
):
    """
    Background / thread-pool task: send email invitations to all candidates in a batch.
    Each email includes a personal .ics calendar file.

    1. Tries AWS SES (HTTPS Port 443 via REST) first — 100% reliable across cloud hosts (Render, AWS, etc.).
    2. Falls back to direct SMTP (Port 465 SSL, then Port 587 STARTTLS) if SES is unconfigured.
    """
    sent_count = 0
    failed_count = 0

    has_aws_credentials = bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)

    # If AWS credentials exist, send directly via AWS SES (over HTTPS Port 443, never firewall-blocked)
    if has_aws_credentials:
        logger.info(f"🚀 Dispatching {len(sessions)} invitation emails via AWS SES (HTTPS Port 443)...")
        for session in sessions:
            try:
                candidate_email = session["candidate_email"]
                candidate_name = session["candidate_name"]
                access_token = session.get("access_token", "")
                session_id = session["session_id"]
                interview_url = f"{APP_URL}/interview?token={access_token}&session={session_id}"

                msg = MIMEMultipart("mixed")
                msg["From"] = settings.SMTP_FROM
                msg["To"] = candidate_email
                msg["Subject"] = f"Your TechBee Chronicle Interview — {batch_name}"
                msg["Reply-To"] = settings.SMTP_USER

                html_body = generate_html_email(
                    candidate_name=candidate_name,
                    batch_name=batch_name,
                    scheduled_dt=scheduled_dt,
                    expires_at=expires_at,
                    interview_url=interview_url,
                    module_level=module_level,
                )
                msg.attach(MIMEText(html_body, "html", "utf-8"))

                ics_data = generate_ics(
                    batch_name=batch_name,
                    scheduled_dt=scheduled_dt,
                    expires_at=expires_at,
                    candidate_name=candidate_name,
                    candidate_email=candidate_email,
                    interview_url=interview_url,
                )
                ics_part = MIMEBase("text", "calendar", method="REQUEST", name="interview.ics")
                ics_part.set_payload(ics_data)
                encoders.encode_base64(ics_part)
                ics_part.add_header("Content-Disposition", "attachment", filename="interview.ics")
                msg.attach(ics_part)

                ok = _send_via_aws_ses(msg, candidate_email)
                if ok:
                    sent_count += 1
                    logger.info(f"✅ Email sent via AWS SES → {candidate_email} (batch {batch_id})")
                else:
                    failed_count += 1
            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Failed to process SES email for {session.get('candidate_email', '?')}: {e}")

        logger.info(f"Batch {batch_id} (SES): {sent_count} sent, {failed_count} failed")
        if sent_count > 0:
            return {"sent": sent_count, "failed": failed_count, "provider": "aws_ses", "error": None}

    # Fallback to SMTP (works in local development or if AWS SES is not configured)
    if not settings.smtp_configured:
        logger.warning(
            "📧 SMTP not configured and SES unavailable — invitations NOT sent."
        )
        return {"sent": 0, "failed": len(sessions), "error": "No email provider available"}

    import smtplib
    smtp = None
    ports_to_try = [settings.SMTP_PORT]
    if settings.SMTP_PORT == 465:
        ports_to_try.append(587)
    else:
        ports_to_try.append(465)

    conn_errors = []
    for port in ports_to_try:
        try:
            logger.info(f"Connecting to SMTP server {settings.SMTP_HOST}:{port}...")
            if port == 465:
                smtp = smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=10)
            else:
                smtp = smtplib.SMTP(settings.SMTP_HOST, port, timeout=10)
                smtp.ehlo()
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
            logger.info(f"Connected to SMTP {settings.SMTP_HOST}:{port} successfully.")
            break
        except Exception as conn_err:
            conn_errors.append(f"Port {port}: {type(conn_err).__name__}: {str(conn_err)}")
            logger.warning(f"Failed to connect to SMTP {settings.SMTP_HOST}:{port}: {conn_err}")
            if smtp:
                try:
                    smtp.quit()
                except Exception:
                    pass
            smtp = None

    if not smtp:
        err_msg = f"All SMTP connection attempts failed: {'; '.join(conn_errors)}"
        logger.error(f"❌ {err_msg}")
        return {"sent": 0, "failed": len(sessions), "error": err_msg}

    try:
        for session in sessions:
            try:
                candidate_email = session["candidate_email"]
                candidate_name = session["candidate_name"]
                access_token = session.get("access_token", "")
                session_id = session["session_id"]
                interview_url = f"{APP_URL}/interview?token={access_token}&session={session_id}"

                msg = MIMEMultipart("mixed")
                msg["From"] = settings.SMTP_FROM
                msg["To"] = candidate_email
                msg["Subject"] = f"Your TechBee Chronicle Interview — {batch_name}"
                msg["Reply-To"] = settings.SMTP_USER

                html_body = generate_html_email(
                    candidate_name=candidate_name,
                    batch_name=batch_name,
                    scheduled_dt=scheduled_dt,
                    expires_at=expires_at,
                    interview_url=interview_url,
                    module_level=module_level,
                )
                msg.attach(MIMEText(html_body, "html", "utf-8"))

                ics_data = generate_ics(
                    batch_name=batch_name,
                    scheduled_dt=scheduled_dt,
                    expires_at=expires_at,
                    candidate_name=candidate_name,
                    candidate_email=candidate_email,
                    interview_url=interview_url,
                )
                ics_part = MIMEBase("text", "calendar", method="REQUEST", name="interview.ics")
                ics_part.set_payload(ics_data)
                encoders.encode_base64(ics_part)
                ics_part.add_header("Content-Disposition", "attachment", filename="interview.ics")
                msg.attach(ics_part)

                smtp.sendmail(settings.SMTP_USER, candidate_email, msg.as_string())
                sent_count += 1
                logger.info(f"✅ Email sent → {candidate_email} (batch {batch_id})")

            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Failed to send to {session.get('candidate_email', '?')}: {e}")

    finally:
        try:
            smtp.quit()
        except Exception:
            pass

    logger.info(f"Batch {batch_id} (SMTP): {sent_count} sent, {failed_count} failed")
    return {"sent": sent_count, "failed": failed_count, "provider": "smtp", "error": None}

