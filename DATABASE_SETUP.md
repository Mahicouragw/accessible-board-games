# 🗄️ Database Setup — Cloud Storage for Multiplayer & Saves

Your app now supports **real cloud database** for multiplayer, chat, rooms, scores, and cloud saves. When `DATABASE_URL` is set, it uses PostgreSQL. When not set, it runs in **demo/single-player mode** with guest accounts (no crash).

## Option 1: Neon — Free Cloud Postgres (Recommended, 5 min)

1. Go to https://neon.tech → Sign up (free)
2. Create Project: `accessible-board-games`
3. Copy **Connection String** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
4. Add to Vercel:
   - https://vercel.com/dashboard → Your project `accessible-board-games` → Settings → Environment Variables
   - Add `DATABASE_URL` = your Neon URL
   - Save
5. Locally, create `.env` file:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
   ```
6. Push schema to DB:
   ```bash
   npm install --legacy-peer-deps
   npm run db:push
   ```
   This creates tables: players, scores, matches, rooms, messages, room_invites, signals

7. Redeploy Vercel: Deployments → Redeploy → Done! Multiplayer now works with real DB.

## Option 2: Vercel Postgres (Built-in)

1. Vercel Dashboard → Project → Storage → Create Database → Postgres → Create
2. Vercel auto-adds `DATABASE_URL` to env vars
3. Run `npm run db:push` locally with that URL (copy from Vercel env)
4. Redeploy

## Option 3: Supabase (Alternative)

1. https://supabase.com → Create project → Copy connection string (URI tab)
2. Same steps as Neon

## How Database is Used

- **players**: Login with code, save wins/losses/xp, cloud saves
- **scores**: Per-game best scores, leaderboard
- **matches**: Online 1v1 matches (TicTacToe, Connect Four, Chess)
- **rooms**: Live rooms (up to 4 players + spectators), host, status
- **messages**: Room chat + voice messages (base64)
- **room_invites**: Notify players invited to rooms
- **signals**: WebRTC signaling for voice calls

## Without Database (Demo Mode) — Already Works

If `DATABASE_URL` not set:
- Auth creates guest player in localStorage (no DB needed)
- Single-player games work: Ludo, Carrom, Snake Ladder, 2048, Memory, Snake
- Multiplayer shows "Demo mode - multiplayer requires DATABASE_URL"
- No crash (fixed `Cannot read properties of undefined`)

## Local Storage + Cloud Sync

- **LocalStorage**: `arcade_player_code` + `arcade_guest_player` — guest persists offline
- **Cloud**: When DB configured, player progress syncs to server via `/api/scores`, `/api/player`
- **Future**: Add `IndexedDB` for offline game saves + sync when online (can be added)

## Testing DB Connection

```bash
curl https://accessible-board-games.vercel.app/api/health
# With DB: {"ok":true}
# Without DB: {"ok":false} but app still works
```

## Drizzle Studio (View DB)

```bash
npm run db:studio
# Opens https://local.drizzle.studio - view/edit tables in browser
```

## ENV Example

See `.env.example` — copy to `.env` and fill DATABASE_URL.

---

Database is now production-ready for your accessible board games!
