/**
 * useInterviewSession.ts
 * Manages: loading candidate session + questions, submitting per-question
 * responses, and orchestrating the full artifact upload pipeline
 * (video → S3, Gemini analysis, PDF report).
 */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Question,
  TranscriptEntry,
  BehavioralSummary,
  fetchMySession,
  fetchCandidateProfile,
  fetchRandomQuestions,
  submitQuestionResponse,
  uploadRecording,
  getLambdaPresignedUrl,
  putToPresignedUrl,
  analyzeInterview,
  generatePDFReport,
} from "../services/interviewService";

export type UploadStatus = "idle" | "video" | "analysis" | "pdf" | "done" | "error";

const DEFAULT_QUESTION: Question = {
  id: "q1",
  type: "psychometric",
  text: "Welcome! Tell me about a time when you had to adapt quickly to a major change. How did you manage your mindset and what was the outcome?",
  order: 1,
};

function buildFallbackQuestion(firstName: string, bondYear: number): Question {
  let text = "";
  if (bondYear === 1) {
    text = `Welcome to Techbee Chronicle, ${firstName}. To begin, could you tell me about yourself, what you have been working on recently, and what you hope to achieve during your career in our organisation?`;
  } else if (bondYear === 2) {
    text = `Welcome to Techbee Chronicle, ${firstName}. Looking back at our conversation from last year, walk me through your progress on your goals over the last 12 months, and what challenges you faced.`;
  } else {
    text = `Welcome to Techbee Chronicle, ${firstName}. Walk me through a complex architectural challenge you successfully scaled, and how you demonstrated technical leadership.`;
  }
  return { id: "q1", type: "psychometric", text, order: 1 };
}

export interface UseInterviewSessionReturn {
  // Candidate identity
  candidateName: string;
  candidateEmail: string;
  candidateSapId: string;
  candidateBondYear: number;
  sessionId: string;
  // Questions
  questions: Question[];
  // Upload
  uploadStatus: UploadStatus;
  uploadErrorMsg: string | null;
  // Media recorder refs (set by parent)
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>;
  recordedChunksRef: React.MutableRefObject<Blob[]>;
  // Actions
  submitResponse: (payload: {
    sessionId: string;
    questionId: string;
    transcriptText: string;
    videoTimestampEnd: number;
    token: string;
  }) => Promise<void>;
  uploadInterviewArtifacts: (
    fullTranscript: TranscriptEntry[],
    behavioral: BehavioralSummary
  ) => Promise<void>;
  stopRecorderAndGetBlob: () => Promise<Blob | null>;
}

