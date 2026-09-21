"""
Report Generation Service — PDF reports for HR using WeasyPrint
Generates beautiful PDF reports with transcript, scores, and analysis
"""
import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def generate_report_html(
    candidate_name: str,
    candidate_email: str,
    session_id: str,
    session_date: str,
    duration_minutes: float,
    analysis: dict,
    transcript: list[dict],
    violations: list[dict],
    bond_year: int = 1,
) -> str:
    """
    Generate the HTML that will be converted to PDF.
    Returns a complete styled HTML string.
    """
    scores = analysis.get("scores", {})
    overall = analysis.get("overall_score", 0) or 0
    strengths = analysis.get("strengths", [])
    areas = analysis.get("areas_of_improvement", [])
    red_flags = analysis.get("red_flags", [])

    def score_color(score):
        if score is None:
            return "#64748b"
        if score >= 80:
            return "#00d4aa"
        if score >= 60:
            return "#f59e0b"
        return "#ef4444"

    def score_bar(score, label):
        if score is None:
            return ""
        color = score_color(score)
        return f"""
        <div class="score-row">
            <span class="score-label">{label}</span>
            <div class="score-bar-track">
                <div class="score-bar-fill" style="width:{score}%; background:{color}"></div>
            </div>
            <span class="score-value" style="color:{color}">{score:.0f}</span>
        </div>
        """

    transcript_html = ""
    for entry in transcript:
        speaker_class = "aria" if entry.get("speaker") == "aria" else "candidate"
        speaker_label = "Aria (AI Interviewer)" if entry.get("speaker") == "aria" else candidate_name
        q_type = entry.get("question_type", "")
        q_badge = f'<span class="q-badge">{q_type}</span>' if q_type else ""
        transcript_html += f"""
        <div class="transcript-entry {speaker_class}">
            <div class="speaker-header">
                <strong>{speaker_label}</strong>
                {q_badge}
                <span class="ts">{entry.get("timestamp", "")[:19].replace("T"," ")}</span>
            </div>
            <p>{entry.get("text","")}</p>
        </div>
        """

    violations_html = ""
    if violations:
        for v in violations:
            violations_html += f"""
            <div class="violation-item">
                <span class="v-type">{v.get("type","").replace("_"," ").title()}</span>
                <span class="v-time">at {v.get("at_seconds", 0):.0f}s</span>
                <span class="v-details">{v.get("details","")}</span>
            </div>
            """
    else:
        violations_html = '<p class="no-violations">✓ No proctoring violations detected</p>'

    red_flags_html = ""
    if red_flags:
        for flag in red_flags:
            red_flags_html += f'<li class="red-flag">{flag}</li>'
    else:
        red_flags_html = '<li class="no-flag">No significant red flags observed</li>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 13px; }}
  .page {{ padding: 40px 48px; max-width: 900px; margin: 0 auto; }}

  /* Header */
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #00d4aa; }}
  .logo-area h1 {{ font-size: 22px; font-weight: 800; color: #0a0f1e; }}
  .logo-area h1 span {{ color: #00d4aa; }}
  .logo-area p {{ color: #64748b; font-size: 11px; margin-top: 4px; }}
  .report-meta {{ text-align: right; color: #64748b; font-size: 11px; line-height: 1.8; }}

  /* Section */
  .section {{ margin-bottom: 28px; }}
  .section-title {{ font-size: 14px; font-weight: 700; color: #0a0f1e; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }}
  .section-title::before {{ content: ''; display: inline-block; width: 4px; height: 16px; background: #00d4aa; border-radius: 2px; }}

  /* Candidate card */
  .candidate-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; display: flex; gap: 16px; align-items: center; }}
  .avatar-circle {{ width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #00d4aa, #7c3aed); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700; }}
  .cand-details h2 {{ font-size: 16px; font-weight: 700; }}
  .cand-details p {{ color: #64748b; font-size: 12px; margin-top: 2px; }}
  .cand-meta {{ margin-left: auto; text-align: right; color: #64748b; font-size: 11px; line-height: 2; }}

  /* Overall score */
  .overall-score-box {{ background: linear-gradient(135deg, #0a0f1e, #1a2235); color: white; border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }}
  .overall-number {{ font-size: 48px; font-weight: 900; color: {score_color(overall)}; line-height: 1; }}
  .overall-label {{ font-size: 11px; color: #94a3b8; margin-top: 4px; }}
  .overall-tags {{ display: flex; gap: 8px; flex-wrap: wrap; }}
  .tag {{ padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; }}
  .tag-mindset {{ background: rgba(124,58,237,0.2); color: #a78bfa; }}
  .tag-ethical_decision_making {{ background: rgba(0,212,170,0.2); color: #00d4aa; }}
  .tag-domain {{ background: rgba(245,158,11,0.2); color: #f59e0b; }}

  /* Score bars */
  .score-row {{ display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }}
  .score-label {{ width: 160px; color: #475569; font-size: 12px; }}
  .score-bar-track {{ flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }}
  .score-bar-fill {{ height: 100%; border-radius: 4px; transition: width 0.3s; }}
  .score-value {{ width: 32px; text-align: right; font-weight: 700; font-size: 12px; }}

  /* Summary */
  .summary-text {{ background: #f8fafc; border-left: 4px solid #00d4aa; padding: 14px 18px; border-radius: 0 8px 8px 0; line-height: 1.7; color: #334155; font-size: 12px; }}

  /* Strengths / AOI */
  .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
  .list-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }}
  .list-box h4 {{ font-size: 12px; font-weight: 700; margin-bottom: 8px; }}
  .list-box.green h4 {{ color: #00d4aa; }}
  .list-box.amber h4 {{ color: #f59e0b; }}
  .list-box li {{ font-size: 11px; color: #475569; margin-left: 16px; margin-bottom: 4px; line-height: 1.5; }}

  /* Transcript */
  .transcript-entry {{ margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; }}
  .transcript-entry.aria {{ background: #ede9fe; border-left: 3px solid #7c3aed; }}
  .transcript-entry.candidate {{ background: #ecfdf5; border-left: 3px solid #00d4aa; }}
  .speaker-header {{ display: flex; gap: 8px; align-items: center; margin-bottom: 4px; font-size: 11px; }}
  .q-badge {{ background: #e2e8f0; color: #475569; padding: 1px 6px; border-radius: 10px; font-size: 10px; }}
  .ts {{ color: #94a3b8; margin-left: auto; }}
  .transcript-entry p {{ font-size: 12px; color: #334155; line-height: 1.6; }}

  /* Violations */
  .violation-item {{ display: flex; gap: 12px; align-items: center; padding: 8px 12px; background: #fef2f2; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #ef4444; font-size: 11px; }}
  .v-type {{ font-weight: 700; color: #ef4444; width: 140px; }}
  .v-time {{ color: #94a3b8; width: 60px; }}
  .v-details {{ color: #64748b; }}
  .no-violations {{ color: #00d4aa; font-weight: 600; font-size: 12px; }}
  .red-flag {{ color: #ef4444; font-size: 11px; margin-left: 16px; margin-bottom: 4px; }}
  .no-flag {{ color: #00d4aa; list-style: none; font-size: 11px; }}

  /* Footer */
  .footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }}

  /* Page break helpers */
  .page-break {{ page-break-before: always; }}
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      <h1>Techbee Chronicle <span>AI Interview (Module {bond_year})</span></h1>
      <p>Powered by Aria — Confidential HR Report</p>
    </div>
    <div class="report-meta">
      <div>Report ID: {session_id[:8].upper()}</div>
      <div>Generated: {datetime.utcnow().strftime("%d %b %Y, %H:%M")} UTC</div>
      <div>For HR Review Only</div>
    </div>
  </div>

  <!-- Candidate Info -->
  <div class="section">
    <div class="section-title">Candidate Profile</div>
    <div class="candidate-card">
      <div class="avatar-circle">{candidate_name[0].upper()}</div>
      <div class="cand-details">
        <h2>{candidate_name}</h2>
        <p>{candidate_email}</p>
      </div>
      <div class="cand-meta">
        <div>Date: {session_date}</div>
        <div>Duration: {duration_minutes:.0f} minutes</div>
        <div>Session: {session_id[:8].upper()}</div>
        <div>Module: Module {bond_year}</div>
      </div>
    </div>
  </div>

  <!-- Overall Score -->
  <div class="section">
    <div class="section-title">Evaluation Summary</div>
    <div class="overall-score-box">
      <div>
        <div class="overall-number">{overall:.0f}</div>
        <div class="overall-label">Overall Score / 100</div>
      </div>
      <div style="text-align:center;">
        <div class="overall-tags">
          <span class="tag tag-mindset">🧠 {analysis.get("mindset_label","—")}</span>
          <span class="tag tag-ethical_decision_making">💡 {analysis.get("ethical_decision_making_label","—")}</span>
        </div>
        <div style="margin-top:12px;" class="overall-tags">
          <span class="tag tag-domain">🎯 {analysis.get("domain_recommendation","—")}</span>
          <span class="tag tag-domain" style="opacity:0.7">Alt: {analysis.get("secondary_domain","—")}</span>
        </div>
      </div>
    </div>

    <!-- Score bars -->
    {score_bar(scores.get("vision_alignment"), "Communication")}
    {score_bar(scores.get("emotional_intelligence"), "Psychometric / Mindset")}
    {score_bar(scores.get("stress_tolerance"), "Problem Solving")}
    {score_bar(scores.get("adaptability"), "Confidence")}
    {score_bar(scores.get("team_collaboration"), "Clarity & Articulation")}
    {score_bar(scores.get("ethical_decision_making"), "Attitude")}
    {score_bar(scores.get("eye_contact"), "Eye Contact")}
    {score_bar(scores.get("body_language"), "Body Language")}
    {score_bar(scores.get("endurance"), "Endurance & Focus")}
    {score_bar(scores.get("cultural_fit"), "Forensic / Incident Deduction")}
    {score_bar(scores.get("leadership_potential"), "Cognitive Ability")}
  </div>

  <!-- AI Summary -->
  <div class="section">
    <div class="section-title">Aria's Evaluation Summary</div>
    <div class="summary-text">{analysis.get("summary_text","No summary available.")}</div>
  </div>

  <!-- Strengths & AOI -->
  <div class="section">
    <div class="section-title">Strengths & Areas for Improvement</div>
    <div class="two-col">
      <div class="list-box green">
        <h4>✓ Strengths</h4>
        <ul>{"".join(f"<li>{s}</li>" for s in strengths) or "<li>None identified</li>"}</ul>
      </div>
      <div class="list-box amber">
        <h4>△ Areas for Improvement</h4>
        <ul>{"".join(f"<li>{a}</li>" for a in areas) or "<li>None identified</li>"}</ul>
      </div>
    </div>
  </div>

  <!-- Red Flags -->
  <div class="section">
    <div class="section-title">⚠ Red Flags / Concerns</div>
    <ul>{red_flags_html}</ul>
  </div>

  <!-- Proctoring -->
  <div class="section">
    <div class="section-title">Proctoring Log</div>
    {violations_html}
  </div>

  <!-- Transcript (new page) -->
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">Full Interview Transcript</div>
    {transcript_html if transcript_html else "<p>No transcript available.</p>"}
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Techbee Chronicle AI Interview Platform — Aria v1.0 — Confidential</span>
    <span>This report is generated by AI and intended for HR review only.</span>
  </div>

</div>
</body>
</html>"""


async def generate_pdf_report(
    candidate_name: str,
    candidate_email: str,
    session_id: str,
    session_date: str,
    duration_minutes: float,
    analysis: dict,
    transcript: list[dict],
    violations: list[dict],
    bond_year: int = 1,
) -> bytes:
    """
    Generate a PDF report using WeasyPrint.
    Returns raw PDF bytes for upload to GCS.
    """
    try:
        from weasyprint import HTML
        html_content = generate_report_html(
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            session_id=session_id,
            session_date=session_date,
            duration_minutes=duration_minutes,
            analysis=analysis,
            transcript=transcript,
            violations=violations,
            bond_year=bond_year,
        )
        pdf_bytes = HTML(string=html_content).write_pdf()
        logger.info(f"PDF report generated: {len(pdf_bytes)} bytes for session {session_id}")
        return pdf_bytes
    except ImportError:
        logger.warning("WeasyPrint not installed — returning HTML bytes instead")
        html_content = generate_report_html(
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            session_id=session_id,
            session_date=session_date,
            duration_minutes=duration_minutes,
            analysis=analysis,
            transcript=transcript,
            violations=violations,
            bond_year=bond_year,
        )
        return html_content.encode("utf-8")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise
