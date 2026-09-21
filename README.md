# 🐝 TechBee AI Interview Platform

> **Enterprise AI-powered interview system** for the TechBee candidate evaluation program.  
> Built with **Aria** — an AI interviewer powered by Google Gemini, integrated directly into Microsoft Teams.

---

## ✨ Features

### For Candidates (via Microsoft Teams)
- 🎤 **AI Avatar Interview** — Aria asks 3 main + 3 follow-up questions in a natural conversation
- 📝 **Live Transcript** — Real-time speech-to-text for both Aria and the candidate
- 🔒 **Proctored Session** — Fullscreen lock, tab-switch detection, multi-face detection
- 🎥 **Video Recording** — Full interview recorded to Google Cloud Storage (7-year retention)
- 🧠 **3 Interview Rounds** — Psychometric, Communication, and Scenario/Problem-solving

### For HR Managers (via Teams Dashboard)
- 📊 **Dashboard** — Real-time interview stats, upcoming sessions, recent completions
- 👥 **Candidate Management** — Search, add, and track candidates
- 📈 **AI Analysis Reports** — 8-dimension scoring (communication, psychometric, problem-solving, confidence, clarity, attitude, eye contact, body language)
- 🎯 **Domain Recommendation** — AI suggests best-fit technical domain for each candidate
- 📄 **PDF Reports** — Downloadable evaluation reports with full transcript
- ▶️ **Recording Playback** — Signed URL access to interview recordings

### AI & Analytics
- 🤖 **Gemini 1.5 Flash** — Question generation, follow-up generation, interview analysis
- 👁️ **MediaPipe FaceLandmarker** — Browser-side eye contact, head pose, and facial expression tracking
- 🗣️ **OpenAI Whisper** — Server-side speech transcription
- 🔊 **Google Cloud TTS Neural2** — Aria's Indian English voice (en-IN-Neural2-A)

---

## 🏗️ Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Microsoft      │     │   Next.js 14     │     │   FastAPI        │
│   Teams          │────▶│   Frontend       │────▶│   Backend        │
│   (Tab App)      │     │   (TypeScript)   │     │   (Python 3.11)  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                │                        │
                          ┌─────┴─────┐           ┌──────┴──────┐
                          │ MediaPipe │           │  Services   │
                          │ (WASM)    │           ├─────────────┤
                          │ Web Speech│           │ Gemini AI   │
                          │ API (STT) │           │ Whisper STT │
                          └───────────┘           │ Cloud TTS   │
                                                  │ GCS Storage │
                                                  └──────┬──────┘
                                                         │
                                                  ┌──────┴──────┐
                                                  │ PostgreSQL  │
                                                  │ Redis       │
                                                  │ Cloud SQL   │
                                                  └─────────────┘
```

---

## 📁 Project Structure

```
techbee-ai-interview/
├── apps/
│   ├── api/                      # FastAPI backend
│   │   ├── app/
│   │   │   ├── core/             # Config, DB, Auth
│   │   │   ├── models/           # SQLAlchemy models (9 tables)
│   │   │   ├── routers/          # API endpoints
│   │   │   ├── services/         # AI, TTS, STT, Storage, PDF
│   │   │   ├── schemas/          # Pydantic validation
│   │   │   └── utils/            # Audio processing, Proctoring
│   │   ├── alembic/              # Database migrations
│   │   ├── main.py               # FastAPI app entry
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── web/                      # Next.js frontend
│       ├── app/
│       │   ├── page.tsx           # Teams SSO entry
│       │   ├── interview/         # Interview room (934 lines)
│       │   └── hr/                # HR dashboard, candidates, reports
│       ├── lib/                   # Custom hooks
│       │   ├── useMediaPipe.ts    # Face analysis
│       │   ├── useSpeechRecognition.ts  # Browser STT
│       │   ├── useWebSocket.ts    # Native WebSocket
│       │   ├── useInterviewRecorder.ts  # Video recording
│       │   └── useSimliAvatar.ts  # Avatar WebRTC
│       ├── components/            # Reusable UI
│       └── Dockerfile
│
├── infrastructure/
│   ├── teams/                    # Teams app manifest
│   ├── cloudbuild.yaml           # GCP Cloud Build CI/CD
│   └── gcs-lifecycle.json        # 7-year retention policy
│
├── docker-compose.yml            # Local dev environment
└── package.json                  # Monorepo root
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 16+
- Docker (optional)

### 1. Clone & Install

```bash
git clone <repo-url>
cd techbee-ai-interview

# Install frontend dependencies
cd apps/web && npm install && cd ../..

# Install backend dependencies
cd apps/api
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 2. Environment Variables

```bash
# API
cp apps/api/.env.example apps/api/.env
# Edit with your API keys (Gemini, OpenAI, Azure AD, GCP)

# Web
# apps/web/.env.local already configured for localhost
```

### 3. Start Development

**Option A: Docker Compose**
```bash
docker compose up -d
# API: http://localhost:8000/api/docs
# Web: http://localhost:3000
```

**Option B: Manual**
```bash
# Terminal 1 — API
cd apps/api && uvicorn main:app --reload --port 8000

# Terminal 2 — Web
cd apps/web && npm run dev
```

---

## 📊 Database Schema

| Table | Description |
|-------|-------------|
| `hr_users` | HR managers and admins |
| `candidates` | TechBee interview candidates |
| `interview_sessions` | Interview session lifecycle |
| `session_questions` | Questions per session (6 total) |
| `candidate_responses` | Transcribed responses with timestamps |
| `analysis_results` | AI-generated scores and insights |
| `interview_reports` | Final reports with PDF URLs |
| `proctoring_violations` | Tab switches, face detection failures |
| `question_bank` | Reusable HR-defined questions |

---

## 🔐 Security

- **Teams SSO** — Azure AD JWT validation with JWKS
- **Role-Based Access** — HR-only endpoints protected by `get_current_hr_user` dependency
- **Proctored Sessions** — Fullscreen enforcement, tab-switch detection, multi-face detection
- **Signed URLs** — Time-limited GCS access for recordings (2-hour expiry)
- **No Email Links** — Everything accessed through Microsoft Teams only
- **7-Year Retention** — GCS lifecycle: Standard → Nearline → Coldline → Delete

---

## 🌐 Deployment (GCP)

```bash
# Setup GCS buckets with lifecycle
gsutil lifecycle set infrastructure/gcs-lifecycle.json gs://techbee-interview-recordings
gsutil lifecycle set infrastructure/gcs-lifecycle.json gs://techbee-interview-reports

# Deploy via Cloud Build
gcloud builds submit --config=infrastructure/cloudbuild.yaml

# Or deploy manually
gcloud run deploy techbee-api --source=apps/api --region=asia-south1
gcloud run deploy techbee-web --source=apps/web --region=asia-south1
```

---

## 📝 API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/health` | Health check | — |
| POST | `/api/auth/login` | Teams SSO login | — |
| GET | `/api/auth/me` | Current user info | Token |
| GET | `/api/hr/dashboard` | Dashboard stats | HR |
| GET | `/api/hr/candidates` | List candidates | HR |
| POST | `/api/interview/sessions` | Create session | HR |
| GET | `/api/interview/session/my` | Get assigned session | Candidate |
| POST | `/api/interview/session/start` | Start interview | Candidate |
| POST | `/api/interview/response/submit` | Submit response + get follow-up | Candidate |
| POST | `/api/interview/session/end` | End interview | Candidate |
| GET | `/api/reports/{session_id}` | Get evaluation report | HR |
| WS | `/ws/interview/{session_id}` | Real-time transcript/violations | Any |

---

## 🎨 Design System

- **Colors**: Teal (#00d4aa), Purple (#7c3aed), Dark backgrounds (#0d1117, #161b22)
- **Typography**: Space Grotesk (headings), Inter (body)
- **Style**: Glassmorphism, subtle animations, dark-first design
- **Components**: glass-card, btn-primary/secondary, score-badges, typing-dots, wave-bars

---

## 🔒 Security & Hardening

See [docs/SECURITY.md](docs/SECURITY.md) for detailed credentials guidelines, incident response procedures, and vulnerability posture.

- **Dev Token Bypass**: Disabled outside `APP_ENV=development`.
- **Domain Gate**: Auto-provisioned HR users restricted to `@hcltech.com` (via `ALLOWED_HR_DOMAIN`).
- **Rate Limiting**: `slowapi` throttling active (30 req/min general).
- **Security Headers**: Added strict CSP, `X-Frame-Options` for Teams, `Referrer-Policy`, and `Permissions-Policy`.
- **Technical Debt & Shortcuts**: Tracked in [docs/KNOWN_SHORTCUTS.md](docs/KNOWN_SHORTCUTS.md).

---

## 🧪 Testing

Run API regression tests:

```bash
cd apps/api
python -m pytest tests/test_transcript_fix.py tests/test_auth_security.py -v
```

---

## 📄 License

Proprietary — TechBee Internal Use Only

---

*Built with ❤️ for TechBee by the AI Interview Platform Team*

