# Agent Notes

- Architecture: `apps/web` is the Vite React frontend, `apps/api` is the Fastify backend, and `packages/shared` contains shared TypeScript types.
- Run locally with `npm run dev`. Web uses `http://localhost:5173`; API uses `http://localhost:4000`.
- Verify changes with `npm run typecheck` and `npm run build`.
- Keep API routes compatible with the existing `/api/...` paths because the web app proxies those paths to Fastify.
- Local runtime data lives in `data/*.json` and uploaded files live in `public/uploads`; do not treat them as source fixtures unless explicitly asked.
- Prefer updating shared contracts in `packages/shared/src/types.ts` before duplicating frontend/backend types.
