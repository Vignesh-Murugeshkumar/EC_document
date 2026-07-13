# 🚀 EC Analyser: AI-Powered Property Title Auditor

EC Analyser is an advanced AI-powered legal audit engine that converts unstructured, complex **Encumbrance Certificates (ECs)** into structured, verified, and easy-to-understand property title reports in under a minute. 

Homebuyers, real estate developers, and financial institutions can upload an EC PDF to a secure dashboard to instantly reconstruct ownership chains, flag hidden legal liabilities, and verify title safety.

---

## 📐 System Architecture

EC Analyser is built on a modern, decoupled serverless architecture designed for high availability, low cost, and computational scale.

```
                  ┌──────────────────────────────┐
                  │      Next.js Frontend        │
                  │        (Vercel App)          │
                  └──────────────┬───────────────┘
                                 │ HTTP / JSON
                                 ▼
                  ┌──────────────────────────────┐
                  │      FastAPI Backend         │
                  │     (Vercel Serverless)      │
                  └──────────────┬───────────────┘
                                 │ SQL / REST
                                 ▼
                  ┌──────────────────────────────┐
                  │     Supabase Platform        │
                  │   (Auth, DB, S3 Storage)     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼ (15s Cron Task)
                  ┌──────────────────────────────┐
                  │    Modal Queue Processor     │
                  │  (Serverless Workers Engine) │
                  └──────────────┬───────────────┘
                                 │
       ┌─────────────────────────┴─────────────────────────┐
       ▼ (Short Documents)                                 ▼ (Long Documents > 20 Tx)
┌──────────────────────────────┐                    ┌──────────────────────────────┐
│   LangGraph Multi-Agent      │                    │    Rolling Batch-Reduce      │
│  (Stateful LLM Graph)        │                    │   (gpt-4o-mini + gpt-4o)     │
└──────────────────────────────┘                    └──────────────────────────────┘
```

---

## ✨ Core Features

* **Interactive Ownership Timeline:** A clean, chronologically reconstructed chain of custody showing exactly who owned the property, when, and how custody was transferred.
* **Risk & Anomaly Audits:** Automatic flagging of legal issues, categorized by severity (*High, Medium, Low*) such as active mortgages, court injunctions, or breaks in chain of title.
* **Property Safety Score:** An algorithmic risk index from 0 to 100 calculated based on the frequency and severity of flagged anomalies.
* **Regional Language Translation:** Translate legal terminology and certificate summaries into major regional Indian languages (Hindi, Tamil, Telugu, Kannada, etc.).
* **Bank-Ready PDF Exports:** Instant generation of beautifully formatted, print-ready PDF title reports.
* **Paywall-at-Boundary Redaction:** Restricts free-tier users to basic property summary views while dynamically obfuscating name databases and advanced anomaly reports until upgrading to Premium.

---

## 🛠️ Tech Stack

* **Frontend:** Next.js 14, TailwindCSS (for sleek, responsive design system), Lucide Icons
* **Backend:** FastAPI, Python 3.12, PyJWT
* **Database & Auth:** Supabase PostgreSQL, Supabase GoTrue Auth (Native SMTP Magic Link / OTP)
* **Worker & Pipeline:** Modal Labs (serverless container workloads), Microsoft MarkItDown, PyPDF2
* **LLM & Orchestration:** OpenAI API (GPT-4o, GPT-4o-mini with Structured Outputs), LangGraph

---

## 📦 Directory Structure

```text
├── api/                  # FastAPI Serverless Backend
│   ├── main.py           # Core API router, middleware, and handlers
│   └── requirements.txt  # Backend Python dependencies
├── backend/              # Local server launch configuration
│   └── main.py           # Uvicorn launcher importing API package
├── frontend/             # Next.js Frontend Application
│   ├── src/app/          # App router pages (dashboard, subscription, etc.)
│   └── next.config.js    # Rewrites for routing /api/* to local backend
├── supabase/             # Database Setup & Migrations
│   ├── schema.sql        # Database tables, triggers, and RLS policies
│   └── seed.sql          # Test user seeding commands
├── worker/               # Asynchronous AI worker tasks running on Modal
└── vercel.json           # Vercel deployment and routing rules
```

---

## 🗄️ Database Schema & RLS

The database is built on Supabase PostgreSQL. Below are the key tables defined in `supabase/schema.sql`:

1. **`public.profiles`**: Contains user metadata, roles (`user`, `admin`), and billing plans (`free`, `premium`).
2. **`public.documents`**: Traces the status of uploaded PDFs (`pending`, `processing`, `completed`, `failed`) and stores the AI analysis output.
3. **`public.audit_logs`**: Logs document events, uploads, and subscriptions for monitoring and security.

---

## 🚀 Setup & Installation

### 1. Backend Environment Variables
Create a `.env` file in the root folder of the project:
```ini
# Supabase Configuration
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key

# Billing Promo Code (For Hackathon/Testing Bypass)
PROMO_CODE=VICKY100
```

### 2. Frontend Local Run
Navigate to `frontend/` and start the Next.js development server:
```bash
cd frontend
npm install
npm run dev
```
*(Runs on `http://localhost:3000`)*

### 3. Backend Local Run
Ensure you have created and activated your Python virtual environment, installed dependencies, and start the Uvicorn server:
```bash
# Install dependencies
.venv/bin/pip install -r api/requirements.txt

# Run server
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
```
*(Runs on `http://localhost:8000`)*

---

## 🏆 Hackathon Testing & Billing Bypass

To make testing the Premium Plan as simple as possible for judges without configuring payment gateways, we built a **Promo Code Bypass**:

1. Log in to the application at [https://ecaidocument.vercel.app/](https://ecaidocument.vercel.app/).
2. Navigate to the **Subscription Center** by clicking **Upgrade** in the top navigation bar.
3. Enter the promo code **`VICKY100`** in the **Have a Promo Code?** field inside the Premium card.
4. Click **Apply** to instantly upgrade your account to the **Premium Tier** for free!