export function useInterviewSession(): UseInterviewSessionReturn {
  const [candidateName, setCandidateName] = useState("Candidate");
  const [candidateEmail, setCandidateEmail] = useState("fresher@techbee.in");
  const [candidateSapId, setCandidateSapId] = useState("");
  const [candidateBondYear, setCandidateBondYear] = useState(1);
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([DEFAULT_QUESTION]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // ── Load session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get("session");
    const urlToken = params.get("token");

    // Hydrate candidate identity from sessionStorage
    const name = sessionStorage.getItem("candidate_display_name") ||
      sessionStorage.getItem("candidate_name") || "Fresher Candidate";
    const email = sessionStorage.getItem("candidate_email") || "fresher@techbee.in";
    const sap = sessionStorage.getItem("candidate_sap_id") || "";
    const bondYearStr = sessionStorage.getItem("candidate_bond_year");

    setCandidateName(name);
    setCandidateEmail(email);
    setCandidateSapId(sap);
    if (bondYearStr) setCandidateBondYear(parseInt(bondYearStr));

    // Fix: Use the URL token if present, otherwise fallback to sessionStorage or dev-token
    const token = urlToken || sessionStorage.getItem("teams_token") || "dev-token";

    const load = async () => {
      let loaded: Question[] = [];

      // 1. Try scheduled session from DB
      try {
        const data = await fetchMySession(token);
        // Fix: Use URL session ID if provided, otherwise the one from API
        setSessionId(urlSessionId || (data.session_id ?? ""));

        const bondYear = data.bond_year || data.current_bond_year;
        if (bondYear) setCandidateBondYear(bondYear);

        if (data.candidate_name) {
          setCandidateName(data.candidate_name);
          sessionStorage.setItem("candidate_name", data.candidate_name);
          sessionStorage.setItem("candidate_display_name", data.candidate_name);
        }

        if (data.questions?.length > 0) {
          const actualName = data.candidate_name || name;
          const firstName = actualName.split(" ")[0] || "Candidate";
          loaded = data.questions.map((q: any) => ({
            id: q.id,
            type: q.type,
            text: (q.text || "")
              .replace(/\bthe candidate\b/gi, firstName)
              .replace(/\bcandidate\b/gi, firstName),
            order: q.order || 1,
          }));
        }
      } catch {
        console.warn("⚠️ Failed to load scheduled session — trying profile fallback");
      }

      // 2. Fallback: load profile + fetch random questions from question bank
      if (loaded.length === 0) {
        try {
          const savedName = sessionStorage.getItem("candidate_name") || "";
          const savedDoj = sessionStorage.getItem("candidate_doj") || "";
          const savedBondYear = sessionStorage.getItem("candidate_bond_year") || "";
          const profile = await fetchCandidateProfile(token, {
            name: savedName,
            join_date: savedDoj,
            bond_year: savedBondYear,
          });

          if (profile.name) {
            setCandidateName(profile.name);
            sessionStorage.setItem("candidate_name", profile.name);
            sessionStorage.setItem("candidate_display_name", profile.name);
          }
          const bYear = savedBondYear
            ? parseInt(savedBondYear, 10)
            : (profile.current_bond_year || 1);
          setCandidateBondYear(bYear);
          sessionStorage.setItem("candidate_bond_year", String(bYear));
          const firstName = (profile.name || savedName || "Candidate").split(" ")[0];

          // Try fetching random questions from the question bank
          try {
            const randomData = await fetchRandomQuestions(5, bYear);
            if (randomData.questions && randomData.questions.length > 0) {
              loaded = randomData.questions.map((q: any) => ({
                id: q.id,
                type: q.type,
                text: (q.text || "")
                  .replace(/\bthe candidate\b/gi, firstName)
                  .replace(/\bcandidate\b/gi, firstName),
                order: q.order || 1,
              }));
              console.log(`✅ Loaded ${loaded.length} random questions from question bank`);
            }
          } catch {
            console.warn("⚠️ Random questions API unavailable — using single fallback");
          }

          // If random questions also failed, use the single fallback
          if (loaded.length === 0) {
            loaded = [buildFallbackQuestion(firstName, bYear)];
          }
        } catch {
          console.warn("⚠️ Profile fetch failed — trying random questions directly");
          const ssBy = sessionStorage.getItem("candidate_bond_year");
          const bYear = ssBy ? parseInt(ssBy, 10) : 1;
          if (ssBy) setCandidateBondYear(bYear);

          // Last resort: try random questions even without profile
          try {
            const randomData = await fetchRandomQuestions(5, bYear);
            if (randomData.questions && randomData.questions.length > 0) {
              loaded = randomData.questions.map((q: any) => ({
                id: q.id,
                type: q.type,
                text: q.text || "",
                order: q.order || 1,
              }));
            }
          } catch {
            console.warn("⚠️ All fallbacks failed — using default question");
          }

          if (loaded.length === 0) {
            loaded = [DEFAULT_QUESTION];
          }
        }
      }

      setQuestions(loaded);
    };

    load();
  }, []);

  // ── Submit per-question response ──────────────────────────────────────────
  const submitResponse = useCallback(async (payload: {
    sessionId: string;
    questionId: string;
    transcriptText: string;
    videoTimestampEnd: number;
    token: string;
  }) => {
    try {
      await submitQuestionResponse({
        session_id: payload.sessionId,
        question_id: payload.questionId,
        transcript_text: payload.transcriptText,
        video_timestamp_start: 0,
        video_timestamp_end: payload.videoTimestampEnd,
        candidate_name: candidateName,
        token: payload.token,
      });
    } catch (e) {
      console.error("FastAPI submit error:", e);
    }
  }, [candidateName]);

  // ── Stop recorder + collect blob ──────────────────────────────────────────
  const stopRecorderAndGetBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: "video/webm" })
            : null
        );
        return;
      }
      recorder.onstop = () => {
        resolve(
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: "video/webm" })
            : null
        );
      };
      try { recorder.stop(); } catch {
        resolve(
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: "video/webm" })
            : null
        );
      }
    });
  }, []);

  // ── Upload pipeline: video → analysis → PDF ───────────────────────────────
  const uploadInterviewArtifacts = useCallback(async (
    fullTranscript: TranscriptEntry[],
    behavioral: BehavioralSummary
  ) => {
    const activeSessionId = sessionId || `sess_${Date.now()}`;
    const interviewedAt = new Date().toISOString();
    let s3VideoUrl = "";

    // STEP 1: Upload video
    setUploadStatus("video");
    const videoBlob = await stopRecorderAndGetBlob();

    if (videoBlob) {
      let uploadSuccess = false;

      // Primary: FastAPI upload
      try {
        const result = await uploadRecording({
          videoBlob,
          candidateEmail,
          candidateName,
          sessionId: activeSessionId,
          interviewedAt,
          mimeType: "video/webm",
        });
        s3VideoUrl = result.s3_url || result.url || "";
        uploadSuccess = true;
      } catch (err) {
        console.warn("⚠️ FastAPI upload failed:", err);
      }

      // Fallback: Lambda presigned URL
      if (!uploadSuccess) {
        try {
          const lambdaData = await getLambdaPresignedUrl({
            candidateEmail,
            candidateName,
            sessionId: activeSessionId,
          });
          if (lambdaData?.uploadUrl) {
            const putRes = await putToPresignedUrl(lambdaData.uploadUrl, videoBlob);
            if (putRes.ok) {
              s3VideoUrl = lambdaData.s3_url || "";
            }
          }
        } catch (lambdaErr) {
          console.warn("⚠️ Lambda upload also failed:", lambdaErr);
        }
      }
    }

    // STEP 2: Gemini analysis
    setUploadStatus("analysis");
    try {
      const result = await analyzeInterview(activeSessionId, {
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        interviewed_at: interviewedAt,
        s3_video_url: s3VideoUrl,
        transcript: fullTranscript,
        behavioral_summary: behavioral,
      });
      localStorage.setItem("latest_interview_analysis", JSON.stringify(result));
    } catch (err) {
      console.warn("⚠️ Gemini analysis failed (non-critical):", err);
    }

    // STEP 3: PDF report
    setUploadStatus("pdf");
    try {
      await generatePDFReport(activeSessionId, {
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        candidate_sap_id: candidateSapId,
        bond_year: candidateBondYear,
        interviewed_at: interviewedAt,
        s3_video_url: s3VideoUrl,
        transcript: fullTranscript,
        behavioral_summary: behavioral,
      });
    } catch (err) {
      console.warn("⚠️ PDF generation failed (non-critical):", err);
      setUploadErrorMsg("PDF generation encountered an issue.");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("done");
  }, [sessionId, candidateName, candidateEmail, candidateSapId, candidateBondYear, stopRecorderAndGetBlob]);

  return {
    candidateName,
    candidateEmail,
    candidateSapId,
    candidateBondYear,
    sessionId,
    questions,
    uploadStatus,
    uploadErrorMsg,
    mediaRecorderRef,
    recordedChunksRef,
    submitResponse,
    uploadInterviewArtifacts,
    stopRecorderAndGetBlob,
  };
}
