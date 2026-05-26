# Backend (Express + MongoDB)

## Setup

```bash
npm install
cp .env.example .env.local
```

## Dev

```bash
npm run dev
```

Runs on http://localhost:3001

## Vercel deploy

- **Root Directory:** `backend`
- **Env:**
  - `MONGODB_URI`
  - `ADMIN_SECRET`
  - `CORS_ORIGIN` = your frontend URL(s), comma-separated  
    e.g. `https://fifa-frontend.vercel.app,http://localhost:5173`
