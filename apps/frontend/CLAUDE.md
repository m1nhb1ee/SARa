# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SARa** (Smart AI Radiology) — a Vietnamese medical radiology training platform where users practice reading X-Ray/CT/MRI cases and receive AI-scored feedback. The frontend is a React 18 + TypeScript SPA, backed by a Django REST API at `../backend`.

## Commands

```bash
npm run dev      # Start Vite dev server at http://localhost:5173
npm run build    # Production build
```

No lint or test scripts are configured.

**Backend** (sibling app, run separately):
```bash
cd ../backend
python manage.py runserver 0.0.0.0:8000
```

Vite proxies `/api` → `http://localhost:8000` during development, so the frontend calls `/api/...` in dev without CORS issues.

**Environment:** Copy `.env.example` → `.env`. The only variable is `VITE_API_URL` (defaults to `http://localhost:8000/api/v1`).

## Architecture

### Routing (`src/app/routes.tsx`)
React Router v7. `/login` and `/register` are public. All other routes are nested under `Root`, which redirects unauthenticated users to `/login`.

```
/login, /register          → public pages
/                          → Root (auth guard + Sidebar layout)
  index → Dashboard
  home → WelcomePage
  upload → UploadPage
  practice → PracticePage
  training/:caseId → DiagnosisTrainingPage
  session/:caseId  → DiagnosisSession
  answer-key/:caseId → AnswerKey
  performance → Performance
  * → ComingSoon
```

### Auth (`src/api/auth.ts`, `src/api/authContext.tsx`)
- `AuthProvider` (React Context) wraps the entire app in `App.tsx`
- Token stored in `localStorage` under key `sara_token`; user state under `sara_auth_state` and `sara_user`
- On app load, `GET /auth/me/` validates the stored token

### API Layer (`src/api/`)
- **`client.ts`** — singleton `apiClient` (plain `fetch`, no axios). Reads `sara_token` from localStorage and adds `Authorization: Bearer <token>` header automatically.
- **`hooks.ts`** — custom `useQueryState` + `useMutationState` hooks that mirror React Query's interface (`{ data, loading, error }`). No React Query or SWR is used.
- All API calls go to `/api/v1/...` endpoints (cases, sessions, performance, auth, uploads).

### State Management
- **Global:** React Context for auth only
- **Server state:** Custom hooks in `src/api/hooks.ts` — `useCases()`, `useCaseDetail()`, `useSessions()`, `useSessionDetail()`, `useMyStats()`, `useCreateSession()`, `useSubmitAnswer()`, `useExitSession()`, `useGetAnswerKey()`
- **Local UI state:** `useState` inside individual page components

### Styling
The app uses a **hand-drawn medical notebook aesthetic** (sketch borders, pencil filters, warm parchment colors).

- **Tailwind CSS 4** — utility classes (configured via `@tailwindcss/vite`, no `tailwind.config.js`)
- **Material-UI** — some component primitives
- **Radix UI + Shadcn/ui** — accessible primitives in `src/app/components/ui/`
- **Emotion** — for MUI's CSS-in-JS
- Theme (light/dark) toggled in `Root.tsx`, stored in `localStorage`, applied via `data-theme` attribute on `<html>`

Key style constants live in `src/constants/styles.ts` (`difficultyStyle`, `modalityStyle`, `scoreColor()`, `scoreLabel()`).

### Path Alias
`@` maps to `./src`. Use `import Foo from '@/app/components/...'`.

## Key Types (`src/types/index.ts`)

```ts
CaseItem       // id, title, modality ('X-Ray'|'CT'|'MRI'), difficulty, hint, status, imageKey
FeedbackResult // score, passed, feedback, errors, hint, next_step, session_complete
```

## Conventions

- Vietnamese strings are hardcoded throughout — no i18n library. Match the language of surrounding UI when adding new strings.
- Difficulty labels: `'Cơ bản'` / `'Trung bình'` / `'Nặng cao'`
- Shared reusable components go in `src/app/components/shared/`; Shadcn primitives go in `src/app/components/ui/` (do not hand-edit generated Shadcn files directly unless fixing a bug)
- New API methods belong in `src/api/client.ts`; expose them via a hook in `src/api/hooks.ts` following the existing `useQueryState` / `useMutationState` pattern
