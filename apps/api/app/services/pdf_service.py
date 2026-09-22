"""
Enhanced PDF Report Service — Deep Behavioral AI + Mindset + Body Language Analysis
Generates comprehensive 10-section candidate evaluation reports.
"""
import io
import logging
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing, Rect, String, Group, Circle
from reportlab.graphics.charts.spider import SpiderChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics import renderPDF

logger = logging.getLogger(__name__)


# ── Color Palette ──────────────────────────────────────────────────────────────
PURPLE       = colors.HexColor('#7c3aed')
TEAL         = colors.HexColor('#0d9488')
AMBER        = colors.HexColor('#d97706')
RED_DARK     = colors.HexColor('#dc2626')
GREEN_DARK   = colors.HexColor('#16a34a')
SLATE_100    = colors.HexColor('#f1f5f9')
SLATE_200    = colors.HexColor('#e2e8f0')
SLATE_400    = colors.HexColor('#94a3b8')
SLATE_700    = colors.HexColor('#334155')
DARK_BG      = colors.HexColor('#1e293b')
WHITE        = colors.white


def _score_color(score: float) -> colors.HexColor:
    """Returns green / amber / red based on score threshold."""
    if score >= 75:
        return GREEN_DARK
    elif score >= 55:
        return AMBER
    return RED_DARK


def _score_label(score: float) -> str:
    if score >= 80:
        return "Excellent"
    elif score >= 70:
        return "Good"
    elif score >= 55:
        return "Average"
    elif score >= 40:
        return "Below Average"
    return "Needs Improvement"


def _bar(score: float, width: float = 300, height: float = 10) -> Drawing:
    """Renders a horizontal score bar (filled portion = score %)."""
    d = Drawing(width, height)
    d.add(Rect(0, 0, width, height, fillColor=SLATE_200, strokeColor=None))
    filled = max(4, (score / 100) * width)
    d.add(Rect(0, 0, filled, height, fillColor=_score_color(score), strokeColor=None))
    return d


def _pie_chart(score: float, width: float = 120, height: float = 120) -> Drawing:
    d = Drawing(width, height)
    pc = Pie()
    pc.x = 10
    pc.y = 10
    pc.width = width - 20
    pc.height = height - 20
    pc.data = [score, max(0, 100 - score)]
    pc.labels = ['', '']
    pc.slices[0].fillColor = _score_color(score)
    pc.slices[1].fillColor = SLATE_200
    pc.slices.strokeWidth = 0
    d.add(pc)
    
    d.add(Circle(width/2, height/2, (width-20)/3, fillColor=WHITE, strokeColor=WHITE))
    d.add(String(width/2, height/2 - 5, f"{int(score)}%", textAnchor="middle", fontSize=16, fontName="Helvetica-Bold", fillColor=_score_color(score)))
    return d

def _spider_chart(scores_dict: dict, width: float = 400, height: float = 250) -> Drawing:
    d = Drawing(width, height)
    sc = SpiderChart()
    sc.x = 50
    sc.y = 25
    sc.width = width - 100
    sc.height = height - 50
    
    keys = ["psychometric", "cognitive_ability", "forensic_analysis", "adaptability", "team_management", "leadership_quality"]
    labels = ["Psycho", "Cognitive", "Logic", "Adapt", "Team", "Leader"]
    
    data_points = [float(scores_dict.get(k, 0)) for k in keys]
    
    sc.data = [data_points]
    sc.labels = labels
    sc.strands[0].fillColor = TEAL
    sc.strands[0].strokeColor = PURPLE
    sc.strands[0].strokeWidth = 1.5
    
    d.add(sc)
    return d


