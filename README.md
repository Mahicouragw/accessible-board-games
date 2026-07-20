# ♿ Accessible Board Games — Full Stack + APK

**Live:** https://accessible-board-games.vercel.app/ — **GitHub:** https://github.com/Mahicouragw/accessible-board-games

Fully accessible, multiplayer board games with cloud database + Android APK.

## ✅ Fixed — All Errors Resolved

- ✅ Next.js 14.2.5 stable (was invalid 16.2.6)
- ✅ Live cloud multiplayer via **Supabase PostgREST** (no DATABASE_URL needed on the host) — one-time `supabase-setup.sql`
- ✅ DATABASE_URL mock fallback — builds without DB, single-player games always work
- ✅ `next.config.ts` → `.js`, Tailwind v4 → v3, ESLint flat → json
- ✅ `Cannot read properties of undefined (reading 'code')` fixed via guest player
- ✅ Client exception on `/play/[game]` fixed (removed `use(params)` Next 15 API)
- ✅ Vercel 404 fixed — now 200 LIVE, extracted source (was ZIPs)
- ✅ Icons generated: 192, 512, maskable, apple-touch, favicon
- ✅ Games functional: Ludo, Carrom, Snake Ladder, 2048, Memory, Snake, RPS, Chess, TicTacToe

## 🎮 Games (10+)

Ludo, Carrom, Snake & Ladder, Chess, Tic-Tac-Toe, Connect Four, Memory, 2048, Rock Paper Scissors, Snake + Rooms, Voice, Chat, Leaderboard.

## ♿ Accessibility

High Contrast toggle, Font Size A+/A-, Skip Link, Screen Reader live regions, Keyboard Tab+Enter, Focus 3px amber, ARIA grids.

## 🗄️ Database — Cloud Storage for Multiplayer

**Essential for multiplayer, chat, rooms, scores, cloud saves.**

### Quick Setup (Neon Free Postgres):

1. https://neon.tech → Create project `accessible-board-games` → Copy connection string
2. Vercel → Project → Settings → Environment Variables → Add `DATABASE_URL` = your Neon URL
3. Locally: Create `.env` file from `.env.example`, paste URL
4. Push schema:
   ```bash
   npm install --legacy-peer-deps
   npm run db:push
   ```
5. Redeploy Vercel → Multiplayer live!

See `DATABASE_SETUP.md` for detailed guide (Vercel Postgres, Supabase, etc).

**Without DB:** App runs in demo/guest mode — single-player works, no crash. Auth creates guest in `localStorage`.

- Local: `arcade_player_code`, `arcade_guest_player` in localStorage
- Cloud: When DB set, `/api/scores`, `/api/player`, rooms, messages sync to Postgres

## 📱 APK — Real Android App

### Get APK in 1 Click (No Android Studio):

1. GitHub → https://github.com/Mahicouragw/accessible-board-games → **Actions** tab → **Build APK** → Run workflow
2. Wait 5-10 min → Download artifact **app-debug-apk**
3. Install on Android: Transfer → Tap → Allow unknown sources → Install

APK can load live Vercel site or offline static (config in `capacitor.config.ts`).

### Build Locally:

```bash
npm install --legacy-peer-deps
npm run icons:generate   # Generate PNG icons from SVG
npm run build
npx cap add android      # First time
npx cap copy
npx cap sync
npx cap open android     # Open Android Studio → Build APK
# Or: npm run apk:build (needs Android SDK)
```

See `APK_GUIDE.md` for PWABuilder, Play Store publishing, future features.

## 🚀 Deploy

**GitHub Public:** Already public at `Mahicouragw/accessible-board-games`

**Vercel:** Import repo → Add `DATABASE_URL` env (optional) → Deploy → Live at https://accessible-board-games.vercel.app

**Build Test:**
```bash
npm install --legacy-peer-deps
npm run build
# ✓ Compiled successfully, 5 static + 21 dynamic routes
```

## 📂 Structure

```
src/
├── app/ (page, layout, play/[game], rooms/[id], api/* 21 routes)
├── components/ (AccessibilityToolbar, games/*, room/*)
├── db/ (index.ts with mock fallback, schema.ts)
├── lib/ (session with guest fallback, games, sound, a11y)
public/icons/ (icon.svg, icon-192.png, icon-512.png etc)
capacitor.config.ts (APK config)
scripts/generate-icons.js (PNG from SVG)
.github/workflows/ (deploy.yml, apk.yml)
```

## 🔮 Future Features (You Asked)

- Add new game: Create in `src/components/games/NewGame.tsx` → Add to `src/lib/games.ts` → Route in `play/[game]/page.tsx`
- Cloud saves: Already via `useSaveScore` → `/api/scores` when DB set
- More APK native features: Push notifications, haptics, filesystem — via Capacitor plugins
- After adding features: Push to GitHub → Vercel auto-deploys web → Re-run APK workflow → New APK

## License

MIT — Accessible for everyone.
# Fresh deployment Fri Jul 17 16:28:22 UTC 2026
# Fresh deployment 2 - 2026-07-17T17:43:47Z - Fix redeploy error
