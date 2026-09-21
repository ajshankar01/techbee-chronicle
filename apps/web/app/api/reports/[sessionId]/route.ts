/**
 * /api/reports/[sessionId] — Next.js proxy route
 *
 * The AnalysisModal in /hr/reports/page.tsx calls this route.
 * We proxy to the FastAPI /api/analysis/{session_id} endpoint and
 * wrap the response in the { report, analysis } shape the modal expects.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(
  'localhost',
  '127.0.0.1'
);

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  const authHeader =
    req.headers.get('Authorization') || req.headers.get('authorization') || '';

  try {
    const res = await fetch(`${FASTAPI}/api/analysis/${sessionId}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
      cache: 'no-store',
    });

    if (res.status === 404) {
      return NextResponse.json(
        { error: 'Analysis not ready yet. Complete the interview first.' },
        { status: 404 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }

    const raw = await res.json();

    /**
     * FastAPI returns:
     *   { session_id, overall_score, scores, mindset_label, attitude_label,
     *     domain_recommendation, secondary_domain, summary_text,
     *     strengths, areas_of_improvement, red_flags, behavioral_summary }
     *
     * AnalysisModal expects:
     *   {
     *     report: { overall_score, domain_recommendation, is_flagged },
     *     analysis: { scores, overall_score, mindset_label, attitude_label,
     *                 summary_text, domain_recommendation, secondary_domain,
     *                 strengths, areas_of_improvement, red_flags,
     *                 per_question_analysis, transcript_keyword_map,
     *                 fit_verdict, fit_verdict_reason, executive_summary,
     *                 hr_action_plan, candidate_archetype, archetype_description,
     *                 retention_risk, evasion_score, tone_map }
     *   }
     */
    const mapped = {
      report: {
        overall_score: raw.overall_score ?? 0,
        domain_recommendation: raw.domain_recommendation ?? 'N/A',
        is_flagged: (raw.red_flags?.length ?? 0) > 0,
      },
      analysis: {
        scores: raw.scores ?? {},
        overall_score: raw.overall_score ?? 0,
        mindset_label: raw.mindset_label ?? '',
        attitude_label: raw.attitude_label ?? '',
        summary_text: raw.summary_text ?? '',
        domain_recommendation: raw.domain_recommendation ?? '',
        secondary_domain: raw.secondary_domain ?? '',
        strengths: raw.strengths ?? [],
        areas_of_improvement: raw.areas_of_improvement ?? [],
        red_flags: raw.red_flags ?? [],
        // Extended fields — populated from per_question_analysis_json if present
        per_question_analysis: raw.per_question_analysis ?? [],
        transcript_keyword_map: raw.transcript_keyword_map ?? {
          technical_keywords: [],
          soft_skill_keywords: [],
          domain_signals: [],
          positive_indicators: [],
          concern_indicators: [],
        },
        fit_verdict: raw.fit_verdict ?? 'Conditionally Recommended',
        fit_verdict_reason: raw.fit_verdict_reason ?? '',
        executive_summary: raw.executive_summary ?? raw.summary_text ?? '',
        hr_action_plan: raw.hr_action_plan ?? [],
        candidate_archetype: raw.candidate_archetype ?? '',
        archetype_description: raw.archetype_description ?? '',
        retention_risk: raw.retention_risk ?? 'Low',
        evasion_score: raw.evasion_score ?? 0,
        tone_map: raw.tone_map ?? [],
      },
    };

    return NextResponse.json(mapped);
  } catch (err) {
    console.error('[/api/reports] proxy error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
