# PhysioAI — AI-Assisted Rehabilitation Platform

Real-time pose-guided rehabilitation using MoveNet + TensorFlow.js. Ghost skeleton overlay, automatic rep counting, ROM tracking. Fully local — **no cloud services required**.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | **SQLite** via `better-sqlite3` (local file, zero config) |
| Pose Detection | MoveNet via TensorFlow.js + WebGL |
| AI Feedback | Google Gemini Flash (free tier) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State | Zustand |

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Set your Gemini key (optional — falls back to rule-based if skipped)
cp .env.local.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**That's it.** The SQLite database (`physioai.db`) is created automatically on first run with demo data already seeded.

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Therapist | therapist@physioai.dev | demo |
| Patient | patient@physioai.dev | demo |

---

## Database

SQLite file lives at `./physioai.db` in the project root. Auto-created and migrated on first `npm run dev`. Delete it to reset everything.

### Schema

| Table | Purpose |
|-------|---------|
| `users` | All users (therapist/patient role + password) |
| `therapists` | Therapist profile extension |
| `patients` | Patient profile + therapist link |
| `categories` | Hierarchical body/injury taxonomy (seeded) |
| `exercises` | Exercise library with steps (JSON col) |
| `patient_assignments` | Exercise assignments (sets/reps/duration) |
| `exercise_sessions` | Completed session logs with accuracy + ROM |

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/users` `{action:'login'}` | Login, sets session cookie |
| POST | `/api/users` `{action:'register'}` | Register new user |
| POST | `/api/users` `{action:'logout'}` | Clear session cookie |
| GET | `/api/users?action=me` | Current user from cookie |
| GET | `/api/exercises` | List all exercises |
| POST | `/api/exercises` | Create exercise |
| DELETE | `/api/exercises?id=...` | Delete exercise |
| GET | `/api/patients?therapist_id=...` | List patients |
| POST | `/api/patients` | Add patient |
| GET | `/api/assignments?patient_id=...` | Patient's assignments |
| POST | `/api/assignments` | Assign exercise |
| GET | `/api/sessions?patient_id=...` | Session history |
| POST | `/api/sessions` | Log completed session |
| POST | `/api/feedback` | Gemini AI coaching feedback |
| GET | `/api/categories` | Exercise category tree |

---

## Project Structure

```
physioai/
├── physioai.db                         # ← auto-created SQLite DB
├── lib/
│   ├── db.ts                           # SQLite connection + schema + seed
│   ├── pose-detector.ts                # MoveNet (TF.js)
│   ├── skeleton-renderer.ts            # Canvas drawing
│   ├── pose-math.ts                    # Angle math, rep state machine
│   └── session-store.ts                # Zustand live session state
├── app/
│   ├── api/
│   │   ├── users/route.ts              # Auth (login/register/me)
│   │   ├── exercises/route.ts          # CRUD
│   │   ├── assignments/route.ts        # CRUD
│   │   ├── sessions/route.ts           # Log + read sessions
│   │   ├── patients/route.ts           # Patient management
│   │   ├── categories/route.ts         # Category tree
│   │   └── feedback/route.ts           # Gemini Flash
│   ├── therapist/                      # Therapist pages
│   └── patient/                        # Patient pages
└── types/index.ts
```

---

## Gemini API Key (Free)

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API key** — instant, no credit card
3. Add to `.env.local` as `GEMINI_API_KEY=AIza...`

Without a key the app still works — it uses rule-based feedback instead.
