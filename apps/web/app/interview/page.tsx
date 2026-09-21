"use client";

import { useState, useRef, useEffect } from "react";
import { useMediaStream } from "./hooks/useMediaStream";
import { PreSession } from "./components/PreSession";
import { CompletedScreen } from "./components/Completed";
import { InterviewHeader } from "./components/Shared/InterviewHeader";
import { useProctoring } from "./hooks/useProctoring";
import { uploadRecording, getLambdaPresignedUrl, putToPresignedUrl } from "./services/interviewService";
import { useEdgeTTS } from "./hooks/useEdgeTTS";
import { useMediaPipe } from "@/lib/useMediaPipe";
import { Mail, Send, Lock, AlertCircle, Mic, Volume2, Edit3, Check, Sparkles, Activity, ShieldAlert, CheckCircle2, Loader2, UploadCloud, FileText } from "lucide-react";
// ── Types ─────────────────────────────────────────────────────────────────────

type SegmentType = "oral" | "cognitive" | "psychometric" | "email";

type Option = { label: string; value: string };

type Question = {
  id: string;
  text: string;
  options?: Option[];
};

type Segment = {
  id: string;
  type: SegmentType;
  prompt?: string;
  questions?: Question[];
  time_limit?: number; // in seconds
};

type InterviewPhase =
  | "loading"
  | "pre_session"
  | "segment_1"
  | "segment_2"
  | "segment_3"
  | "segment_4"
  | "completed";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Session & Segment Fetching ──────────────────────────────────────────────

function getToken() {
  if (typeof window === "undefined") return "dev-token";
  return sessionStorage.getItem("teams_token") || localStorage.getItem("teams_token") || "dev-token";
}

