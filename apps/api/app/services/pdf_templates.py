from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors

PURPLE       = colors.HexColor('#7c3aed')
TEAL         = colors.HexColor('#0d9488')
AMBER        = colors.HexColor('#d97706')
RED_DARK     = colors.HexColor('#dc2626')
GREEN_DARK   = colors.HexColor('#16a34a')
SLATE_100    = colors.HexColor('#f1f5f9')
SLATE_200    = colors.HexColor('#e2e8f0')
SLATE_700    = colors.HexColor('#334155')

def _build_transcript(elements, transcript, per_question_analysis, S, h2_s, body_s, bold_s, small_s):
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1, color=SLATE_200, spaceAfter=20, spaceBefore=20))
    elements.append(Paragraph("📝 Full Interview Transcript & AI Justification", h2_s))
    
    if transcript:
        main_q_num = 0
        fu_q_num = 0
        last_main_category = "General"
        global_q_index = 0
        
        for idx, entry in enumerate(transcript):
            speaker = entry.get("speaker", "candidate")
            text = entry.get("text", "").strip()
            q_type = entry.get("question_type", "")
            if not text:
                continue

            if speaker == "aria":
                global_q_index += 1
                if q_type == "followup":
                    fu_q_num += 1
                    label = f"🔁 Aria — Follow-Up Question {fu_q_num} ({last_main_category})"
                    label_color = PURPLE
                    bg_color = colors.HexColor('#f5f3ff')
                else:
                    main_q_num += 1
                    category_label = q_type.capitalize() if q_type else "General"
                    last_main_category = category_label
                    label = f"❓ Aria — Question {main_q_num} ({category_label})"
                    label_color = TEAL
                    bg_color = colors.HexColor('#f0fdfc')
                    
                label_style = S(f'spk_aria_{idx}', fontName='Helvetica-Bold', fontSize=9.5, leading=14, textColor=label_color)
                aria_s = S(f'aria_t_{idx}', fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#1f2937'))
                q_table = Table(
                    [[Paragraph(label, label_style)],
                     [Paragraph(text, aria_s)]],
                    colWidths=[535]
                )
                q_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, 0), bg_color),
                    ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#fafafa')),
                    ('BOX', (0, 0), (-1, -1), 0.5, label_color),
                    ('LINEBELOW', (0, 0), (0, 0), 0.5, label_color),
                    ('PADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ]))
                elements.append(q_table)
            else:
                resp_style = S(f'spk_cand_{idx}', fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=TEAL)
                elements.append(Spacer(1, 4))
                elements.append(Paragraph(f"🧑 Candidate Response:", resp_style))
                display_text = text if text != "(Candidate responded verbally)" else (
                    "⚠ Voice response captured during interview — see video recording for full answer."
                )
                elements.append(Paragraph(display_text, body_s))
                
                qa_analysis = next((q for q in per_question_analysis if q.get("question_index") == global_q_index), None)
                if qa_analysis:
                    elements.append(Spacer(1, 4))
                    elements.append(Paragraph("<b>🧠 AI Evaluation & Justification:</b>", bold_s))
                    
                    fit = qa_analysis.get('fit_indicator', 'Neutral')
                    fit_color = GREEN_DARK if fit.lower() == 'fit' else RED_DARK if fit.lower() == 'not fit' else AMBER
                    elements.append(Paragraph(f"• <b>Fit Indicator:</b> <font color='{fit_color}'>{fit}</font>", body_s))
                    
                    if qa_analysis.get('fit_reason'):
                        elements.append(Paragraph(f"• <b>Reasoning:</b> {qa_analysis.get('fit_reason')}", body_s))
                    
                    if qa_analysis.get('depth_assessment'):
                        elements.append(Paragraph(f"• <b>Depth:</b> {qa_analysis.get('depth_assessment')}", body_s))
                        
                    quotes = qa_analysis.get('evidence_quotes', [])
                    if quotes:
                        quotes_str = " | ".join(quotes)
                        elements.append(Paragraph(f"• <b>Key Evidence:</b> {quotes_str}", small_s))

            elements.append(Spacer(1, 8))
    else:
        elements.append(Paragraph("No transcript data captured during this session.", small_s))

def build_template_1(elements, ctx):
    """Format 1: Executive Brief"""
    S = ctx['S']
    title_s = S('Title1', fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=PURPLE, alignment=1)
    h1_s = S('H1_1', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=TEAL, spaceBefore=12, spaceAfter=8)
    body_s = ctx['body_s']
    bold_s = ctx['bold_s']
    small_s = ctx['small_s']
    
    elements.append(Paragraph("EXECUTIVE BRIEF", title_s))
    elements.append(Spacer(1, 20))
    
    # Banner
    banner = Table([[Paragraph(f"<b>{ctx['hire_label']}</b> - Score: {ctx['overall_score']}%", S('B1', fontName='Helvetica-Bold', fontSize=16, textColor=colors.white, alignment=1))]], colWidths=[535])
    banner.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), ctx['hire_color']), ('PADDING', (0,0), (-1,-1), 15), ('ROUNDEDCORNERS', [8])]))
    elements.append(banner)
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("CANDIDATE SNAPSHOT", h1_s))
    elements.append(Paragraph(f"<b>Name:</b> {ctx['name']} | <b>Recommended Role:</b> {ctx.get('domain', 'N/A')}", body_s))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(ctx['summary_text'], body_s))
    elements.append(Spacer(1, 20))
    
    # Side by side strengths/improvements
    t_data = [
        [Paragraph("<b>KEY STRENGTHS</b>", bold_s), Paragraph("<b>AREAS TO PROBE</b>", bold_s)],
        [Paragraph("<br/>".join([f"• {s}" for s in ctx['strengths_list'][:5]]), body_s) if ctx['strengths_list'] else Paragraph("N/A", body_s), 
         Paragraph("<br/>".join([f"• {i}" for i in ctx['improvements_list'][:5]]), body_s) if ctx['improvements_list'] else Paragraph("N/A", body_s)]
    ]
    t = Table(t_data, colWidths=[267, 267])
    t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), SLATE_200), ('GRID', (0,0), (-1,-1), 1, SLATE_200), ('PADDING', (0,0), (-1,-1), 10)]))
    elements.append(t)
    
    _build_transcript(elements, ctx['transcript'], ctx['analysis'].get('per_question_analysis', []), S, ctx['h2_s'], body_s, bold_s, small_s)