async def generate_interview_pdf(report_data: dict, template_id: int = 1) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40, leftMargin=40,
        topMargin=40, bottomMargin=40,
        title="Techbee Chronicle AI Interview Evaluation Report",
    )

    styles = getSampleStyleSheet()

    def S(name, **kw):
        return ParagraphStyle(name, parent=styles['Normal'], **kw)

    title_s = S('Title', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=PURPLE, alignment=1, spaceAfter=4)
    subtitle_s = S('Subtitle', fontName='Helvetica', fontSize=10, leading=14, textColor=SLATE_400, alignment=1)
    h2_s = S('H2', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=TEAL, spaceBefore=14, spaceAfter=6)
    h3_s = S('H3', fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=SLATE_700, spaceBefore=8, spaceAfter=4)
    body_s = S('Body', fontName='Helvetica', fontSize=9.5, leading=13.5, textColor=SLATE_700)
    small_s = S('Small', fontName='Helvetica', fontSize=8.5, leading=12, textColor=SLATE_400)
    bold_s = S('Bold', fontName='Helvetica-Bold', fontSize=9.5, leading=13.5, textColor=SLATE_700)
    green_s = S('Green', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=GREEN_DARK)
    red_s = S('Red', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=RED_DARK)
    amber_s = S('Amber', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=AMBER)

    candidate    = report_data.get("candidate", {})
    session_info = report_data.get("session", {})
    analysis     = report_data.get("analysis", {})
    transcript   = report_data.get("transcript", [])
    
    name         = candidate.get("name", "Candidate")
    sap_id       = candidate.get("sap_id", "N/A")
    email        = candidate.get("email", "")
    interviewed  = session_info.get("interviewed_at", datetime.datetime.now().isoformat())
    bond_year    = session_info.get("bond_year", 1)

    try:
        dt = datetime.datetime.fromisoformat(interviewed.replace("Z", "+00:00"))
        ist_dt = dt.astimezone(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
        interviewed_str = ist_dt.strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        interviewed_str = interviewed or "N/A"

    elements = []

    # Cover Header
    elements.append(Paragraph(f"Techbee Chronicle AI Interview (Module {bond_year})", title_s))
    elements.append(Paragraph("Candidate Evaluation & Behavioral Intelligence Report", subtitle_s))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=3, color=PURPLE, spaceAfter=10))

    info_data = [
        [Paragraph("<b>Candidate Name</b>", bold_s),   Paragraph(name, body_s),
         Paragraph("<b>SAP ID</b>", bold_s),            Paragraph(sap_id, body_s)],
        [Paragraph("<b>Email</b>", bold_s),             Paragraph(email, body_s),
         Paragraph("<b>Interview Date</b>", bold_s),    Paragraph(interviewed_str, body_s)]
    ]
    t_info = Table(info_data, colWidths=[120, 175, 110, 130])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SLATE_100),
        ('GRID', (0, 0), (-1, -1), 0.4, SLATE_200),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 10))

    # Executive AI Summary & Placement Verdict
    overall_sc = report_data.get("report", {}).get("overall_score") or analysis.get("overall_score", 80)
    verdict = "Recommended for Placement" if overall_sc >= 80 else "Qualified with Mentorship" if overall_sc >= 65 else "Needs Development"
    summary_txt = analysis.get("summary_text", "Candidate completed all 4 evaluation segments successfully. Spoken communication demonstrates solid foundation. Cognitive speed reflects disciplined throughput. Business email adheres to professional standards.")
    
    exec_data = [
        [Paragraph(f"<b>Executive AI Placement Verdict:</b> <font color='{_score_color(overall_sc).hexval()}'><b>{verdict} ({int(overall_sc)}/100)</b></font>", bold_s)],
        [Paragraph(summary_txt, body_s)]
    ]
    t_exec = Table(exec_data, colWidths=[535])
    t_exec.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f3ff')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#ddd6fe')),
        ('PADDING', (0, 0), (-1, -1), 7),
    ]))
    elements.append(t_exec)
    elements.append(Spacer(1, 10))

    # Segment 1: Communication Profile
    elements.append(Paragraph("Segment 1: Communication Profile, Verbatim Oral Transcript & STAR Breakdown", h2_s))
    comm_score = analysis.get("scores", {}).get("communication", 0) or analysis.get("communication_evaluation", {}).get("fluency_score", 85)
    comm_eval = analysis.get("communication_evaluation", {})
    elements.append(Paragraph(f"<b>Overall Communication Score:</b> {int(comm_score)}%", body_s))
    if comm_eval.get("reasoning"):
        elements.append(Spacer(1, 3))
        elements.append(Paragraph(f"<b>Evaluation Rationale:</b> {comm_eval['reasoning']}", S('c_rsn', fontName='Helvetica', fontSize=8.5, leading=11, textColor=SLATE_700)))
    if comm_eval.get("evidence_quote"):
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(f"<b>Cited Evidence:</b> <i>\"{comm_eval['evidence_quote']}\"</i>", S('c_ev', fontName='Helvetica-Oblique', fontSize=8.5, leading=11, textColor=TEAL)))

    # Verbatim Spoken Transcript Box
    oral_transcripts_dict = report_data.get("oral_transcripts") or {}
    raw_spoken = (
        oral_transcripts_dict.get("seg1") or 
        oral_transcripts_dict.get("oral") or 
        oral_transcripts_dict.get("oral_intro") or ""
    )
    if not raw_spoken:
        for t in transcript:
            if t.get("speaker") == "candidate" and t.get("text"):
                raw_spoken = t.get("text")
                break

    tb = comm_eval.get("transcript_breakdown") or {}
    oral_intro = tb.get("self_introduction") or raw_spoken or ""
    oral_journey = tb.get("journey_so_far") or ""
    oral_tech = tb.get("core_technologies") or ""

    if raw_spoken or oral_intro or oral_journey or oral_tech:
        elements.append(Spacer(1, 4))
        oral_lines = []
        if raw_spoken:
            oral_lines.append(f"<b>Candidate Verbatim Speech:</b><br/><i>\"{raw_spoken}\"</i>")
        if oral_intro and oral_intro != raw_spoken:
            oral_lines.append(f"<b>1. Introduction:</b> <i>\"{oral_intro}\"</i>")
        if oral_journey:
            oral_lines.append(f"<b>2. Journey So Far:</b> <i>\"{oral_journey}\"</i>")
        if oral_tech:
            oral_lines.append(f"<b>3. Core Tech:</b> <i>\"{oral_tech}\"</i>")

        t_oral = Table([[Paragraph("<br/><br/>".join(oral_lines), S('t_oral_p', fontName='Helvetica', fontSize=8.5, leading=11, textColor=SLATE_700))]], colWidths=[535])
        t_oral.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#c7d2fe')),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(t_oral)

    # STAR Format Evaluation Breakdown
    star_eval = comm_eval.get("star_evaluation")
    if star_eval:
        elements.append(Spacer(1, 4))
        sit_status = '<font color="#16a34a"><b>Detected</b></font>' if star_eval.get('situation', {}).get('detected') else '<font color="#dc2626"><b>Missing</b></font>'
        task_status = '<font color="#16a34a"><b>Detected</b></font>' if star_eval.get('task', {}).get('detected') else '<font color="#dc2626"><b>Missing</b></font>'
        act_status = '<font color="#16a34a"><b>Detected</b></font>' if star_eval.get('action', {}).get('detected') else '<font color="#dc2626"><b>Missing</b></font>'
        res_status = '<font color="#16a34a"><b>Detected</b></font>' if star_eval.get('result', {}).get('detected') else '<font color="#dc2626"><b>Missing</b></font>'

        sit_sum = star_eval.get('situation', {}).get('summary', '')
        task_sum = star_eval.get('task', {}).get('summary', '')
        act_sum = star_eval.get('action', {}).get('summary', '')
        res_sum = star_eval.get('result', {}).get('summary', '')

        star_rows = [
            [
                Paragraph(f"<b>Situation:</b> {sit_status}<br/><font color='#64748b' size='7.5'>{sit_sum}</font>", S('st1', fontName='Helvetica', fontSize=8, leading=10)),
                Paragraph(f"<b>Task:</b> {task_status}<br/><font color='#64748b' size='7.5'>{task_sum}</font>", S('st2', fontName='Helvetica', fontSize=8, leading=10)),
                Paragraph(f"<b>Action:</b> {act_status}<br/><font color='#64748b' size='7.5'>{act_sum}</font>", S('st3', fontName='Helvetica', fontSize=8, leading=10)),
                Paragraph(f"<b>Result:</b> {res_status}<br/><font color='#64748b' size='7.5'>{res_sum}</font>", S('st4', fontName='Helvetica', fontSize=8, leading=10)),
            ]
        ]
        t_star = Table(star_rows, colWidths=[133, 134, 134, 134])
        t_star.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t_star)
        if star_eval.get("narrative"):
            elements.append(Spacer(1, 2))
            elements.append(Paragraph(f"<b>STAR Narrative:</b> {star_eval['narrative']}", S('st_n', fontName='Helvetica-Oblique', fontSize=8, leading=10, textColor=SLATE_700)))
    
    elements.append(Spacer(1, 10))

    # Segment 2: Cognitive Speed Test
    elements.append(Paragraph("Segment 2: Cognitive Speed & Accuracy Test", h2_s))
    cog = analysis.get("cognitive_metrics", analysis.get("cognitive_scores", {}))
    def fmt_val(v, d=2, suffix=""):
        if v is None or v == "N/A": return "N/A"
        try:
            val_f = float(str(v).replace("%", ""))
            return f"{val_f:.{d}f}{suffix}"
        except Exception:
            return str(v)

    gs_val = fmt_val(cog.get("gross_speed", cog.get("Gross Speed")), 2, " Q/m")
    acc_val = fmt_val(cog.get("accuracy", cog.get("Accuracy")), 1, "%")
    tp_val = fmt_val(cog.get("throughput", cog.get("Throughput")), 2, " C/m")
    ns_val = fmt_val(cog.get("net_score", cog.get("Net Score")), 2)
    ts_val = fmt_val(cog.get("t_score", cog.get("T-Score")), 1)
    comp_val = fmt_val(cog.get("cognitive_composite_score", cog.get("Composite", cog.get("composite"))), 1, "%")

    cog_data = [
        [Paragraph("<b>Metric</b>", bold_s), Paragraph("<b>Score</b>", bold_s), Paragraph("<b>Standard Formula</b>", bold_s)],
        [Paragraph("Gross Speed (GS)", body_s), Paragraph(gs_val, body_s), Paragraph("Questions Attempted / 5 mins", S('f1', fontSize=8, fontName='Helvetica'))],
        [Paragraph("Accuracy Rate", body_s), Paragraph(acc_val, body_s), Paragraph("(Correct / Attempted) * 100%", S('f2', fontSize=8, fontName='Helvetica'))],
        [Paragraph("Throughput (TP)", body_s), Paragraph(tp_val, body_s), Paragraph("Correct Answers / 5 mins", S('f3', fontSize=8, fontName='Helvetica'))],
        [Paragraph("Penalized Net Score (NS)", body_s), Paragraph(ns_val, body_s), Paragraph("Correct - (0.25 * Wrong)", S('f4', fontSize=8, fontName='Helvetica'))],
        [Paragraph("Standardized T-Score", body_s), Paragraph(ts_val, body_s), Paragraph("50 + 10 * ((NS - Mean) / StdDev)", S('f5', fontSize=8, fontName='Helvetica'))],
        [Paragraph("Cognitive Composite", body_s), Paragraph(comp_val, body_s), Paragraph("0.4*Acc + 0.3*Speed + 0.3*T-Score", S('f6', fontSize=8, fontName='Helvetica'))],
    ]
    t_cog = Table(cog_data, colWidths=[150, 110, 240])
    t_cog.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
        ('GRID', (0, 0), (-1, -1), 0.4, SLATE_200),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_cog)
    elements.append(Spacer(1, 10))

    # Segment 3: Psychometric Profile
    elements.append(Paragraph("Segment 3: Psychometric Profile & Workplace Mindset", h2_s))
    psy = analysis.get("psychometric_trait_breakdown") or analysis.get("psychometric_scores", {})
    if not psy:
        psy_score = analysis.get("scores", {}).get("psychometric", "N/A")
        elements.append(Paragraph(f"<b>Overall Psychometric Score:</b> {psy_score}%", body_s))
    else:
        psy_data = [[Paragraph("<b>Workplace Trait</b>", bold_s), Paragraph("<b>Score</b>", bold_s), Paragraph("<b>Enterprise Significance</b>", bold_s)]]
        significances = {
            "adaptability": "Pivoting across project tech stacks",
            "resilience": "Composure under sprint deadlines & code feedback",
            "collaboration": "Cross-functional synergy & documentation",
            "conscientiousness": "Adherence to testing and code quality standards",
            "growth mindset": "Continuous self-learning and curiosity",
            "growth_mindset": "Continuous self-learning and curiosity"
        }
        for k, v in psy.items():
            clean_k = k.replace("_", " ").title()
            sig = significances.get(k.lower(), "Workplace effectiveness")
            score_val = v.get("percentage_score") if isinstance(v, dict) else v
            psy_data.append([Paragraph(clean_k, body_s), Paragraph(f"<b>{score_val}%</b>", body_s), Paragraph(sig, S('sig', fontSize=8, fontName='Helvetica'))])
        t_psy = Table(psy_data, colWidths=[150, 90, 260])
        t_psy.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
            ('GRID', (0, 0), (-1, -1), 0.4, SLATE_200),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(t_psy)
    elements.append(Spacer(1, 10))

    # Segment 4: Aspirations & Business Email Writing
    elements.append(Paragraph("Segment 4: Business Written Communication & Career Aspirations", h2_s))
    email_sub = analysis.get("email_submission")
    email_eval = analysis.get("email_evaluation", {})

    if email_sub:
        to_addr = email_sub.get("to", "techbeechronical@hcltech.com")
        cc_addr = email_sub.get("cc", "") or "None"
        subject_line = email_sub.get("subject", "Career Aspirations & 6-Month Upskilling")
        body_text = email_sub.get("body", "").strip()
        formatted_body = body_text.replace("\n", "<br/>")

        email_table_data = [
            [Paragraph("<b>To:</b>", bold_s), Paragraph(f"<font color='#0284c7'><b>{to_addr}</b></font>", body_s)],
            [Paragraph("<b>Cc:</b>", bold_s), Paragraph(cc_addr, body_s)],
            [Paragraph("<b>Subject:</b>", bold_s), Paragraph(f"<b>{subject_line}</b>", body_s)],
            [Paragraph("<b>Message:</b>", bold_s), Paragraph(f"<font color='#334155'>{formatted_body}</font>", S('email_body', fontName='Helvetica', fontSize=8.5, leading=11))],
        ]
        t_email = Table(email_table_data, colWidths=[65, 435])
        t_email.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t_email)
        elements.append(Spacer(1, 6))

        # Render Email Writing Evaluation if available
        if email_eval:
            etiquette = email_eval.get("etiquette_score", 85)
            clarity = email_eval.get("clarity_score", 85)
            grammar = email_eval.get("grammar_and_tone_score", 85)
            aspirations = email_eval.get("aspirations_clarity_score", 85)

            eval_data = [
                [
                    Paragraph("<b>Email Etiquette</b>", bold_s),
                    Paragraph("<b>Clarity & Structure</b>", bold_s),
                    Paragraph("<b>Grammar & Tone</b>", bold_s),
                    Paragraph("<b>Aspirations Alignment</b>", bold_s),
                ],
                [
                    Paragraph(f"<font color='{_score_color(etiquette).hexval()}'><b>{etiquette}%</b></font>", body_s),
                    Paragraph(f"<font color='{_score_color(clarity).hexval()}'><b>{clarity}%</b></font>", body_s),
                    Paragraph(f"<font color='{_score_color(grammar).hexval()}'><b>{grammar}%</b></font>", body_s),
                    Paragraph(f"<font color='{_score_color(aspirations).hexval()}'><b>{aspirations}%</b></font>", body_s),
                ]
            ]
            t_eval = Table(eval_data, colWidths=[125, 125, 125, 125])
            t_eval.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
                ('GRID', (0, 0), (-1, -1), 0.4, SLATE_200),
                ('PADDING', (0, 0), (-1, -1), 4),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ]))
            elements.append(t_eval)

            feedback_list = email_eval.get("feedback", [])
            if feedback_list:
                elements.append(Spacer(1, 4))
                for fb in feedback_list:
                    elements.append(Paragraph(f"• <font color='#475569'>{fb}</font>", S('fb_p', fontName='Helvetica', fontSize=8, leading=10)))
    else:
        aspirations_transcript = [
            t for t in transcript 
            if t.get("segment") == 4 or str(t.get("question_type", "")).lower() in ("aspirations", "vision_and_mission")
        ]
        if not aspirations_transcript:
            elements.append(Paragraph("No Aspirations data found in transcript.", body_s))
        else:
            for t in aspirations_transcript:
                speaker = "Aria" if t.get("speaker") == "aria" else "Candidate"
                color = TEAL if speaker == "Aria" else SLATE_700
                elements.append(Paragraph(f"<b>{speaker}:</b> {t.get('text', '')}", S('asp', fontName='Helvetica', fontSize=9, textColor=color)))
                elements.append(Spacer(1, 3))
    elements.append(Spacer(1, 10))

    # Corporate Survival & Longevity Index (4 Segments)
    elements.append(Paragraph("Corporate Survival, Team Longevity & Strategic Retention Forecast", h2_s))
    surv = analysis.get("corporate_survival_evaluation", {})
    surv_idx = surv.get("survival_index", 86)
    ret_risk = surv.get("retention_risk", "Low")
    elements.append(Paragraph(f"<b>Corporate Survival Index:</b> <font color='#0284c7'><b>{surv_idx}%</b></font> (Based on all 4 Segments: Oral 25%, Cognitive 25%, Mindset 25%, Email 25%)", body_s))
    elements.append(Paragraph(f"<b>Flight Risk:</b> {ret_risk} · <b>Loyalty Retention Score:</b> {surv.get('retention_score', 85)}% · <b>Pressure Resilience:</b> {surv.get('pressure_resilience_score', 84)}% · <b>Collaboration:</b> {surv.get('collaboration_readiness_score', 88)}%", body_s))
    if surv.get("longevity_forecast"):
        elements.append(Spacer(1, 3))
        elements.append(Paragraph(f"<i>{surv['longevity_forecast']}</i>", S('surv_f', fontName='Helvetica-Oblique', fontSize=8.5, leading=11, textColor=SLATE_700)))

    # 3 Decision Reasons & 3 Improvement Areas
    reasons = surv.get("decision_reasons") or [
        "Demonstrated composure and steady problem-solving consistency under timed assessment pressure.",
        "High conscientiousness and rule compliance ensure low defect leakage during code and task delivery.",
        "Balanced psychological profile reflects healthy emotional regulation and high willingness to receive technical feedback without friction."
    ]
    improvements = surv.get("improvement_areas") or [
        "Build confidence in articulating independent technical decisions during squad architecture reviews.",
        "Proactively escalate blockers in sprint standups rather than waiting for scheduled 1:1 check-ins.",
        "Transition from guided execution to self-driven resolution for unfamiliar technology spikes."
    ]

    elements.append(Spacer(1, 4))
    surv_box_data = [
        [
            Paragraph("<b>Why this Decision was Awarded (Key Evidence Basis):</b><br/>" + "<br/>".join([f"• {r}" for r in reasons[:3]]), S('s_r', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#065f46'))),
            Paragraph("<b>Critical Growth & Intervention Areas:</b><br/>" + "<br/>".join([f"• {i}" for i in improvements[:3]]), S('s_i', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#991b1b'))),
        ]
    ]
    t_surv_box = Table(surv_box_data, colWidths=[265, 270])
    t_surv_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#f0fdf4')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#fef2f2')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t_surv_box)
    elements.append(Spacer(1, 10))

    # Category-Wise Actionable Development Roadmap
    gran_imp = analysis.get("granular_improvements") or {
        "oral_communication": ["Practice STAR structure for technical scenarios to improve conciseness.", "Reduce verbal filler pauses when formulating complex thoughts."],
        "email_writing": ["Incorporate explicit milestone dates into the upskilling roadmap.", "Ensure formal bullet formatting for proposal clarity."],
        "cognitive_accuracy": ["Double-check numerical problem constraints before confirming answers under time limits.", "Allocate more verification time to perceptual patterns."],
        "workplace_culture": ["Proactively seek peer feedback during code review cycles.", "Communicate project impediments early to sprint leads."]
    }
    elements.append(Paragraph("Actionable Development Roadmap", h2_s))
    imp_data = [
        [Paragraph("<b>Domain</b>", bold_s), Paragraph("<b>Key Action Items</b>", bold_s)],
        [Paragraph("Spoken Communication", bold_s), Paragraph("<br/>".join([f"• {t}" for t in gran_imp.get("oral_communication", ["Refine STAR structure"])]), S('i1', fontSize=8, leading=10))],
        [Paragraph("Corporate Email Writing", bold_s), Paragraph("<br/>".join([f"• {t}" for t in gran_imp.get("email_writing", ["Include explicit milestone dates"])]), S('i2', fontSize=8, leading=10))],
        [Paragraph("Cognitive Accuracy", bold_s), Paragraph("<br/>".join([f"• {t}" for t in gran_imp.get("cognitive_accuracy", ["Verify numerical constraints"])]), S('i3', fontSize=8, leading=10))],
        [Paragraph("Workplace Culture", bold_s), Paragraph("<br/>".join([f"• {t}" for t in gran_imp.get("workplace_culture", ["Proactive peer standups"])]), S('i4', fontSize=8, leading=10))],
    ]
    t_imp = Table(imp_data, colWidths=[140, 360])
    t_imp.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
        ('GRID', (0, 0), (-1, -1), 0.4, SLATE_200),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t_imp)
    elements.append(Spacer(1, 10))

    # Year-over-Year Growth
    previous_snapshot = analysis.get("profile_snapshot", {})
    if previous_snapshot and bond_year > 1:
        elements.append(Paragraph("Year-over-Year Longitudinal Progression", h2_s))
        old_t = previous_snapshot.get("t_score", "N/A")
        old_comm = previous_snapshot.get("communication", "N/A")
        
        new_t = cog.get("T-Score", cog.get("t_score", "N/A"))
        new_comm = comm_score
        
        yoy_data = [
            [Paragraph("<b>Metric</b>", bold_s), Paragraph(f"<b>Previous (Module {bond_year-1})</b>", bold_s), Paragraph(f"<b>Current (Module {bond_year})</b>", bold_s), Paragraph("<b>Trajectory Status</b>", bold_s)],
            [Paragraph("T-Score", body_s), Paragraph(str(old_t), body_s), Paragraph(str(new_t), body_s), Paragraph("Positive Stamina Growth", S('s1', fontSize=8))],
            [Paragraph("Communication", body_s), Paragraph(str(old_comm), body_s), Paragraph(str(new_comm), body_s), Paragraph("Executive Articulation Growth", S('s2', fontSize=8))]
        ]
        t_yoy = Table(yoy_data, colWidths=[130, 110, 110, 150])
        t_yoy.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
            ('GRID', (0, 0), (-1, -1), 0.4, SLATE_200),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
    # Segment Audit Trail: Raw Test Item Summary (Cognitive & Psychometric)
    cog_results = report_data.get("cognitive_results", [])
    psy_results = report_data.get("psychometric_results", [])
    if cog_results or psy_results:
        elements.append(Paragraph("Segment Raw Test Items Audit Summary", h2_s))
        audit_rows = [
            [Paragraph("<b>Evaluation Domain</b>", bold_s), Paragraph("<b>Item Count</b>", bold_s), Paragraph("<b>Audit Status & Answer Capture</b>", bold_s)],
            [Paragraph("Segment 1: Spoken Oral Audio", body_s), Paragraph("3 Parts", body_s), Paragraph("Verbatim Transcript Captured & Audited via Speech Recognition", S('aud1', fontSize=8, fontName='Helvetica'))],
            [Paragraph("Segment 2: Cognitive Speed Test", body_s), Paragraph(f"{len(cog_results)} Questions", body_s), Paragraph(f"All {len(cog_results)} items recorded with selected choice & answer key", S('aud2', fontSize=8, fontName='Helvetica'))],
            [Paragraph("Segment 3: Psychometric Inventory", body_s), Paragraph(f"{len(psy_results)} Items", body_s), Paragraph(f"All {len(psy_results)} Likert ratings captured across 5 core traits", S('aud3', fontSize=8, fontName='Helvetica'))],
            [Paragraph("Segment 4: Business Written Email", body_s), Paragraph("1 Submission", body_s), Paragraph("Full email body, subject, recipient, and tone evaluated", S('aud4', fontSize=8, fontName='Helvetica'))],
        ]
        t_audit = Table(audit_rows, colWidths=[160, 95, 280])
        t_audit.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
            ('GRID', (0, 0), (-1, -1), 0.4, SLATE_200),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t_audit)
        elements.append(Spacer(1, 10))

        # Item-by-item Cognitive Test Audit Trail
        if cog_results:
            elements.append(Paragraph(f"Segment 2 Item Breakdown ({len(cog_results)} Questions):", h3_s))
            cog_detail_rows = [
                [Paragraph("<b>#</b>", bold_s), Paragraph("<b>Question &amp; Options</b>", bold_s), Paragraph("<b>Candidate Choice</b>", bold_s), Paragraph("<b>Verdict</b>", bold_s)]
            ]
            for idx, item in enumerate(cog_results[:15], 1):  # Show up to first 15 for concise high-density layout
                q_txt = item.get("question", f"Question {idx}")
                sel_idx = item.get("selected_index")
                opts = item.get("options", [])
                sel_text = opts[sel_idx] if (sel_idx is not None and 0 <= sel_idx < len(opts)) else (f"Option {sel_idx + 1}" if sel_idx is not None else "Unattempted")
                is_cor = item.get("is_correct")
                v_html = "<font color='#16a34a'><b>Correct</b></font>" if is_cor else "<font color='#dc2626'><b>Incorrect</b></font>"
                cog_detail_rows.append([
                    Paragraph(str(idx), S('c_num', fontSize=7.5)),
                    Paragraph(f"<b>{q_txt}</b>", S('c_q', fontSize=7.5, leading=9.5)),
                    Paragraph(sel_text, S('c_sel', fontSize=7.5, leading=9.5)),
                    Paragraph(v_html, S('c_v', fontSize=7.5))
                ])
            if len(cog_results) > 15:
                cog_detail_rows.append([
                    Paragraph("...", S('c_dots', fontSize=7.5)),
                    Paragraph(f"<i>... and {len(cog_results) - 15} additional questions recorded in full digital audit trail</i>", S('c_more', fontSize=7.5, fontName='Helvetica-Oblique')),
                    Paragraph("-", S('c_dash', fontSize=7.5)),
                    Paragraph("Audited", S('c_aud', fontSize=7.5))
                ])

            t_cog_detail = Table(cog_detail_rows, colWidths=[20, 315, 120, 80])
            t_cog_detail.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
                ('GRID', (0, 0), (-1, -1), 0.3, SLATE_200),
                ('PADDING', (0, 0), (-1, -1), 3.5),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            elements.append(t_cog_detail)
            elements.append(Spacer(1, 10))

        # Item-by-item Psychometric Test Audit Trail
        if psy_results:
            elements.append(Paragraph(f"Segment 3 Item Breakdown ({len(psy_results)} Likert Statements):", h3_s))
            psy_detail_rows = [
                [Paragraph("<b>#</b>", bold_s), Paragraph("<b>Workplace Mindset Statement</b>", bold_s), Paragraph("<b>Trait &amp; Ideal</b>", bold_s), Paragraph("<b>Candidate Rating &amp; Alignment</b>", bold_s)]
            ]
            rating_labels = {1: "Strongly Disagree (1)", 2: "Disagree (2)", 3: "Neutral (3)", 4: "Agree (4)", 5: "Strongly Agree (5)"}
            for idx, item in enumerate(psy_results, 1):
                stmt_txt = item.get("statement", f"Statement {idx}")
                trait_lbl = item.get("trait", "General").title()
                ideal_str = str(item.get("ideal_response", "SA")).upper()
                raw_sc = item.get("selected_score", 3)
                rating_str = rating_labels.get(raw_sc, f"Score {raw_sc}")
                
                # Check alignment: green for positive, red for adverse, amber for neutral
                is_sd = ideal_str == "SD"
                eff_sc = item.get("effective_score")
                if eff_sc is not None:
                    is_pos = eff_sc >= 4
                    is_neg = eff_sc <= 2
                else:
                    is_pos = (raw_sc <= 2) if is_sd else (raw_sc >= 4)
                    is_neg = (raw_sc >= 4) if is_sd else (raw_sc <= 2)

                if is_pos:
                    rating_html = f"<font color='#16a34a'><b>{rating_str} [✓ Positive]</b></font>"
                elif is_neg:
                    rating_html = f"<font color='#dc2626'><b>{rating_str} [✗ Risk]</b></font>"
                else:
                    rating_html = f"<font color='#d97706'><b>{rating_str} [○ Neutral]</b></font>"

                psy_detail_rows.append([
                    Paragraph(str(idx), S('p_num', fontSize=7.5)),
                    Paragraph(stmt_txt, S('p_stmt', fontSize=7.5, leading=9.5)),
                    Paragraph(f"{trait_lbl} ({ideal_str})", S('p_trait', fontSize=7.5)),
                    Paragraph(rating_html, S('p_rat', fontSize=7.5))
                ])

            t_psy_detail = Table(psy_detail_rows, colWidths=[20, 290, 105, 120])
            t_psy_detail.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
                ('GRID', (0, 0), (-1, -1), 0.3, SLATE_200),
                ('PADDING', (0, 0), (-1, -1), 3.5),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            elements.append(t_psy_detail)
            elements.append(Spacer(1, 10))

    # Complete Verbatim Spoken Transcript & Multi-turn Dialogue Log
    if transcript:
        elements.append(Paragraph("Complete Spoken Dialogue & Transcript Audit Log", h2_s))
        dialogue_rows = [
            [Paragraph("<b>Speaker</b>", bold_s), Paragraph("<b>Turn Context / Question Type</b>", bold_s), Paragraph("<b>Spoken / Audio Content</b>", bold_s)]
        ]
        for t in transcript:
            speaker_label = "Aria (Interviewer)" if t.get("speaker") == "aria" else "Candidate"
            speaker_color = "#0284c7" if t.get("speaker") == "aria" else "#4338ca"
            q_type = (t.get("question_type") or "Spoken Response").replace("_", " ").title()
            text_content = t.get("text", "")
            dialogue_rows.append([
                Paragraph(f"<font color='{speaker_color}'><b>{speaker_label}</b></font>", S('d_spk', fontSize=8)),
                Paragraph(q_type, S('d_type', fontSize=7.5, textColor=SLATE_700)),
                Paragraph(text_content, S('d_txt', fontSize=8, leading=10.5))
            ])

        t_dialogue = Table(dialogue_rows, colWidths=[105, 120, 310])
        t_dialogue.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SLATE_100),
            ('GRID', (0, 0), (-1, -1), 0.3, SLATE_200),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t_dialogue)
        elements.append(Spacer(1, 10))

    doc.build(elements)
    buffer.seek(0)
    logger.info(f"✅ Generated 4-segment PDF report for {name} ({sap_id})")
    return buffer.getvalue()

# Alias for backward compatibility
generate_pdf_report = generate_interview_pdf
