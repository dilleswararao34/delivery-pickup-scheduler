# SD Digitals — Ops Scheduler
## Quick Start Guide

Open **two PowerShell terminals** in the project root.

### Terminal 1 — Frontend
```powershell
cd frontend
npm install
npm run dev
# Vite starts at http://localhost:5173
```

### Terminal 2 — Backend (requires PostgreSQL)
```powershell
cd backend
npm install
copy .env.example .env   # then fill in DB credentials
npm run migrate          # creates tables
npm run seed             # seeds production equipment catalog
npm run seed:dev         # seeds development fixtures (bookings, alerts, customers)
npm run dev              # Express starts at http://localhost:3001
```

### Open the app
Navigate to **http://localhost:5173**

