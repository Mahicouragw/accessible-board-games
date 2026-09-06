# Multiplayer architecture

HeroBoard uses one **transport abstraction** (`js/net.js`) with two
interchangeable back-ends. The rest of the app only talks to `HeroNet.*`.

## Transport: `HeroNet`

| | Local transport (default) | Supabase transport (configured) |
|---|---|---|
| Scope | Same machine / same browser | Any device on the internet |
| Room state | `localStorage` (shared across tabs on one origin) | Postgres `rooms.state` |
| Live updates | `BroadcastChannel` | Supabase Realtime (`postgres_changes`) |
| Presence | Broadcast + storage events | Realtime presence |
| Credentials | none | SUPABASE_URL + anon key |

`js/net.js` picks Supabase automatically when `HEROBOARD_CONFIG` is populated;
otherwise it uses the local fallback. Both implement the same interface:
`createRoom`, `joinRoom`, `roomState`, `sendChat`, `admit`, `startGame`,
`currentRoom`, `on(event, cb)`.

### Events
- `room:update` — member list / status changed.
- `state` — authoritative game snapshot changed.
- `chat` — a new chat message array.
- `game:start` — the host pressed Start (remote clients boot the game).
- `presence` — who is online in the room.

## Room lifecycle

1. **Host** picks a game → **Create room** → `HeroNet.createRoom()` returns a
   6-char code. The host is `admin`, seat 0, and is the **authoritative
   controller** for that match.
2. **Guest** picks **Join a room** → enters the code → `joinRoom()` adds them as
   a `spectator` until the host assigns a seat.
3. **Host controls** (in the lobby): assign guests to seats (`player`), or move
   players to the **Spectator / Audience** tier; promote/demote anyone.
4. **Start** requires ≥2 assigned seats. `startGame()` broadcasts, the host
   boots the game, and every guest auto-boots it with their authoritative
   roster + `mySide`/`myIndex`.
5. **Live chat**: messages are relayed (~`messages`) and spoken aloud.

## Host-authoritative game sync

Hand Cricket uses a **host-authoritative** model to avoid double updates:

- The host owns the real game state.
- Every player posts only their **pick** into a shared `mailbox`
  (`{ ball, bat, bowl }`).
- When the host sees both a bat and a bowl pick for the current ball, it
  resolves the ball, advances the snapshot and clears the mailbox for the next
  ball. Remote players just render the snapshot.

Board games (Snakes / Ludo / Carrom) broadcast the full mutable game state after
each turn; each client gates controls by “your turn” (via `myIndex`) so only the
right player rolls/strikes.

## Spectators & profile inspection

- All room members (players **and** spectators) receive the same `state` events
  and can listen to synchronised SFX if their settings have sound on.
- Any member can click a player’s name to hear (and see) their profile: level,
  games played, win rate and per-game record.
- Spectators can send chat and watch the live board.

## Offline vs online honesty

The local transport’s rooms are shared through `localStorage`, so two tabs of
the *same browser* can play a “remote” game with no backend. For genuine
cross-device play you must configure Supabase (see `SUPABASE_SETUP.md`).