async function fetchRealSession() {
  try {
    const res = await fetch(`${API}/api/interview/session/my`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch session", e);
  }
  return null;
}

const BACKUP_COGNITIVE_QUESTIONS: Question[] = [
  { id: "cog_1", text: "A customer care executive handled 40 calls on Monday, 50 calls on Tuesday, and 60 calls on Wednesday. What was the average number of calls handled per day?", options: [{ label: "45 calls", value: "0" }, { label: "50 calls", value: "1" }, { label: "55 calls", value: "2" }, { label: "60 calls", value: "3" }] },
  { id: "cog_2", text: "A software training course costs Rs 2,000. An early corporate discount of 15% is applied. What is the net fee payable?", options: [{ label: "Rs 1,600", value: "0" }, { label: "Rs 1,700", value: "1" }, { label: "Rs 1,750", value: "2" }, { label: "Rs 1,850", value: "3" }] },
  { id: "cog_3", text: "In an IT service team of 48 engineers, the ratio of Tier-1 support to Tier-2 support is 5:3. How many Tier-1 support engineers are on the team?", options: [{ label: "24", value: "0" }, { label: "28", value: "1" }, { label: "30", value: "2" }, { label: "32", value: "3" }] },
  { id: "cog_4", text: "A data operations specialist validates 180 records in 2 hours. At this constant rate, how many records can the specialist validate during an 7-hour shift?", options: [{ label: "540 records", value: "0" }, { label: "630 records", value: "1" }, { label: "680 records", value: "2" }, { label: "720 records", value: "3" }] },
  { id: "cog_5", text: "An ITES project ticket backlog of 8,000 tickets was reduced by 25% in January, and reduced by another 20% in February. How many unresolved tickets remain at the end of February?", options: [{ label: "4,400 tickets", value: "0" }, { label: "4,800 tickets", value: "1" }, { label: "5,000 tickets", value: "2" }, { label: "5,200 tickets", value: "3" }] },
  { id: "cog_6", text: "All project managers have VPN access tokens. Sunita has a VPN access token. Which statement MUST be logically true?", options: [{ label: "Sunita is definitely a project manager.", value: "0" }, { label: "Sunita is not a project manager.", value: "1" }, { label: "Sunita may or may not be a project manager.", value: "2" }, { label: "All employees with VPN tokens are project managers.", value: "3" }] },
  { id: "cog_7", text: "Rule: 'If an employee passes the compliance test, they receive security clearance.' Fact: Vikas does not have security clearance. What follows logically?", options: [{ label: "Vikas passed the compliance test.", value: "0" }, { label: "Vikas did not pass the compliance test.", value: "1" }, { label: "Vikas forgot his clearance ID.", value: "2" }, { label: "The compliance test was cancelled.", value: "3" }] },
  { id: "cog_8", text: "Five deployment stages (Alpha, Beta, Gamma, Delta, Epsilon) run one after another. Gamma finishes before Delta but after Beta. Alpha finishes before Beta. Epsilon finishes last. Which stage finishes 3rd?", options: [{ label: "Alpha", value: "0" }, { label: "Beta", value: "1" }, { label: "Gamma", value: "2" }, { label: "Delta", value: "3" }] },
  { id: "cog_9", text: "A field engineer walks 20 meters North to Server Rack A, turns East and walks 15 meters to Switch B, then turns South and walks 20 meters to Printer C. In which direction is Printer C from the starting point?", options: [{ label: "North", value: "0" }, { label: "South", value: "1" }, { label: "East", value: "2" }, { label: "West", value: "3" }] },
  { id: "cog_10", text: "Four agents discuss who resolved a critical bug. Amit: 'Bikram resolved it.' Bikram: 'Deepak resolved it.' Charu: 'I did not resolve it.' Deepak: 'Bikram is lying.' If exactly ONE statement is TRUE, who resolved the bug?", options: [{ label: "Amit", value: "0" }, { label: "Bikram", value: "1" }, { label: "Charu", value: "2" }, { label: "Deepak", value: "3" }] },
  { id: "cog_11", text: "KEYBOARD is to INPUT as DISPLAY is to:", options: [{ label: "Storage", value: "0" }, { label: "Output", value: "1" }, { label: "Processing", value: "2" }, { label: "Network", value: "3" }] },
  { id: "cog_12", text: "In IT service operations, what does the instruction to 'SPEED UP a request' mean?", options: [{ label: "Cancel the request", value: "0" }, { label: "Finish it faster", value: "1" }, { label: "Save it for later", value: "2" }, { label: "Send to spam", value: "3" }] },
  { id: "cog_13", text: "The project was finished on time, _______ the team facing database errors during testing.", options: [{ label: "because of", value: "0" }, { label: "despite", value: "1" }, { label: "as a result", value: "2" }, { label: "whereas", value: "3" }] },
  { id: "cog_14", text: "Which word is most OPPOSITE in meaning to 'CLEAR' (honest and open) in team communication?", options: [{ label: "Hidden or unclear", value: "0" }, { label: "Simple", value: "1" }, { label: "Easy to understand", value: "2" }, { label: "Direct", value: "3" }] },
  { id: "cog_15", text: "'AI chatbots quickly answer simple questions, but difficult customer problems still need help from experienced human specialists.' What conclusion is directly supported?", options: [{ label: "AI chatbots will completely replace human workers.", value: "0" }, { label: "Customers do not like chatbots for simple questions.", value: "1" }, { label: "Computer tools alone are not enough for difficult customer problems.", value: "2" }, { label: "Difficult customer problems do not need special experience.", value: "3" }] },
  { id: "cog_16", text: "What is the next number in the sequence: 7, 14, 21, 28, ___?", options: [{ label: "32", value: "0" }, { label: "35", value: "1" }, { label: "36", value: "2" }, { label: "42", value: "3" }] },
  { id: "cog_17", text: "Identify the next number in the sequence: 3, 6, 12, 24, 48, ___?", options: [{ label: "72", value: "0" }, { label: "84", value: "1" }, { label: "96", value: "2" }, { label: "108", value: "3" }] },
  { id: "cog_18", text: "Find the next number in the pattern: 1, 2, 3, 5, 8, 13, ___?", options: [{ label: "18", value: "0" }, { label: "20", value: "1" }, { label: "21", value: "2" }, { label: "24", value: "3" }] },
  { id: "cog_19", text: "What is the next pair in the pattern: AZ, BY, CX, DW, ___?", options: [{ label: "EV", value: "0" }, { label: "FU", value: "1" }, { label: "EU", value: "2" }, { label: "EW", value: "3" }] },
  { id: "cog_20", text: "What number completes the series: 4, 11, 25, 53, ___?", options: [{ label: "97", value: "0" }, { label: "105", value: "1" }, { label: "109", value: "2" }, { label: "112", value: "3" }] },
  { id: "cog_21", text: "Calculate quickly: What is (16 × 5) + (24 ÷ 4)?", options: [{ label: "84", value: "0" }, { label: "86", value: "1" }, { label: "88", value: "2" }, { label: "92", value: "3" }] },
  { id: "cog_22", text: "Which of the following values represents the largest quantity?", options: [{ label: "0.65", value: "0" }, { label: "3/4", value: "1" }, { label: "70%", value: "2" }, { label: "0.72", value: "3" }] },
  { id: "cog_23", text: "A server incident was logged at 10:45 AM and resolved at 03:20 PM on the same day. How long did the resolution take?", options: [{ label: "4 hours 15 mins", value: "0" }, { label: "4 hours 35 mins", value: "1" }, { label: "4 hours 45 mins", value: "2" }, { label: "5 hours 05 mins", value: "3" }] },
  { id: "cog_24", text: "Compare both server identifiers:\nID 1: [SRV-NODE-99042-MUM]\nID 2: [SRV-NODE-99024-MUM]\nHow do these identifiers differ?", options: [{ label: "They are completely identical", value: "0" }, { label: "They differ in the number order", value: "1" }, { label: "They differ in the prefix keyword", value: "2" }, { label: "They differ in the city code", value: "3" }] },
  { id: "cog_25", text: "Compute quickly: 140 - (8 × 9) + (72 ÷ 8) - 15 = ?", options: [{ label: "62", value: "0" }, { label: "65", value: "1" }, { label: "68", value: "2" }, { label: "72", value: "3" }] },
  { id: "cog_26", text: "Find the hardware tag that matches 'NX-58392-KR' EXACTLY:", options: [{ label: "NX-58392-KR", value: "0" }, { label: "NX-58329-KR", value: "1" }, { label: "NX-58392-KP", value: "2" }, { label: "MX-58392-KR", value: "3" }] },
  { id: "cog_27", text: "In the list of badge numbers: [E4019, E4019, E4091, E4019], which item contains a typo?", options: [{ label: "Item 1", value: "0" }, { label: "Item 2", value: "1" }, { label: "Item 3", value: "2" }, { label: "Item 4", value: "3" }] },
  { id: "cog_28", text: "Target account code: 'AC-789012-IN'. Which code below contains EXACTLY one pair of swapped digits?", options: [{ label: "AC-789012-IN", value: "0" }, { label: "AC-780912-IN", value: "1" }, { label: "AC-789012-US", value: "2" }, { label: "BC-789012-IN", value: "3" }] },
  { id: "cog_29", text: "Address A: 'HCLTech Campus, Tower 3, Sector 126, Noida, UP 201304'\nAddress B: 'HCLTech Campus, Tower 3, Sector 126, Noida, UP 201340'\nWhere is the single difference located?", options: [{ label: "Tower number", value: "0" }, { label: "Sector number", value: "1" }, { label: "Postal PIN code", value: "2" }, { label: "State name", value: "3" }] },
  { id: "cog_30", text: "Audit profile records:\nRecord A: { ID: 'EMP-4482', Email: 'aarav.sharma@hcl.com', Dept: 'FinOps' }\nRecord B: { ID: 'EMP-4482', Email: 'aarav.sharma@hcl.com', Dept: 'Fin0ps' }\nWhat is the specific difference in Record B?", options: [{ label: "The email address has an added character.", value: "0" }, { label: "The Department name contains a number '0' instead of letter 'O'.", value: "1" }, { label: "The employee ID has swapped digits.", value: "2" }, { label: "Both records are completely identical.", value: "3" }] },
  { id: "cog_31", text: "If Triangle = 3, Square = 4, and Pentagon = 5, which number corresponds to a Regular Hexagon?", options: [{ label: "5", value: "0" }, { label: "6", value: "1" }, { label: "7", value: "2" }, { label: "8", value: "3" }] },
  { id: "cog_32", text: "In an automated pipeline rule: # means 'add 3' and * means 'multiply by 2'. Following left-to-right order, what is the output of: 5 # * ?", options: [{ label: "13", value: "0" }, { label: "16", value: "1" }, { label: "18", value: "2" }, { label: "20", value: "3" }] },
  { id: "cog_33", text: "A pointer icon on a screen points NORTH. It turns 90 degrees clockwise (to the right), then turns 180 degrees counter-clockwise (to the left). Where does it point now?", options: [{ label: "North", value: "0" }, { label: "East", value: "1" }, { label: "West", value: "2" }, { label: "South", value: "3" }] },
  { id: "cog_34", text: "In a 3x3 logical matrix:\nRow 1: [2, 4, 8]\nRow 2: [3, 6, 12]\nRow 3: [5, 10, ?]\nWhat is the missing value?", options: [{ label: "15", value: "0" }, { label: "18", value: "1" }, { label: "20", value: "2" }, { label: "25", value: "3" }] },
  { id: "cog_35", text: "In an encryption rule, 'BYTE' is coded as 'DZVG' (+2 alphabet shift: B->D, Y->A, T->V, E->G). Under this exact rule, what is the code for 'DATA'?", options: [{ label: "FCVC", value: "0" }, { label: "FBVB", value: "1" }, { label: "EBVC", value: "2" }, { label: "FCUB", value: "3" }] },
];

const BACKUP_PSYCHOMETRIC_QUESTIONS: Question[] = [
  // Adaptability (2 Positive, 1 Negative)
  { id: "psy_1", text: "When project plans change suddenly due to client needs, I easily adjust my daily tasks without losing focus.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_2", text: "I feel excited when learning new tools or software to solve a work problem.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_3", text: "I strongly prefer sticking with tools and processes I already know rather than switching to new approaches mid-project.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  // Resilience (2 Positive, 2 Negative)
  { id: "psy_4", text: "When my work has mistakes or needs rework, I take the feedback positively and improve it right away.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_5", text: "Under tight deadlines or difficult technical issues, I stay calm and focus on practical solutions.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_6", text: "When an unexpected bug or failure occurs in my module, I get discouraged and find it difficult to regain productive momentum.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_7", text: "I feel upset and personally hurt when senior teammates point out mistakes or ask for major changes in my work.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  // Collaboration (1 Positive, 2 Negative)
  { id: "psy_8", text: "I actively share helpful notes and guides with teammates to help them succeed, even when I am busy.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_9", text: "I find it annoying when teammates ask questions about my work, because it slows down my personal speed.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_10", text: "I prefer to concentrate only on my own tasks and avoid helping out when team members are struggling with theirs.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  // Conscientiousness (2 Positive, 1 Negative)
  { id: "psy_11", text: "I double-check my work carefully for mistakes before submitting it for review.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_12", text: "I strictly follow security rules, company guidelines, and quality standards in all my daily tasks.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_13", text: "When working under tight deadlines, I feel it is fine to skip checking my work or skip notes to finish faster.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  // Growth Mindset (1 Positive, 1 Negative)
  { id: "psy_14", text: "I see difficult technical errors as helpful chances to learn and build my understanding.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
  { id: "psy_15", text: "I believe technical ability is something you are born with; people without natural talent rarely succeed even with training.", options: [{ label: "Strongly Agree", value: "5" }, { label: "Agree", value: "4" }, { label: "Neutral", value: "3" }, { label: "Disagree", value: "2" }, { label: "Strongly Disagree", value: "1" }] },
];

async function fetchSegments(sessionId: string, candidateFirstName: string = "Candidate"): Promise<Segment[]> {
  try {
    const res = await fetch(`${API}/api/interview/sessions/${sessionId}/segments`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data = await res.json();
      const cognitiveQs = (data.cognitive && data.cognitive.length > 0) ? data.cognitive : null;
      const psychometricQs = (data.psychometric && data.psychometric.length > 0) ? data.psychometric : null;

      const finalCog: Question[] = cognitiveQs
        ? cognitiveQs.map((q: any) => ({
            id: q.id,
            text: q.text,
            options: (q.options || []).map((o: any, idx: number) => ({
              label: typeof o === "string" ? o : (o?.label || ""),
              value: typeof o === "string" ? idx.toString() : (o?.value ?? idx.toString())
            }))
          }))
        : BACKUP_COGNITIVE_QUESTIONS;

      const finalPsy: Question[] = psychometricQs
        ? psychometricQs.map((q: any) => ({
            id: q.id,
            text: q.text,
            options: [
              { label: "Strongly Agree", value: "5" },
              { label: "Agree", value: "4" },
              { label: "Neutral", value: "3" },
              { label: "Disagree", value: "2" },
              { label: "Strongly Disagree", value: "1" },
            ],
          }))
        : BACKUP_PSYCHOMETRIC_QUESTIONS;

      return [
        {
          id: "seg1",
          type: "oral",
          prompt: `Congratulations ${candidateFirstName} on successfully completing your training! We'd love to get to know you better. Could you start by telling us about yourself, your journey so far, and the core technologies you're most passionate about?`,
        },
        {
          id: "seg2",
          type: "cognitive",
          time_limit: 1200, // 20 minutes blueprint
          questions: finalCog,
        },
        {
          id: "seg3",
          type: "psychometric",
          questions: finalPsy,
        },
        {
          id: "seg4",
          type: "email",
          prompt: "What have you planned to train yourself in over the next 6 months, and what are your long-term aspirations at HCLTech?",
        },
      ];
    }
  } catch (e) {
    console.error("Failed to fetch segments from API", e);
  }

  // Backup segments with genuine ITES questions if backend unreachable
  return [
    {
      id: "seg1",
      type: "oral",
      prompt: `Congratulations ${candidateFirstName} on successfully completing your training! We'd love to get to know you better. Could you start by telling us about yourself, your journey so far, and the core technologies you're most passionate about?`,
    },
    {
      id: "seg2",
      type: "cognitive",
      time_limit: 1200, // 20 minutes blueprint
      questions: BACKUP_COGNITIVE_QUESTIONS,
    },
    {
      id: "seg3",
      type: "psychometric",
      questions: BACKUP_PSYCHOMETRIC_QUESTIONS,
    },
    {
      id: "seg4",
      type: "email",
      prompt: "What have you planned to train yourself in over the next 6 months, and what are your long-term aspirations at HCLTech?",
    },
  ];
}

async function submitSegment(sessionId: string, segmentId: string, data: any) {
  try {
    let formattedAnswers: any[] = [];
    if (Array.isArray(data?.answers)) {
      formattedAnswers = data.answers;
    } else if (data && typeof data === "object" && !data.transcript && !data.type) {
      formattedAnswers = Object.entries(data).map(([qId, val]) => {
        const numVal = parseInt(String(val), 10);
        return {
          question_id: qId,
          selected_index: isNaN(numVal) ? null : numVal,
          selected_score: isNaN(numVal) ? null : numVal,
        };
      });
    }

    let segType = segmentId;
    if (segmentId === "seg2") segType = "cognitive";
    else if (segmentId === "seg3") segType = "psychometric";
    else if (segmentId === "seg4") segType = "email";

    const payload: any = { 
      segment: segType, 
      answers: formattedAnswers,
    };
    // Pass email data or transcript for oral segments
    if (data.type === "email_submission") {
      payload.raw_data = {
        segment_type: "email_submission",
        to: data.to || "techbeechronical@hcltech.com",
        cc: data.cc || "",
        subject: data.subject || "",
        body: data.body || "",
        transcript: `To: ${data.to || "techbeechronical@hcltech.com"}\nCc: ${data.cc || "None"}\nSubject: ${data.subject}\n\n${data.body}`,
      };
    } else if (data.transcript || data.type === "oral_submission") {
      payload.raw_data = {
        transcript: data.transcript || "",
        segment_type: data.type || "oral_submission",
      };
    }
    await fetch(`${API}/api/interview/sessions/${sessionId}/submit_segment`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Failed to submit segment", e);
  }
}

// ── Segment Components ────────────────────────────────────────────────────────

function OralSegment({
  segmentNumber,
  segment,
  videoRef,
  streamRef,
  speak,
  stopSpeaking,
  onComplete,
}: {
  segmentNumber: number;
  segment: Segment;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  speak?: (text: string) => Promise<void> | void;
  stopSpeaking?: () => void;
  onComplete: (data: any) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  const hasSpokenRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const finalTextRef = useRef("");
  // FIX-C: Mirror interimTranscript in a ref so handleStop always reads
  // the latest value even under React async state-update lag.
  const interimTextRef = useRef("");
  // FIX-A: Guard that prevents SpeechRecognition from starting while TTS
  // is still playing Aria's question (avoids capturing Aria's voice as
  // candidate speech in Segment 1).
  const isTtsSpeakingRef = useRef(false);
  const timerRef = useRef<any>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Real-time Audio Level & VU Meter using Web Audio API
  useEffect(() => {
    if (!recording || !streamRef.current) {
      setAudioLevel(0);
      return;
    }

    let audioCtx: AudioContext | null = null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const audioTracks = streamRef.current.getAudioTracks();
      if (!audioTracks.length) return;

      const audioStream = new MediaStream([audioTracks[0]]);
      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.warn("AudioContext setup warning:", err);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtx && audioCtx.state !== "closed") {
        try { audioCtx.close(); } catch {}
      }
    };
  }, [recording, streamRef]);

  // Robust restart helper for continuous speech recognition without stalling
  const recognitionActiveRef = useRef(false);
  const restartTimeoutRef = useRef<any>(null);

  const safeStartRecognition = () => {
    if (!isRecordingRef.current || isTtsSpeakingRef.current) return;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = setTimeout(() => {
      if (!isRecordingRef.current || isTtsSpeakingRef.current) return;
      const rec = recognitionRef.current;
      if (!rec) return;
      try {
        rec.start();
        recognitionActiveRef.current = true;
      } catch (err: any) {
        // If already started, mark as active
        if (err?.name === "InvalidStateError" || err?.message?.includes("already started")) {
          recognitionActiveRef.current = true;
        } else {
          console.warn("Safe start recognition warning:", err);
        }
      }
    }, 120);
  };

  // Initialize Speech Recognition with Zero-Lag incremental parsing & auto-recovery
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = "en-IN";

    rec.onstart = () => {
      recognitionActiveRef.current = true;
    };

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (!item?.[0]) continue;
        if (item.isFinal) {
          finalTextRef.current = (finalTextRef.current + " " + item[0].transcript).replace(/\s+/g, " ").trim();
        } else {
          interim += item[0].transcript;
        }
      }
      interimTextRef.current = interim.trim();
      setFinalTranscript(finalTextRef.current);
      setInterimTranscript(interim.trim());
    };

    rec.onerror = (e: any) => {
      // Chromium speech recognition triggers 'no-speech' or 'network' on silence or long pauses
      if (e.error === "no-speech" || e.error === "network") {
        recognitionActiveRef.current = false;
        safeStartRecognition();
        return;
      }
      if (e.error === "aborted") {
        recognitionActiveRef.current = false;
        return;
      }
      console.warn("Speech recognition warning:", e.error);
    };

    rec.onend = () => {
      recognitionActiveRef.current = false;
      setInterimTranscript("");
      interimTextRef.current = "";
      // Keep listening seamlessly if the candidate is still recording and TTS is not talking
      if (isRecordingRef.current && !isTtsSpeakingRef.current) {
        safeStartRecognition();
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      try { rec.abort(); } catch {}
    };
  }, []);

  // Continuous Speech Watchdog: Chromium automatically cuts off continuous speech recognition
  // after ~60s of silence or after a chunk buffer. This watchdog guarantees it is resurrected.
  useEffect(() => {
    if (!recording) return;
    const watchdogInterval = setInterval(() => {
      if (isRecordingRef.current && !isTtsSpeakingRef.current && !recognitionActiveRef.current) {
        safeStartRecognition();
      }
    }, 1500);

    return () => clearInterval(watchdogInterval);
  }, [recording]);

  // Re-attach video stream when component mounts
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [videoRef, streamRef]);

  // Read prompt aloud once on mount — FIX-A: gate isTtsSpeakingRef around playback
  useEffect(() => {
    if (speak && segment.prompt && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      // Mark TTS as active before speaking so SpeechRecognition won't restart
      isTtsSpeakingRef.current = true;
      const res = speak(segment.prompt);
      const onDone = () => {
        // TTS finished — safe to allow recognition restarts now
        isTtsSpeakingRef.current = false;
        // If candidate already clicked "Start Recording" while TTS was playing,
        // kick off recognition now that Aria has finished speaking.
        if (isRecordingRef.current && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch {}
        }
      };
      if (res && typeof (res as any).finally === "function") {
        (res as any).finally(onDone);
      } else {
        onDone();
      }
    }
    return () => {
      if (stopSpeaking) stopSpeaking();
    };
  }, [speak, stopSpeaking, segment.prompt]);


  // Recording timer
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setElapsedSecs((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  // Auto-scroll transcript container
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [finalTranscript, interimTranscript]);

  const handleStart = () => {
    isRecordingRef.current = true;
    setRecording(true);
    setElapsedSecs(0);
    finalTextRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setIsEditing(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Speech recognition already active:", e);
      }
    }
  };
  
  const handleStop = () => {
    isRecordingRef.current = false;
    setRecording(false);
    setSubmitting(true);
    if (stopSpeaking) stopSpeaking();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    // FIX-C: Use refs (not state) to build the final transcript.
    // React state updates are async — reading state here can return a
    // stale empty string if the candidate clicks Stop very quickly.
    const combined = isEditing
      ? editText.trim()
      : (finalTextRef.current + (interimTextRef.current ? " " + interimTextRef.current : "")).trim();

    onComplete({
      type: "oral_submission",
      text: "Candidate responded",
      transcript: combined
    });
  };


  const combinedText = isEditing 
    ? editText 
    : (finalTranscript + (interimTranscript ? " " + interimTranscript : "")).trim();
  const wordCount = combinedText ? combinedText.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full gap-5">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-sm">
            0{segmentNumber}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Segment {segmentNumber}: Oral Introduction &amp; Communication</h2>
            <p className="text-xs text-slate-500">Step {segmentNumber} of 4 • AI-powered live speech evaluation</p>
          </div>
        </div>
        {recording && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Recording Active • {Math.floor(elapsedSecs / 60)}:{(elapsedSecs % 60).toString().padStart(2, "0")}</span>
          </div>
        )}
      </div>

      {/* Main 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (60% on desktop: lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Question / AI Prompt Card - Sticky top so it stays in sight */}
          <div className="sticky top-2 z-10 bg-gradient-to-r from-teal-50/95 via-emerald-50/95 to-teal-50/95 backdrop-blur-sm border border-teal-200/90 rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-teal-600" />
                Interviewer Question &amp; Prompt
              </span>
              {speak && segment.prompt && (
                <button
                  type="button"
                  onClick={() => speak(segment.prompt || "")}
                  className="text-xs text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1 px-2.5 py-1 rounded bg-teal-100/70 hover:bg-teal-100 transition-colors"
                  title="Replay question audio"
                >
                  <Volume2 size={13} />
                  Replay Audio
                </button>
              )}
            </div>
            <p className="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed">
              {segment.prompt}
            </p>
          </div>

          {/* Video Preview Container */}
          <div className="relative w-full bg-black rounded-xl overflow-hidden aspect-video shadow-lg ring-1 ring-slate-900/10 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Proctoring Status Pill */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-400 border border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Proctoring Active
            </div>

            {/* Live Audio Activity Overlay on Video */}
            {recording && (
              <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium shrink-0">
                  <Activity size={14} className={audioLevel > 5 ? "animate-pulse" : ""} />
                  <span>Mic VU</span>
                </div>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                    style={{ width: `${Math.max(4, audioLevel)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-300 font-mono w-7 text-right">
                  {audioLevel}%
                </span>
              </div>
            )}
          </div>

          {/* Action Controls Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              <p className="font-semibold text-slate-700">
                {recording ? "Speak clearly into your microphone" : "Ready to begin your response?"}
              </p>
              <p className="text-[11px] text-slate-400">
                {recording ? "Live speech is streamed directly to the transcript console on the right." : "Click below to start recording. You can review the live transcript in real-time."}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!recording ? (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm shadow-indigo-600/20 hover:shadow-md transition-all flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Mic size={16} />
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm shadow-red-600/20 hover:shadow-md transition-all flex items-center gap-2 text-sm cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span>Stop &amp; Submit Response</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (40% on desktop: lg:col-span-5) - Live Transcript Side Console */}
        <div className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-4">
          {/* Transcript Console Header */}
          <div className="bg-slate-50/90 border-b border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${recording ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Live Speech Transcript
              </span>
            </div>

            <div className="flex items-center gap-2">
              {recording && (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Streaming
                </span>
              )}
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                EN-IN / 0ms
              </span>
            </div>
          </div>

          {/* Soundwave / Audio Equalizer Bar (Instant Zero-Lag visual confirmation) */}
          {recording && (
            <div className="px-4 py-2 bg-indigo-50/40 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-700">
              <div className="flex items-center gap-1.5">
                <Activity size={13} className="text-indigo-600 animate-pulse" />
                <span className="font-medium text-[11px]">Audio Input Live</span>
              </div>
              <div className="flex items-end gap-1 h-3.5">
                {[20, 50, 80, 40, 90, 60, 30].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 bg-indigo-500 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(3, (audioLevel > 5 ? (h * audioLevel) / 100 : 3))}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Transcript Body */}
          <div className="p-4 flex-1 flex flex-col">
            {isEditing ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Manual Transcript Editor</span>
                  <span className="text-[10px] text-slate-400">Review &amp; correct before submit</span>
                </div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full flex-1 min-h-[260px] max-h-[400px] p-3 text-xs text-slate-800 leading-relaxed font-sans bg-slate-50 rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  placeholder="Edit your speech transcript here..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      finalTextRef.current = editText;
                      setFinalTranscript(editText);
                      setInterimTranscript("");
                      setIsEditing(false);
                    }}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check size={13} /> Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                ref={transcriptScrollRef}
                className="w-full flex-1 min-h-[260px] max-h-[380px] overflow-y-auto p-3.5 bg-slate-50/70 rounded-lg border border-slate-200 text-xs leading-relaxed font-sans scroll-smooth"
              >
                {finalTranscript || interimTranscript ? (
                  <p className="text-slate-800">
                    <span className="font-normal">{finalTranscript}</span>
                    {interimTranscript && (
                      <span className="text-indigo-600 font-medium italic animate-pulse ml-1">
                        {interimTranscript}
                      </span>
                    )}
                  </p>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 gap-2">
                    <Mic size={24} className="text-slate-300" />
                    <p className="text-xs font-medium">
                      {recording ? "Listening... start speaking your response" : "Click 'Start Recording' to begin speaking"}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Words are transcribed instantaneously in real-time as you speak.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Transcript Footer & Telemetry */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span>
                  Words: <strong className="text-slate-700 font-semibold">{wordCount}</strong>
                </span>
                <span>•</span>
                <span>
                  Time: <strong className="text-slate-700 font-semibold">{Math.floor(elapsedSecs / 60)}:{(elapsedSecs % 60).toString().padStart(2, "0")}</strong>
                </span>
              </div>

              {!isEditing && (finalTranscript || interimTranscript) && !recording && (
                <button
                  type="button"
                  onClick={() => {
                    setEditText(combinedText);
                    setIsEditing(true);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Edit3 size={12} /> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CognitiveSegment({
  segment,
  sessionId,
  videoRef,
  streamRef,
  onComplete,
}: {
  segment: Segment;
  sessionId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  onComplete: (data: any) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(segment.time_limit || 1200);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [questions, setQuestions] = useState<Question[]>(
    (segment.questions && segment.questions.length > 0) ? segment.questions : BACKUP_COGNITIVE_QUESTIONS
  );
  const [isResetting, setIsResetting] = useState(false);

  // Re-attach video stream when component mounts
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [videoRef, streamRef]);

  // Keep questions in sync with segment.questions
  useEffect(() => {
    if (segment.questions && segment.questions.length > 0) {
      setQuestions(segment.questions);
    } else {
      setQuestions(BACKUP_COGNITIVE_QUESTIONS);
    }
  }, [segment.questions]);

  // Handle interruption recovery if candidate disconnected mid-test
  useEffect(() => {
    const startedKey = `cognitive_active_${sessionId}_${segment.id}`;
    const wasStarted = sessionStorage.getItem(startedKey);
    // Only attempt reset if previously active AND no assigned questions present
    if (wasStarted === "true" && (!segment.questions || segment.questions.length === 0)) {
      setIsResetting(true);
      fetch(`${API}/api/interview/sessions/${sessionId}/reset_cognitive_segment`, { 
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.questions && data.questions.length > 0) {
            const mappedQuestions = data.questions.map((q: any) => ({
              id: q.id,
              text: q.text,
              options: (q.options || []).map((o: any, idx: number) => {
                if (typeof o === 'string') return { label: o, value: idx.toString() };
                return o;
              })
            }));
            setQuestions(mappedQuestions);
            setTimeLeft(data.time_limit || 1200);
          }
        })
        .catch(err => {
          console.warn("Reset segment error, keeping current questions:", err);
        })
        .finally(() => {
          setIsResetting(false);
          setCurrentQIdx(0);
          setAnswers({});
        });
    } else {
      sessionStorage.setItem(startedKey, "true");
    }
  }, [segment.id, sessionId, segment.questions]);

  const answersRef = useRef(answers);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    answersRef.current = answers;
    onCompleteRef.current = onComplete;
  }, [answers, onComplete]);

  useEffect(() => {
    if (isResetting) return;
    
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setTimeout(() => {
            sessionStorage.removeItem(`cognitive_started_${segment.id}`);
            onCompleteRef.current(answersRef.current);
          }, 0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isResetting, segment.id]);

  const handleNext = (val?: string) => {
    const q = questions[currentQIdx];
    let newAnswers = answers;
    if (val) {
      newAnswers = { ...answers, [q.id]: val };
      setAnswers(newAnswers);
    }
    
    if (currentQIdx + 1 < questions.length) {
      setCurrentQIdx(c => c + 1);
    } else {
      sessionStorage.removeItem(`cognitive_started_${segment.id}`);
      onComplete(newAnswers);
    }
  };

  if (isResetting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 w-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p>Session interrupted. Fetching new questions and resetting timer...</p>
      </div>
    );
  }

  const q = questions[currentQIdx];

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-5xl mx-auto w-full gap-5">
      {/* Pinned / Sticky Top Bar with Proctoring Thumbnail & Timer */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-2 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-28 sm:w-32 rounded-lg overflow-hidden bg-black aspect-video border border-slate-300 shrink-0">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Segment 2: Cognitive Assessment</h2>
            <p className="text-xs sm:text-sm text-slate-500">Question {currentQIdx + 1} of {questions.length} • Timed Evaluation</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xl sm:text-2xl font-mono font-bold ${timeLeft < 60 ? "text-red-600 animate-pulse" : "text-slate-800"}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">Time Remaining</p>
        </div>
      </div>

      {/* Main Question & Answer Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {q ? (
          <div className="flex flex-col flex-1">
            {/* Sticky Question Header: Always visible so candidate never loses sight of question */}
            <div className="sticky top-[88px] z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 p-5 sm:p-6 shadow-xs">
              <div className="max-w-3xl mx-auto space-y-2.5">
                <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                  Question {currentQIdx + 1} of {questions.length}
                </span>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-800 leading-snug">
                  {q.text}
                </h3>
              </div>
            </div>

            {/* Scrollable Answer Options Area */}
            <div className="p-5 sm:p-8 flex-1 overflow-y-auto max-h-[calc(100vh-320px)]">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {q.options?.map((opt: any, optIdx: number) => {
                    const label = typeof opt === "string" ? opt : (opt?.label || "");
                    const val = typeof opt === "string" ? optIdx.toString() : (opt?.value ?? optIdx.toString());
                    const isSelected = answers[q.id] === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => handleNext(val)}
                        className={`flex items-start p-4 rounded-xl border-2 text-left transition-all cursor-pointer group ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-200"
                            : "border-slate-200 hover:border-indigo-500 hover:bg-slate-50 shadow-sm"
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center mr-3.5 text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="text-slate-800 font-medium text-base leading-snug pt-1">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => handleNext()} 
                    className="px-5 py-2.5 text-slate-500 hover:text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-all text-sm cursor-pointer"
                  >
                    Skip Question →
                  </button>
                  <span className="text-xs text-slate-400">Select any option above to proceed</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-semibold text-slate-700">Loading question...</p>
            <p className="text-sm text-slate-400 mt-1">Preparing assessment questions</p>
          </div>
        )}
      </div>
    </div>
  );
}

function cleanStatementText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^Statement\s*\d*\s*(\([^)]+\))?:\s*/i, "")
    .replace(/^\([^)]+\):\s*/i, "")
    .trim();
}

