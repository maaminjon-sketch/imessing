# iMessing вЂ” Real-time Chat Application

A modern, feature-rich messaging app built with React, TypeScript, Hono, tRPC, and Drizzle ORM. Includes private/group chats, voice calls, file sharing, and Google Drive backup integration.

## Features

вњЁ **Core:** рџ’¬ Private/group chats вЂў рџ“ћ Voice calls вЂў рџ“Ѓ File upload вЂў рџЋ¤ Voice messages вЂў рџ”” Read receipts вЂў рџ”ђ JWT auth

рџ†• **Google Drive Backup:** рџ”— OAuth 2.0 вЂў рџ’ѕ Export history to Drive вЂў вљ™пёЏ Backup settings in preferences

## Tech Stack

**Frontend:** React 19, TypeScript, TailwindCSS, Vite, tRPC  
**Backend:** Hono, tRPC, JWT, bcryptjs  
**Database:** MySQL + Drizzle ORM  
**Infrastructure:** Railway

## Quick Start

```bash
git clone https://github.com/maaminjon-sketch/imessing.git
cd imessing
npm install
cp .env.example .env
npm run db:push
npm run dev
```

## Environment Setup

```env
# Required
APP_ID=imessing
APP_SECRET=your-secret-key
DATABASE_URL=mysql://...
KIMI_AUTH_URL=https://...
KIMI_OPEN_URL=https://...

# Optional: Google Drive Backup
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain/api/google-drive/callback
```

Setup: Google Cloud Console в†’ Enable Drive API в†’ OAuth 2.0 credentials в†’ Add redirect URI

## Deployment (Railway)

Connect GitHub repo в†’ Add MySQL в†’ Set env vars в†’ Deploy (reads `railway.json`)

## Project Structure

```
api/               # tRPC + HTTP routes
в”њв”Ђв”Ђ chat-router.ts # Chat + Google Drive
db/                # Drizzle schema & migrations
src/               # React frontend
в”њв”Ђв”Ђ pages/Home.tsx # Main UI + Google Drive setup
```

## Scripts

```bash
npm run dev      # Dev server
npm run build    # Production build
npm start        # Run server
npm run db:push  # Apply schema
```

## License

MIT

