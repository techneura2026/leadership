# Frontend Conventions

All Next.js frontend code follows these conventions.

---

## Routing

Use Next.js App Router. Route groups organise the layout hierarchy without affecting URLs.

```
app/
├── (public)/           # No auth: landing, pricing, register
├── (auth)/             # Auth pages: login, reset-password
├── (onboarding)/       # Post-registration setup wizard
├── (app)/              # Protected: all dashboard/assessment pages
└── rater/[token]/      # Public rater interface (no auth, no shell)
```

**Middleware** (`src/middleware.ts`) enforces route protection using the presence of the `refresh_token` HttpOnly cookie as a proxy signal. Actual access token validation always happens server-side at the API.

---

## Server vs. Client Components

Default to **Server Components** for:
- Pages that fetch initial data
- Static UI (headings, layout)
- Report preview pages

Use `'use client'` only for:
- Interactive elements with `useState` / `useEffect`
- Components that use browser APIs
- Assessment rating interfaces (must be interactive)

```typescript
// Good: page fetches data as server component, passes to client
// app/(app)/assessments/[id]/page.tsx
export default async function AssessmentPage({ params }) {
  const assessment = await fetchAssessment(params.id);  // server-side
  return <AssessmentDetail assessment={assessment} />;   // client component
}
```

---

## Data Fetching

- **Server Components:** Use `fetch` with Next.js caching, or call the API client directly from server actions
- **Client Components:** Use `useSWR` with the Axios API client from `src/lib/api.ts`
- **Mutations:** Use Next.js Server Actions or direct API calls — not `getServerSideProps` / `getStaticProps` (App Router)

---

## State Management

Use **Zustand** for client-side global state. Rules:
1. Only store what cannot be derived from the URL or fetched data
2. Auth state (access token, current user, current org) lives in `auth.store.ts`
3. Assessment draft state (wizard progress) lives in `assessment.store.ts`
4. Never store server data in Zustand — use SWR cache for that

---

## API Client

All API calls go through `src/lib/api.ts` (Axios instance):
- Automatically adds `Authorization: Bearer <token>` header
- On 401: attempts token refresh, then retries original request
- On refresh failure: clears auth state, redirects to `/login`

```typescript
import { api } from '@/lib/api';

// In a client component
const { data } = useSWR('/assessments', () => api.get('/assessments').then(r => r.data));
```

---

## Component Structure

```
components/
├── ui/              # shadcn/ui base components — do not modify directly
├── assessment/      # Domain-specific: RatingScale, CompetencyCard, SjtScenario
├── charts/          # Recharts wrappers: RadarChart, HeatmapGrid, NineBoxGrid
├── reports/         # Report display components
└── layout/          # Sidebar, Header, PageHeader
```

One component per file. File name = component name in PascalCase.

---

## Styling

Tailwind CSS only. No CSS modules, no styled-components.

- Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes
- Colour tokens map to the organisation's `primaryColour` via CSS custom properties
- Responsive breakpoints: mobile-first. Assessment interfaces must be tested on 375px width.

---

## i18n

Use `next-intl`. Translation files live in `src/i18n/`.

```
i18n/
├── en.json     # English (default)
├── si.json     # Sinhala
└── ta.json     # Tamil
```

All participant-facing and rater-facing text must be internationalised. Admin UI is English-only for Phase 0.

---

## Forms

Use `react-hook-form` + `zod` for all forms:
- Validation schema defined with Zod (type-safe, shared with `shared/` types where possible)
- No inline form validation logic
- Error messages sourced from translation files

---

## Assessment Interface Rules

The rater and participant assessment interfaces have strict UX constraints:
1. Mobile-first — minimum 375px width, 44px touch targets
2. One question or one competency cluster per screen (no scrolling through all questions)
3. Progress is auto-saved on every answer — never lost on tab close
4. Timer (SJT only) rendered in a fixed position, not inline
5. No navigation away without confirmation if responses are partially entered
