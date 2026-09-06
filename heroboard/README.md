# 🏆 HeroBoard — Audio-First Multiplayer Board Games

A **zero-copyright, audio-first** gaming hub built for everyone — including
blind and low-vision players. Four fully playable games (Hand Cricket, Snakes
& Ladders, Ludo, Carrom) with clear spoken narration, synthesised sound
effects, deep accessibility, local pass-and-play **and** real-time online
multiplayer via **Supabase** (with a zero-config offline transport that works
out of the box).

> Everything is plain **HTML5 + modern CSS + vanilla JavaScript**. There is no
> bundler, no build step and **no copyright-restricted media**. All audio is
> synthesised live in the browser with the Web Audio API.

---

## Why it’s different

| | HeroBoard |
|---|---|
| **Screen-reader first** | Every score, move, menu and chat message announces itself in clear speech and high-contrast live regions. |
| **Zero-copyright audio** | Dice shakes, number clicks, bat strikes, wooden thuds, card shuffles, umpire calls and crowd roar are **generated** by a Web Audio API synthesizer. Nothing to license. |
| **Spatial sound** | 3D panning lets players *locate* sounds — used by the audio-orientation Carrom aiming mode. |
| **Real multiplayer** | Local pass-and-play AND online rooms via Supabase Realtime, with admin seat assignment and a **spectator / audience** tier with live chat. |
| **Deep accessibility** | High contrast by default, 3 contrast themes, large targets, full keyboard control, reduced-motion support, `aria-live` announcements. |

---

## The games

| Game | Modes | Highlights |
|---|---|---|
| 🏏 **Hand Cricket** | vs AI · Local · Online | Tactical **shots (Defensive/Balanced/Aggressive)** & **deliveries**, level progression 1–5, overs, **team & squad formats**, dynamic run rate, required rate, Man of the Match from strike rate + wickets. |
| 🐍 **Snakes & Ladders** | Local 2–4 · Online | Step-by-step per-tile movement with per-square narration, real dice, snakes & ladders, first to 100 wins. |
| 🎲 **Ludo** | Local 2–4 · Online | Roll 6 to release, captures, safe squares, home columns, exact-roll finish, three-sixes forfeit. |
| 🎯 **Carrom** | Local 2 · vs AI · Online | Aim + power strikes, friction physics, pocket coins, queen, **spatial sound to aim by ear**. |

### Advanced Hand Cricket engine
- Pick **1–6**. Match the bowler’s number → **OUT**.
- **Shots & deliveries** change the odds: Aggressive hits bigger but risks the wicket; Defensive is safe but scores less.
- **Levels 1–5** unlock tactics, required-rate pressure and a smarter AI.
- **Team & Squad** modes: cumulative scores, wickets per side, dynamic run rate, and **Man of the Match** (strike rate + runs).

---

## Quick start (no account, no backend)

```bash
# Method A — any static file server in this folder
npx serve .
# open the printed localhost URL

# Method B — built-in zero-dependency server
npm run start        # -> http://localhost:8080
```

That’s it. Open `index.html` and play. Multiplayer rooms work **right now on a
single machine** (two browser tabs share the room via `localStorage` +
`BroadcastChannel`), and every game runs offline.

---

## Enable true cross-device online multiplayer (Supabase)

Rooms sync in real time over **Supabase Postgres + Realtime**. Two steps:

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Add the `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` line (already in `index.html`), then set your keys:

```js
// js/config.js
window.HEROBOARD_CONFIG = {
  supabaseUrl:     "https://YOURPROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
};
```

When these are set the app automatically switches from the local transport to
Supabase. See [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) and
[`.env.example`](.env.example) for details.

**How online play works**

- A host creates a room → gets a 6-character **room code** to share.
- A friend joins with the code and lands in the **Spectator / Audience** tier.
- The host (creator) assigns players to seats (P1, P2 / rosters) with the room
  controls, and can move overflow participants back into the audience.
- Everyone in the room — players **and spectators** — sees the live game, hears
  synchronised SFX (if enabled), and can **send live chat**.
- Anyone can click an opponent’s name to inspect their profile (level, games
  played, win rate / game record) before or during the match.

---

## Account & profiles

- **Create a hero** with a unique username / Hero ID.
- **Duplicate validation**: if the name is taken you instantly hear &
  see — *“This name is already used. This is a multiplayer game, please use
  another hero, another name, or sign in with your ID.”*
- **Sign in** with your exact ID.
- **Settings** (persisted across sessions): SFX on/off, background music on/off,
  spoken guidance on/off, spatial sound on/off, reduced motion, and three
  contrast themes. Copy your unique player ID in one tap.
- Stats (games, wins, win rate, best score) update per profile.

---

## Accessibility & audio engine

- **Screen Reader first**: `aria-live` status region + `role="status"/"alert"`,
  high-contrast UI state announcements, and every action spoken via
  `window.speechSynthesis`.
- **Web Audio API synthesizer** (`js/audio.js`): a small royalty-free SFX
  library generated live — dice shake/roll, 1–6 clicks, wooden thuds, bat strikes,
  card shuffle, umpire calls, crowd roar, chimes, and **spatialised (3D pan)**
  pings for audio-orientation.
- **Full keyboard control**, big tappable targets, skip-to-content link and
  `reduce-motion` support.

---

## Project structure

```
.
├─ index.html                # Single-page shell (all screens)
├─ styles.css                # Accessible themes, high contrast, focus states
├─ js/
│  ├─ config.js             # Supabase config (blank = offline)
│  ├─ audio.js              # Web Audio SFX synthesizer + speech
│  ├─ store.js              # Profiles, unique-name check, settings, stats
│  ├─ net.js                # Realtime transport (Supabase ⇄ local fallback)
│  ├─ common.js             # DOM helpers + game registry
│  ├─ cricket.js            # Advanced Hand Cricket
│  ├─ snakes.js             # Snakes & Ladders
│  ├─ ludo.js               # Ludo
│  ├─ carrom.js             # Carrom (canvas physics + spatial audio)
│  ├─ rooms.js             # Room lobby, seats, spectators, chat
│  └─ app.js               # Router + auth + hub + game launch
├─ supabase/schema.sql       # Postgres schema + realtime + RLS
├─ scripts/dev.js            # Zero-dependency static server
├─ test/                     # jsdom smoke, engine & online tests
├─ SUPABASE_SETUP.md
├─ ATTRIBUTION.md
├─ SOUND_SOURCES.md
└─ .env.example
```

---

## Tests

```bash
npm test            # smoke (UI flows) + online (host-authoritative sync)
npm run test:engines  # per-game engine checks
```

---

## Licence & attribution

All code and **all sound** are original / generated in-browser — **no
copyrighted assets**. See [`ATTRIBUTION.md`](ATTRIBUTION.md) and
[`SOUND_SOURCES.md`](SOUND_SOURCES.md).

MIT licence.

## Roadmap
- Chess (accessible, move-safe) — same room/sync layer.
- Free-Fire style **sound-orientation survival** mini-game using spatial audio.
- Persistent leaderboards & achievements via the `matches` table.