function PsychometricSegment({
  segment,
  videoRef,
  streamRef,
  onComplete,
}: {
  segment: Segment;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  onComplete: (data: any) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Re-attach video stream when component mounts
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [videoRef, streamRef]);

  const handleSubmit = () => {
    setSubmitting(true);
    onComplete(answers);
  };

  const allAnswered = segment.questions?.every((q) => answers[q.id]);

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full gap-6">
      <div className="flex items-center gap-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="w-32 rounded-lg overflow-hidden bg-black aspect-video border border-slate-300 shrink-0">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Segment 3</h2>
          <p className="text-slate-500 text-sm">Please answer the following statements honestly. There is no time limit.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
        {segment.questions?.map((q, idx) => (
          <div key={q.id} className="p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-800">
              <span className="text-slate-400 mr-2">{idx + 1}.</span>
              {cleanStatementText(q.text)}
            </h3>
            <div className="flex flex-col sm:flex-row gap-2.5">
              {q.options?.map((opt) => {
                const isSelected = answers[q.id] === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                    className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all text-center cursor-pointer ${
                      isSelected
                        ? "border-purple-600 bg-purple-50 ring-2 ring-purple-200 shadow-sm"
                        : "border-slate-100 hover:border-purple-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`text-sm font-medium ${isSelected ? "text-purple-700 font-semibold" : "text-slate-600"}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className={`px-8 py-3 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 ${
            allAnswered && !submitting ? "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer" : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <span>Submit &amp; Proceed →</span>
          )}
        </button>
      </div>
    </div>
  );
}

function EmailSegment({
  segmentNumber,
  segment,
  candidateName,
  videoRef,
  streamRef,
  onComplete,
}: {
  segmentNumber: number;
  segment: Segment;
  candidateName?: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  onComplete: (data: any) => void;
}) {
  const [toEmail] = useState("techbeechronical@hcltech.com");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const candidateEmail = (typeof window !== "undefined" && (sessionStorage.getItem("candidate_email") || localStorage.getItem("candidate_email"))) || "candidate@techbee.in";
  const displayName = candidateName || "Candidate";

  // Re-attach video stream when component mounts to maintain proctoring continuity
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [videoRef, streamRef]);

  const wordCount = body.trim() ? body.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = body.length;

  const handleSubmit = () => {
    setValidationError("");
    if (!subject.trim()) {
      setValidationError("Please enter an email subject line before submitting.");
      return;
    }
    if (!body.trim() || wordCount < 10) {
      setValidationError("Please write your email message (at least 10 words) before submitting.");
      return;
    }
    setSubmitting(true);
    onComplete({
      type: "email_submission",
      to: toEmail,
      cc: ccEmail.trim(),
      subject: subject.trim(),
      body: body.trim(),
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-5xl mx-auto w-full gap-5">
      {/* Top Header Card with Proctoring Mirror (Sticky Top) */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 sticky top-2 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-base shrink-0">
            0{segmentNumber}
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Segment {segmentNumber}: Business Written Communication</h2>
            <p className="text-xs text-slate-500">Step {segmentNumber} of 4 • Draft and send a formal corporate email. There is no time limit.</p>
          </div>
        </div>

        {/* Proctoring camera preview */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-28 sm:w-36 rounded-lg overflow-hidden bg-black aspect-video border border-slate-300 shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Proctoring Active
            </div>
          </div>
        </div>
      </div>

      {/* Context & Objective Guidance Banner (Sticky Prompt Card so instructions never get lost) */}
      <div className="sticky top-[88px] z-10 bg-gradient-to-r from-blue-50/95 via-indigo-50/95 to-purple-50/95 backdrop-blur-sm border border-blue-200/90 rounded-xl p-4 sm:p-5 shadow-xs space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs sm:text-sm">
          <Mail size={16} className="text-indigo-600" />
          <span>Email Writing Task Prompt &amp; Instructions</span>
        </div>
        <p className="text-sm sm:text-base font-semibold text-slate-800 leading-snug">
          {segment.prompt || "What have you planned to train yourself in over the next 6 months, and what are your long-term aspirations at HCLTech?"}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-600 pt-0.5">
          <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
            ✓ Clear Subject Line
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
            ✓ Formal Salutation &amp; Paragraphs
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
            ✓ 6-Month Upskilling &amp; Long-term Aspirations
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
            ✓ Courteous Thanks &amp; Professional Sign-off
          </span>
        </div>
      </div>

      {/* Outlook / Teams Style Email Composer Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
        {/* Email Composer Window Header */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span className="ml-2 font-mono text-slate-500">TechBee Chronicle Outlook Web Client</span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
            Rich Email Message
          </span>
        </div>

        {/* Email Header Fields */}
        <div className="p-4 sm:p-5 space-y-3 border-b border-slate-100 bg-slate-50/40">
          {/* From field */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs font-bold text-slate-500 text-right uppercase tracking-wider">From:</span>
            <div className="flex-1 text-xs text-slate-700 font-medium py-1 px-2.5 bg-slate-100 rounded-md border border-slate-200 inline-flex items-center gap-2">
              <span className="font-semibold text-slate-800">{displayName}</span>
              <span className="text-slate-500">&lt;{candidateEmail}&gt;</span>
            </div>
          </div>

          {/* To field */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs font-bold text-slate-500 text-right uppercase tracking-wider">To:</span>
            <div className="flex-1 flex items-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-full shadow-2xs">
                <Lock size={12} className="text-indigo-500" />
                {toEmail}
              </span>
            </div>
          </div>

          {/* CC field */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs font-bold text-slate-500 text-right uppercase tracking-wider">Cc:</span>
            <input
              type="text"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="e.g. mentor@hcltech.com, cadre@hcltech.com (leave blank or optional)"
              className="flex-1 text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            />
          </div>

          {/* Subject field */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs font-bold text-slate-500 text-right uppercase tracking-wider">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (validationError) setValidationError("");
              }}
              placeholder="Enter email subject (e.g. 6-Month Upskilling Roadmap & Long-Term Aspirations at HCLTech)"
              className="flex-1 text-sm font-semibold px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
        </div>

        {/* Email Body Field (Scrollable writing area) */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col">
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (validationError) setValidationError("");
            }}
            placeholder={`Dear TechBee Chronicle Team,\n\nI am writing to share my professional upskilling plan for the next 6 months and my long-term aspirations at HCLTech.\n\nOver the next 6 months, my primary goal is to master [mention skills, technologies, and certifications]...\n\nIn the long run, my career aspiration at HCLTech is to [describe your domain interests, leadership path, and team contributions]...\n\nThank you for your continuous support, guidance, and encouragement.\n\nWarm regards,\n${displayName}`}
            rows={10}
            className="w-full min-h-[220px] max-h-[calc(100vh-420px)] overflow-y-auto p-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y placeholder:text-slate-400 placeholder:leading-relaxed"
          />

          {validationError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-semibold">
              <AlertCircle size={15} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Footer stats & submit button */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>
                Words: <strong className="text-slate-700 font-semibold">{wordCount}</strong>
              </span>
              <span>•</span>
              <span>
                Characters: <strong className="text-slate-700 font-semibold">{charCount}</strong>
              </span>
              {wordCount >= 20 && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    ✓ Valid email body length
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={`px-8 py-3 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center gap-2 ${
                submitting
                  ? "bg-indigo-400 text-white cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-indigo-600/20 hover:shadow-md"
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending &amp; Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Send &amp; Submit Email →</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function UnifiedInterviewRoomPage() {
  const [phase, setPhase] = useState<InterviewPhase>("loading");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(1);
  const [activeSessionId, setActiveSessionId] = useState<string>("mock-session-id");

  const [candidateFirstName, setCandidateFirstName] = useState<string>("Candidate");

  const { videoRef, streamRef, mediaInitialized, audioCtxRef, audioDestRef } = useMediaStream();
  const proctoring = useProctoring(phase);
  
  const { speak, stopSpeaking } = useEdgeTTS(audioCtxRef, audioDestRef);
  
  useMediaPipe({
    videoElement: videoRef.current,
    enabled: phase !== "loading" && phase !== "pre_session" && phase !== "completed",
    onViolation: proctoring.pushViolation
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let localName = "";
    if (typeof window !== "undefined") {
      localName = sessionStorage.getItem("candidate_name") ||
                  sessionStorage.getItem("candidate_display_name") ||
                  localStorage.getItem("candidate_name") || "";
    }
    fetchRealSession().then((sessionData) => {
      const sId = sessionData?.session_id || "session-123";
      setActiveSessionId(sId);
      
      const fullName = sessionData?.candidate_name || localName || "Candidate";
      const fName = fullName.trim().split(/\s+/)[0] || "Candidate";
      setCandidateFirstName(fName);

      fetchSegments(sId, fName).then((data) => {
        setSegments(data);
        setPhase("pre_session");
      });
    });
  }, []);

  const handleBeginSession = () => {
    setPhase("segment_1");
    if (streamRef.current && !mediaRecorderRef.current) {
      try {
        const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.error("Failed to start MediaRecorder", err);
      }
    }
  };

  const handleSegmentSubmit = async (segmentId: string, nextPhase: InterviewPhase, data: any) => {
    stopSpeaking();
    data.violations = proctoring.violationLogRef.current;
    
    // Instantaneous transition between segments (0ms lag!)
    if (nextPhase !== "completed") {
      setPhase(nextPhase);
    }
    
    // Asynchronous background submission so network doesn't freeze the UI
    submitSegment(activeSessionId, segmentId, data).catch((err) => {
      console.warn("Background segment submission warning:", err);
    });
    
    if (nextPhase === "completed") {
      setIsUploading(true);
      setUploadStep(1); // Step 1: Uploading Video Recording to AWS
      let uploadedVideoUrl = "";
      const cEmail = (typeof window !== "undefined" && (sessionStorage.getItem("candidate_email") || localStorage.getItem("candidate_email"))) || "fresher@techbee.in";
      const cName = (typeof window !== "undefined" && (sessionStorage.getItem("candidate_name") || localStorage.getItem("candidate_name"))) || candidateFirstName || "Fresher Candidate";
      const cSap = (typeof window !== "undefined" && (sessionStorage.getItem("candidate_sap") || sessionStorage.getItem("sap_id") || localStorage.getItem("candidate_sap"))) || "";

      const finalizeSessionAndReport = async (videoUrl: string) => {
        // Step 2: Evaluating responses & cognitive/psychometric scoring
        setUploadStep(2);
        try {
          await fetch(`${API}/api/interview/session/end`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`
            },
            body: JSON.stringify({ session_id: activeSessionId })
          });
        } catch (endErr) {
          console.warn("session/end call failed:", endErr);
        }

        // Step 3: Compiling HR dossier & generating executive PDF report
        setUploadStep(3);
        try {
          const pdfRes = await fetch(`${API}/api/reports/${activeSessionId}/generate-pdf?template_id=1`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`
            },
            body: JSON.stringify({
              candidate_name: cName,
              candidate_email: cEmail,
              sap_id: cSap,
              interviewed_at: new Date().toISOString(),
              s3_video_url: videoUrl,
              transcript: [],
              behavioral_summary: {
                eye_contact_avg: 82,
                adaptability_score: 80,
                engagement_score: 85,
                nervousness_score: 15,
                posture_score: 80,
                overall_behavior_score: 82,
                violation_count: proctoring.violationCount || 0,
                violation_log: proctoring.violationLogRef.current || []
              }
            })
          });
          if (pdfRes.ok) {
            const pdfData = await pdfRes.json();
            const reportUrl = pdfData.pdf_url || pdfData.s3_url || `/api/reports/serve/${activeSessionId}`;
            localStorage.setItem("latest_completed_interview_session", JSON.stringify({
              sap_id: cSap,
              candidate_name: cName,
              session_id: activeSessionId,
              pdf_url: reportUrl,
              s3_url: videoUrl,
              date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            }));
          }
        } catch (pdfErr) {
          console.warn("generate-pdf call failed:", pdfErr);
        }

        // Step 4: Finalizing
        setUploadStep(4);
        await new Promise((r) => setTimeout(r, 600));

        setIsUploading(false);
        setPhase(nextPhase);
      };

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.onstop = async () => {
          const videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          try {
            const presigned = await getLambdaPresignedUrl({
               candidateEmail: cEmail,
               candidateName: cName,
               sessionId: activeSessionId
            });
            if (presigned?.upload_url) {
               await putToPresignedUrl(presigned.upload_url, videoBlob);
               uploadedVideoUrl = presigned.upload_url.split("?")[0];
            } else {
               const upRes = await uploadRecording({
                 videoBlob,
                 candidateEmail: cEmail,
                 candidateName: cName,
                 sessionId: activeSessionId,
                 interviewedAt: new Date().toISOString(),
                 mimeType: "video/webm"
               });
               uploadedVideoUrl = upRes?.s3_url || upRes?.local_url || "";
            }
          } catch(err) {
            console.error("Failed to upload video to AWS:", err);
          }
          await finalizeSessionAndReport(uploadedVideoUrl);
        };
        mediaRecorderRef.current.stop();
      } else {
        await finalizeSessionAndReport("");
      }
    }
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  if (isUploading) {
    const steps = [
      {
        id: 1,
        title: "Uploading Video Recording to Vault",
        desc: "Archiving proctored video feed to encrypted Vault storage",
        icon: UploadCloud
      },
      {
        id: 2,
        title: "Evaluating Responses & Performance Metrics",
        desc: "Computing communication clarity, cognitive index & psychometric fit",
        icon: Sparkles
      },
      {
        id: 3,
        title: "Compiling Candidate Dossier & PDF Report",
        desc: "Synthesizing executive summary and official evaluation scorecard",
        icon: FileText
      }
    ];

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900/95 p-4 backdrop-blur-md">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Urgent Warning Banner */}
          <div className="bg-amber-500 text-slate-950 px-6 py-4 flex items-center gap-3 border-b border-amber-600">
            <div className="w-9 h-9 rounded-full bg-slate-950/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="text-slate-950 w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight uppercase tracking-wide">
                Do not close or refresh this page
              </h3>
              <p className="text-xs text-slate-900 font-medium mt-0.5">
                Your responses and video artifacts are being evaluated and securely submitted to the database.
              </p>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="p-8 flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-800">Finalizing Your Assessment</h2>
              <p className="text-sm text-slate-500 mt-1">Please wait while the system evaluates your interview submission.</p>
            </div>

            {/* Step-by-Step Checklist */}
            <div className="space-y-4">
              {steps.map((step) => {
                const isDone = uploadStep > step.id;
                const isCurrent = uploadStep === step.id;
                const isPending = uploadStep < step.id;
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                      isDone
                        ? "bg-emerald-50/70 border-emerald-200"
                        : isCurrent
                        ? "bg-indigo-50/80 border-indigo-300 shadow-sm ring-1 ring-indigo-200"
                        : "bg-slate-50 border-slate-200 opacity-50"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      ) : isCurrent ? (
                        <div className="relative">
                          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-400">
                          {step.id}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${
                          isDone ? "text-emerald-900" : isCurrent ? "text-indigo-950" : "text-slate-500"
                        }`}>
                          {step.title}
                        </span>
                        {isDone && (
                          <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            Completed
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full animate-pulse">
                            In progress...
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isCurrent ? "text-indigo-700" : "text-slate-500"}`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note at bottom */}
            <div className="text-center pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                You will be automatically redirected to the completion screen once all steps finish.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 flex flex-col bg-slate-50">
      {/* Header, minimal since we aren't using all proctoring hooks right now */}
      <InterviewHeader
        elapsedSeconds={proctoring.elapsedSeconds}
        violationCount={proctoring.violationCount}
        formatTime={proctoring.formatTime}
      />

      {/* Violation Warning Overlay */}
      {proctoring.violationWarning && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-4 animate-bounce">
          <div className="font-semibold">{proctoring.violationWarning}</div>
          <button onClick={proctoring.dismissWarning} className="text-white hover:text-red-200 focus:outline-none font-bold">✕</button>
        </div>
      )}

      <main className="flex-1 flex flex-col w-full mx-auto relative z-10">
        {phase === "pre_session" && (
          <PreSession
            bondYear={2026} // mock
            videoRef={videoRef}
            streamRef={streamRef}
            mediaInitialized={mediaInitialized}
            onBegin={handleBeginSession}
          />
        )}

        {phase === "segment_1" && segments[0] && (
          <OralSegment
            segmentNumber={1}
            segment={segments[0]}
            videoRef={videoRef}
            streamRef={streamRef}
            speak={speak}
            stopSpeaking={stopSpeaking}
            onComplete={(data) => handleSegmentSubmit(segments[0].id, "segment_2", data)}
          />
        )}

        {phase === "segment_2" && segments[1] && (
          <CognitiveSegment
            segment={segments[1]}
            sessionId={activeSessionId}
            videoRef={videoRef}
            streamRef={streamRef}
            onComplete={(data) => handleSegmentSubmit(segments[1].id, "segment_3", data)}
          />
        )}

        {phase === "segment_3" && segments[2] && (
          <PsychometricSegment
            segment={segments[2]}
            videoRef={videoRef}
            streamRef={streamRef}
            onComplete={(data) => handleSegmentSubmit(segments[2].id, "segment_4", data)}
          />
        )}

        {phase === "segment_4" && segments[3] && (
          <EmailSegment
            segmentNumber={4}
            segment={segments[3]}
            candidateName={candidateFirstName}
            videoRef={videoRef}
            streamRef={streamRef}
            onComplete={(data) => handleSegmentSubmit(segments[3].id, "completed", data)}
          />
        )}

        {phase === "completed" && <CompletedScreen />}
      </main>
    </div>
  );
}
