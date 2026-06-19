# StylePrint

StylePrint is a prototype for extracting design facets from UI reference screenshots, mixing style choices across references, and generating React + Tailwind UI code.

The app is split into a **Vite React frontend** and a **Fastify TypeScript backend**.

## Quick Links

- Production website: https://style-print.vercel.app/
- Local web app: http://localhost:5173
- Local API health check: http://localhost:4000/health

## What It Does

StylePrint helps turn visual UI references into reusable generation inputs:

- Upload UI reference screenshots.
- Extract design facets such as color, typography, layout, spacing, component style, and mood.
- Choose or recommend recipes that combine facets from multiple references.
- Evaluate intent coherence, conflicts, and possible repairs.
- Generate React + Tailwind UI code through v0.
- Build preview artifacts and compare generated output against the intended style.

## Project Structure

```text
apps/
  web/        Vite + React + TypeScript frontend
  api/        Fastify + TypeScript API server
packages/
  shared/     shared frontend/backend TypeScript types
data/         local JSON storage
public/
  uploads/    uploaded reference images
```

## Development Workflow

Branches follow this flow:

```text
main -> dev -> feature/*
```

- `main`: stable branch.
- `dev`: integration branch for active development.
- `feature/*`: feature or issue-specific work.

Recommended workflow:

1. Create or identify the GitHub Issue for the task.
2. Create a `feature/*` branch from `dev`.
3. Implement the feature.
4. Run `npm run typecheck`.
5. Run `npm run build` when the change affects broader frontend/backend behavior.
6. Open a PR from `feature/*` to `dev`.
7. Keep planning docs, weekly deliverables, and agent workflow notes in the GitHub Wiki.

## Local Setup

Install dependencies and create a local environment file:

```bash
cd /Users/Owner/hcclab/style-print-jung
npm install
cp .env.local.example .env.local
```

Add real API keys to `.env.local` in the project root.

Start both the frontend and backend:

```bash
npm run dev
```

Then open the web app and check the API:

```bash
open http://localhost:5173
curl http://localhost:4000/health
```

You can also run the API and web app in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

## Environment Variables

The local environment file lives at:

```text
/Users/Owner/hcclab/style-print-jung/.env.local
```

Create it from the example file if it does not exist:

```bash
cp .env.local.example .env.local
```

Expected values:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_JUDGE_MODEL=gpt-4.1-mini
V0_API_KEY=...
V0_MODEL=v0-mini
API_PORT=4000
WEB_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=
```

`OPENAI_API_KEY` and `V0_API_KEY` are required. If either key is missing, or if an external API call fails, the relevant API request fails instead of falling back to mock data.

`OPENAI_JUDGE_MODEL` is optional. Use it to separate the coherence judge model from the main `OPENAI_MODEL`; if it is not set, the API uses `OPENAI_MODEL`.

`WEB_ORIGIN` accepts multiple frontend origins separated by commas. For example:

```env
WEB_ORIGIN=https://style-print.vercel.app,https://style-print-git-dev.vercel.app
```

## Core Flow

1. The web app uploads reference images as `multipart/form-data`.
2. The API stores images in `public/uploads` and records file URL, MIME type, width, and height metadata in `data/references.json`.
3. The API extracts palette, semantic color roles, and contrast information with `sharp` and rule-based color analysis.
4. The OpenAI Responses API analyzes typography, layout, spacing, component style, and mood keywords from the same reference.
5. Recipe recommendation or manual recipe selection creates an `IntentSpec`; selected facet provenance, source mood, and confidence are normalized into `styleContext`.
6. The API runs rule-based coherence evaluation and can add an OpenAI judge evaluation in `off`, `shadow`, or `primary` mode.
7. The UI generation brief, screen plan, and variant count are saved in `IntentSpec.generationBrief` and passed into the v0 prompt.
8. v0 generation runs as an async job. `/api/generate/v0` returns a job ID, and the web app polls `/api/generate/jobs/:jobId` for generated code and preview URLs.
9. The API builds preview artifacts locally and stores a Playwright screenshot when available.
10. OpenAI audit extracts facets from generated code and stores an intent comparison report with provenance badges.

## API Routes

| Endpoint | Method | Description |
| --- | --- | --- |
| `/health` | `GET` | Check API status. |
| `/uploads/:filename` | `GET` | Serve uploaded images. |
| `/generated-previews/:previewId/:filename` | `GET` | Serve generated preview artifact files. |
| `/api/references/upload` | `GET` | List references. |
| `/api/references/upload` | `POST` | Upload a multipart reference image. |
| `/api/references/upload?id=...` | `DELETE` | Delete a reference. |
| `/api/facets/extract` | `POST` | Extract facets from a reference. |
| `/api/intents/create` | `POST` | Create an intent from a selected recipe. |
| `/api/recipes/recommend` | `POST` | Recommend recipes from a facet pack. |
| `/api/intents/evaluate` | `POST` | Evaluate intent coherence and conflicts, then save repair suggestions. `judgeMode` can be `off`, `shadow`, or `primary`. |
| `/api/intents/apply-repair` | `POST` | Apply a repair suggestion. |
| `/api/coherence/feedback` | `POST` | Save feedback for coherence judge results. |
| `/api/generate/v0` | `POST` | Create a v0 UI generation job. Only `single` mode is currently supported. |
| `/api/generate/jobs/:jobId` | `GET` | Read generation job status and result. |
| `/api/preview/build` | `POST` | Build preview artifacts from generated code. |
| `/api/audit/analyze` | `POST` | Audit generated code. If `generatedCodeId` is provided, link the audit to that report. |

## Implementation Notes

- Reference extraction uses rule-based color analysis and OpenAI LLM analysis for typography, layout, spacing, component style, and mood.
- LLM prompts receive palette and asset dimensions so they do not over-infer layout from non-UI assets.
- v0 prompts receive normalized facets, exact palette usage, source mood/confidence, user brief, screen plan, and variant count.
- v0 generation currently produces one default-export React component.
- `GenerationMode` still includes `staged`, but the server does not implement staged generation yet. `/api/generate/v0` rejects staged requests with `400`.
- Missing API keys or failed external API calls do not produce demo/mock results.

## Verification

Run focused checks during development:

```bash
npm run typecheck
npm run test
npm run build
npm run regression:intents
npm run agreement:coherence
```

`npm run build` runs backend/frontend type checks and then builds the Vite app for production.

`npm run regression:intents` compares saved intent coherence reports for regressions.

`npm run agreement:coherence` outputs a Markdown report comparing rule evaluator results, OpenAI judge results, and human feedback expected scores.

Run the deployment smoke check with:

```bash
npm run smoke:deploy
```

To smoke check specific deployed URLs, pass them as environment variables:

```bash
SMOKE_API_BASE_URL=https://style-print-jung-api.up.railway.app \
SMOKE_WEB_BASE_URL=https://style-print.vercel.app \
npm run smoke:deploy
```

## Current Limitations

- OpenAI and v0 API calls require valid API keys.
- Staged generation is represented in shared types but is not implemented on the server.
- Storage is JSON-file based; multi-user or production deployments need a database and durable object storage such as SQLite/PostgreSQL plus S3/R2.
- Authentication and per-user data isolation are not implemented yet.
