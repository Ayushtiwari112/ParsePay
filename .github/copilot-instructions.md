# Copilot / AI Agent Instructions for Credit (Credit Card Statement PDF Parser)

Quick, focused guidance to get productive in this repository.

1. Big picture
- Full‑stack app: frontend (Vite + React) and backend (Node + Express + MongoDB).
- Backend parses uploaded PDF statements (pdf-parse) and stores a Statement document per upload.
- Data flow: frontend uploads PDF -> backend /api/statements/upload (multer) -> backend/utils/pdfParser.js extracts text and data -> saved in MongoDB via backend/models/Statement.js.

2. Key files to read first
- backend/server.js — app entry, HTTPS fallback, routes mounted
- backend/routes/statements.js — upload flow, multer config, cleanup, debug endpoints (/api/statements/:id/debug)
- backend/utils/pdfParser.js — provider detection, per‑provider parsers, HDFC is high priority and has special parsing logic
- backend/models/Statement.js — schema (note: rawText is stored but select: false)
- backend/middleware/auth.js & backend/routes/auth.js — JWT auth flow and token generation
- frontend/ (src/) — React components that call the API (AuthContext.jsx, Dashboard.jsx)

3. Important repo conventions & patterns
- Provider detection: pdfParser.detectProvider prioritizes HDFC. Do not reorder unless you understand HDFC fallbacks (see comments inside pdfParser.js).
- HDFC parsing: uses Indian DD/MM/YYYY parsing, multi‑stage regexes for cardLast4, billing cycle and uses "Total Dues" and "Minimum Amount Due" text. Changes here must be conservative.
- rawText is saved to DB but excluded by default (.select: false). Use the debug endpoint GET /api/statements/:id/debug to retrieve it for troubleshooting.
- When adding a new provider you must update three places: parser switch in backend/utils/pdfParser.js, allowed enum in backend/models/Statement.js, and any frontend UI/provider labels if displayed.

4. Developer workflows (commands)
- Backend (dev): cd backend; npm install; npm run dev (nodemon server.js)
- Generate self‑signed cert for local HTTPS: cd backend; npm run generate-cert
- Start backend in production mode: npm start
- Frontend (dev): cd frontend; npm install; npm run dev (Vite)

5. Upload / runtime constraints
- Multer upload limit: 10MB (backend/routes/statements.js)
- Only PDFs allowed (mimetype check in multer fileFilter)
- Uploaded files are temporarily saved to backend/uploads and removed after parse (fs.unlinkSync used in success and error paths)

6. Debugging tips
- The parser writes full extracted text to debug_pdf_text.txt at repo root (backend/utils/pdfParser.js). Inspect that file first to see how pdf-parse extracted text.
- Use router GET /api/statements/:id/debug to retrieve rawText from DB (requires authentication) for per‑statement debugging.
- Console logs in pdfParser.js deliberately print sections used to detect values (look for 'HDFC detected' logs and '=== EXTRACTED DATA ===').

7. Integration & dependencies
- pdf-parse — text extraction (backend/utils/pdfParser.js)
- multer — file upload handling (backend/routes/statements.js)
- mongoose — models in backend/models
- jsonwebtoken & bcryptjs — auth in backend/routes/auth.js and backend/middleware/auth.js

8. Safe edit checklist when changing parsing logic
- Add unit checks: capture debug_pdf_text.txt input and test regex locally before committing.
- If changing provider enum, update backend/models/Statement.js enum or expect validation errors on save.
- Preserve HDFC detection priority: many PDFs include the string "HDFC" in non‑statement contexts; the parser contains multiple heuristics — read comments before changing.

9. Where to add tests / future work
- No tests present. When adding tests, focus on small fixtures: sample extracted text (not binary PDFs) and run parser functions directly (unit tests for detectProvider and provider parsers).

If anything in these instructions is unclear or you want more detail (example test fixtures, common failing PDF examples, or a checklist for adding a new provider), tell me which section to expand.
