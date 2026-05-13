# Authority Gap Engine — Frontend

React 18 + Vite + TypeScript + Tailwind. Talks to the Node backend in `../backend`.

## Quick start

```bash
npm install
cp .env.example .env       # fill in VITE_API_BASE_URL
npm run dev                # http://localhost:8080
```

If `VITE_API_BASE_URL` is empty, the app runs in **mock mode** (no backend required).

## Scripts

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `npm run dev`    | Vite dev server                  |
| `npm run build`  | Production build → `dist/`       |
| `npm run preview`| Preview the production build     |
| `npm test`       | Vitest unit tests                |

## File tree

```
frontend/
├── public/                    Static assets served as-is
├── src/
│   ├── assets/                Images, logos, illustrations
│   ├── components/            Reusable UI
│   │   ├── landing/           Landing-page sections
│   │   └── ui/                shadcn/ui primitives
│   ├── hooks/                 React hooks (useAuth, useToast, …)
│   ├── integrations/
│   │   └── supabase/          Auto-generated client + types
│   ├── lib/                   API clients, scoring, mocks, utils
│   ├── pages/                 Route components
│   ├── test/                  Vitest setup + examples
│   ├── types/                 Shared TS types (scan report contract)
│   ├── App.tsx                Routes
│   ├── main.tsx               Entry point
│   └── index.css              Design tokens (HSL semantic vars)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```
