/**
 * interviewService.ts
 * Central API service for the interview room.
 * Single source of truth for all fetch / WebSocket calls.
 * Fixes hardcoded localhost: always uses NEXT_PUBLIC_API_URL.
 */

const API = () =>
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

const LAMBDA_API = () =>
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_LAMBDA_API_URL) || "";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  type: "psychometric" | "communication" | "scenario" | "followup" | string;
  text: string;
  order: number;
}

export interface TranscriptEntry {
  speaker: "aria" | "candidate";
  text: string;
  timestamp: string;
  question_type?: string;
  is_final?: boolean;
}

export interface BehavioralSummary {
  eye_contact_avg: number;
  confidence_score: number;
  engagement_score: number;
  nervousness_score: number;
  posture_score: number;
  smile_score: number;
  stress_score: number;
  overall_behavior_score: number;
  violation_count: number;
  violation_log: Array<{ type: string; message: string; timestamp: string; question_number: number }>;
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function fetchMySession(token: string) {
  const res = await fetch(`${API()}/api/interview/session/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`session fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchRandomQuestions(
  count: number = 5,
  bondYear: number = 1,
): Promise<{ questions: Question[] }> {
  const res = await fetch(
    `${API()}/api/hr/questions/random?count=${count}&bond_year=${bondYear}`,
  );
  if (!res.ok) throw new Error(`random questions fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchCandidateProfile(
  token: string,
  params: { name?: string; join_date?: string; bond_year?: string }
) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][]
  ).toString();
  const url = `${API()}/api/auth/me${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`profile fetch failed: ${res.status}`);
  return res.json();
}

export async function submitQuestionResponse(payload: {
  session_id: string;
  question_id: string;
  transcript_text: string;
  video_timestamp_start: number;
  video_timestamp_end: number;
  candidate_name: string;
  token: string;
}) {
  const { token, ...body } = payload;
  await fetch(`${API()}/api/interview/response/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── TTS ───────────────────────────────────────────────────────────────────────

export async function fetchTTSAudio(text: string, signal?: AbortSignal): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${API()}/api/tts/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (res.ok) return res.arrayBuffer();
  } catch {
    // network / abort errors
  }
  return null;
}

// ── Upload artifacts ─────────────────────────────────────────────────────────

export async function uploadRecording(payload: {
  videoBlob: Blob;
  candidateEmail: string;
  candidateName: string;
  sessionId: string;
  interviewedAt: string;
  mimeType: string;
}) {
  const form = new FormData();
  form.append("file", payload.videoBlob, `interview_${payload.sessionId}.webm`);
  form.append("candidate_email", payload.candidateEmail);
  form.append("candidate_name", payload.candidateName);
  form.append("session_id", payload.sessionId);
  form.append("interviewed_at", payload.interviewedAt);

  const res = await fetch(`${API()}/api/interview/upload-recording`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return res.json();
}

export async function getLambdaPresignedUrl(payload: {
  candidateEmail: string;
  candidateName: string;
  sessionId: string;
}) {
  const lambdaUrl = LAMBDA_API();
  if (!lambdaUrl) return null;
  const res = await fetch(`${lambdaUrl}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidate_email: payload.candidateEmail,
      candidate_name: payload.candidateName,
      session_id: payload.sessionId,
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function putToPresignedUrl(presignedUrl: string, blob: Blob) {
  return fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/webm" },
    body: blob,
  });
}

export async function analyzeInterview(
  sessionId: string,
  payload: {
    candidate_name: string;
    candidate_email: string;
    interviewed_at: string;
    s3_video_url: string;
    transcript: TranscriptEntry[];
    behavioral_summary: BehavioralSummary;
  }
) {
  const res = await fetch(`${API()}/api/reports/${sessionId}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, ...payload }),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return res.json();
}

export async function generatePDFReport(
  sessionId: string,
  payload: Record<string, unknown>
) {
  const res = await fetch(`${API()}/api/reports/${sessionId}/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`pdf failed: ${res.status}`);
  return res.json();
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export function buildTranscribeWsUrl(sessionId: string) {
  return (API())
    .replace(/^http/, "ws")
    .replace(/^https/, "wss") + `/ws/transcribe/${sessionId}`;
}