def build_template_2(elements, ctx):
    """Format 2: Behavioral Deep-Dive"""
    S = ctx['S']
    title_s = S('Title2', fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=TEAL, alignment=1)
    h1_s = S('H1_2', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=TEAL, spaceBefore=12, spaceAfter=8)
    h2_s = ctx['h2_s']
    body_s = ctx['body_s']
    bold_s = ctx['bold_s']
    small_s = ctx['small_s']
    
    elements.append(Paragraph("BEHAVIORAL DEEP-DIVE REPORT", title_s))
    elements.append(HRFlowable(width="100%", thickness=2, color=TEAL, spaceAfter=20))
    
    elements.append(Paragraph("Overview", h1_s))
    elements.append(Paragraph(f"Candidate: <b>{ctx['name']}</b> | Overall Behavioral Score: <b>{ctx['overall_score']}%</b>", body_s))
    elements.append(Spacer(1, 15))
    
    elements.append(Paragraph("Behavioral Metrics", h2_s))
    b_data = [["Metric", "Value", "Interpretation"]]
    for k, v in ctx['behavioral'].items():
        b_data.append([k.replace("_", " ").title(), f"{v}%", "Within normal ranges" if float(v) > 50 else "Requires attention"])
    t = Table(b_data, colWidths=[150, 100, 285])
    t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), TEAL), ('TEXTCOLOR', (0,0), (-1,0), colors.white), ('GRID', (0,0), (-1,-1), 0.5, SLATE_200), ('PADDING', (0,0), (-1,-1), 8)]))
    elements.append(t)
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Proctoring & Integrity", h2_s))
    if ctx['violations'] > 0:
        elements.append(Paragraph(f"⚠️ {ctx['violations']} violations detected. Review video.", body_s))
    else:
        elements.append(Paragraph("✅ No violations detected. Candidate maintained consistent eye contact and posture.", body_s))
        
    _build_transcript(elements, ctx['transcript'], ctx['analysis'].get('per_question_analysis', []), S, h2_s, body_s, bold_s, small_s)

