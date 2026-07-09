# GrowEasy AI-Powered CSV CRM Importer

An intelligent CSV importer designed to extract and standardise CRM lead information from arbitrary CSV file layouts (e.g., Facebook Lead Ads, Google Ads Exports, Real Estate sheets, and manual spreadsheets) using Google Gemini or OpenAI LLMs.

---

## 🚀 Key Features

* **AI Field Mapping**: Maps messy, unstructured inputs dynamically to GrowEasy's target CRM lead schema.
* **Batch Processing Queue**: Groups CSV records in batches of 15 and processes them sequentially with a failure retry mechanism.
* **Real-time Progress Streaming**: Uses chunked NDJSON response streaming so the user sees lead mapping updates live in the dashboard.
* **Intelligent Data Sanitation**:
  * Extracts the first email/mobile number and appends duplicates to a consolidated `crm_note` field.
  * Splits combined telephone numbers into `country_code` and `mobile_without_country_code`.
  * Skips records containing neither email nor mobile.
* **Premium Dashboard**: Beautiful Glassmorphic UI supporting interactive drag-and-drop file upload, scrollable grid view with sticky headers, pagination, dark mode, sandbox testing samples, and clean CRM exports.
* **Zero-Config Evaluation Fallback**: Automatically falls back to a rule-based mock parser if no API keys are supplied, allowing instantaneous test runs without LLM setup.

---

## 🛠️ Project Structure

```
groweasy-csv-importer/
├── backend/                  # Node.js + Express API
│   ├── tests/                # Automated verification scripts
│   ├── aiService.js          # Google Gemini / OpenAI batch wrapper & Fallback parser
│   ├── server.js             # Express app & NDJSON stream route
│   ├── .env.example          # Template environment config
│   └── package.json          # Backend dependencies
└── frontend/                 # Next.js App Router Web Application
    ├── src/
    │   ├── app/
    │   │   ├── globals.css   # Tailored theme tokens & glassmorphic styles
    │   │   ├── layout.tsx    # App root shell
    │   │   └── page.tsx      # Main wizard & dashboard workspace
    │   └── components/
    │       └── ThemeToggle.tsx # Client dark mode controller
    └── package.json          # Frontend dependencies
```

---

## 💻 Setup & Run Instructions

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
* [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### 1. Run Express Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Configure your API keys in `.env` (optional, falls back to Mock engine if left blank):
   ```env
   PORT=5000
   LLM_PROVIDER=gemini # 'gemini' or 'openai'
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```
5. Start the server:
   ```bash
   npm start
   ```
   The backend will run on `http://localhost:5000`.

### 2. Run Next.js Frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## 🎯 Target CRM Lead Fields

The AI engine extracts the following standard fields:

| Field | Description | Constraints / Formats |
| :--- | :--- | :--- |
| `created_at` | Lead creation date | ISO 8601 or parseable javascript date |
| `name` | Lead full name | Combined if split in CSV |
| `email` | Primary email address | First email found. Duplicates mapped to note. |
| `country_code` | Telephone country calling code | e.g. `+91` or `+1` |
| `mobile_without_country_code` | Mobile number | Without country prefix. Duplicates mapped to note. |
| `company` | Business company name | |
| `city` | Locality/City | |
| `state` | State/Region | |
| `country` | Country | |
| `lead_owner` | Lead owner/account executive | |
| `crm_status` | Status code | `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE` |
| `crm_note` | Remarks, notes & overflow data | Contains extra emails, numbers & other attributes |
| `data_source` | Source attribution | `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` |
| `possession_time` | Property timeline | |
| `description` | Additional comment logs | |

---

## 🧑‍💻 Assignment Submission Details

* **Position Applied For**: Software Developer Intern
* **Candidate Mode**: Work From Home (WFH)
* **Joining**: Immediate
* **Submission Deadline**: 12 July 2026
* **Host URL**: [Provide your hosted application URL here]
* **GitHub Repository**: [Provide your repository URL here]
* **Submission Recipient**: varun@groweasy.ai
