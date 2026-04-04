# LeadCraft - Automated Email Enrichment

Upload a CSV with contact data and automatically find missing email addresses using multiple data sources.

## Architecture

```
frontend/ (Next.js + Tailwind CSS)
  - Drag-and-drop CSV upload
  - Real-time progress tracking
  - Preview enriched rows before download

backend/ (Express + BullMQ)
  - CSV parsing with column preservation
  - Job queue for async processing
  - 5 enrichment providers with fallback logic
  - Email validation (regex + optional SMTP verification)
```

## Enrichment Providers (in priority order)

1. **Apollo** - People search API
2. **Clay** - API or webhook enrichment
3. **Hunter.io** - Email finder by name + domain
4. **RocketReach** - Professional email lookup
5. **Web Scraping** - Company website scraping + email pattern generation

## Prerequisites

- **Node.js** 18+
- **Redis** (required for BullMQ job queue)
  - Install: `brew install redis` (Mac) or download from https://redis.io
  - Or use Docker: `docker run -d -p 6379:6379 redis:alpine`

## Setup

### 1. Clone and install dependencies

```bash
# Backend
cd backend
cp .env.example .env
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure API keys

Edit `backend/.env` and add your API keys:

```env
APOLLO_API_KEY=your_key_here
HUNTER_API_KEY=your_key_here
ROCKETREACH_API_KEY=your_key_here
CLAY_API_KEY=your_key_here
```

At minimum, configure **one** provider. The app will skip unconfigured providers automatically.

### 3. Start Redis

```bash
redis-server
```

### 4. Start the application

Open **three terminals**:

```bash
# Terminal 1: Backend API server
cd backend
npm run dev

# Terminal 2: Background worker (processes enrichment jobs)
cd backend
npm run dev:worker

# Terminal 3: Frontend
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.

## Usage

1. Prepare a CSV file with columns for:
   - **Name** (e.g., `first_name`, `last_name` or `name`)
   - **Company** (e.g., `company`, `organization`)
   - **Domain** (e.g., `domain`, `website`) — optional but improves accuracy
   - **Email** (e.g., `email`) — rows with empty values will be enriched

2. Drag and drop your CSV file onto the upload area
3. Watch real-time progress as emails are found
4. Preview enriched rows with confidence scores and provider info
5. Download the enriched CSV

## CSV Handling Rules

- Column names, row order, and existing data are **never modified**
- Only empty email cells are filled
- If no email is found, the cell stays empty
- The output CSV is structurally identical to the input

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `ENRICHMENT_MODE` | `sequential` | `sequential` (fallback chain) or `parallel` (all at once, pick best) |
| `MAX_CONCURRENT_ROWS` | `10` | How many rows to process simultaneously |
| `PROVIDER_TIMEOUT_MS` | `15000` | Timeout per provider API call (ms) |
| `UPLOAD_MAX_SIZE_MB` | `50` | Maximum upload file size |

## Sample CSV

A sample CSV is included at `backend/sample.csv` for testing.