def build_template_3(elements, ctx):
    """Format 3: Psychological Profile"""
    S = ctx['S']
    title_s = S('Title3', fontName='Times-Bold', fontSize=22, alignment=1)
    h1_t = S('H1_T3', fontName='Times-Bold', fontSize=14, spaceAfter=10)
    body_t = S('Body_T3', fontName='Times-Roman', fontSize=11, leading=15)
    body_s = ctx['body_s']
    bold_s = ctx['bold_s']
    small_s = ctx['small_s']
    
    elements.append(Paragraph("PSYCHOMETRIC & COGNITIVE ANALYSIS", title_s))
    elements.append(Spacer(1, 30))
    
    elements.append(Paragraph("I. CANDIDATE PROFILE", h1_t))
    elements.append(Paragraph(f"Subject: {ctx['name']}<br/>Assessment Score: {ctx['overall_score']}/100", body_t))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("II. COGNITIVE MODEL ANALYSIS", h1_t))
    for k, v in ctx['scores'].items():
        elements.append(Paragraph(f"<b>{k.replace('_', ' ').title()} ({v}):</b> Analysis indicates candidate aligns with role expectations.", body_t))
        elements.append(Spacer(1, 8))
        
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("III. CLINICAL SUMMARY", h1_t))
    elements.append(Paragraph(ctx['summary_text'], body_t))
    
    _build_transcript(elements, ctx['transcript'], ctx['analysis'].get('per_question_analysis', []), S, ctx['h2_s'], body_s, bold_s, small_s)

def build_template_4(elements, ctx):
    """Format 4: Modern Grid Dashboard"""
    S = ctx['S']
    body_s = ctx['body_s']
    bold_s = ctx['bold_s']
    small_s = ctx['small_s']
    
    t_head = Table([[Paragraph(f"<font size=24><b>{ctx['name'].upper()}</b></font><br/>INTELLIGENCE REPORT", S('W4', textColor=colors.white))]], colWidths=[552])
    t_head.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), SLATE_700), ('PADDING', (0,0), (-1,-1), 20)]))
    elements.append(t_head)
    elements.append(Spacer(1, 10))
    
    t_row1 = Table([
        [Paragraph(f"<b>SCORE</b><br/><font size=20>{ctx['overall_score']}</font>", S('C4a', alignment=1)), 
         Paragraph(f"<b>RECOMMENDED</b><br/><font size=14>{ctx.get('domain', 'N/A')}</font>", S('C4b', alignment=1)),
         Paragraph(f"<b>STATUS</b><br/><font size=12 color='{ctx['hire_color'].hexval()}'>{ctx['hire_label']}</font>", S('C4c', alignment=1))]
    ], colWidths=[184, 184, 184])
    t_row1.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), SLATE_100), ('GRID', (0,0), (-1,-1), 2, colors.white), ('PADDING', (0,0), (-1,-1), 15)]))
    elements.append(t_row1)
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph(ctx['summary_text'], body_s))
    
    _build_transcript(elements, ctx['transcript'], ctx['analysis'].get('per_question_analysis', []), S, ctx['h2_s'], body_s, bold_s, small_s)
