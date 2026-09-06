# Supabase setup — real-time online multiplayer

HeroBoard ships with a **zero-config local transport** so everything works
offline immediately. To make rooms, chat and profiles sync across *devices*,
connect a Supabase project.

## 1. Create a project

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the **Project URL** and the **anon public key**
   (`Database → API → Project URL` / `anon public`).
   The anon key is safe in the browser; access is controlled by RLS.

## 2. Run the schema

Open **SQL Editor → New query** and paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), then **Run**.

It creates:
- `profiles` — unique usernames / hero IDs + duplicate detection.
- `rooms` — one row per live room; `state` is the authoritative game snapshot.
- `room_members` — who is in the room, their role + seat (`player` / `spectator`).
- `messages` — live chat.
- `matches` — optional cross-device result table for persistent profiles.
- Indexes, **RLS policies** (permissive demo policy) and the
  **realtime publication**.

## 3. Point the app at your project

Make sure `index.html` has the Supabase JS CDN tag:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Then set the keys in **`js/config.js`**:

```js
window.HEROBOARD_CONFIG = {
  supabaseUrl:     "https://YOURPROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
};
```

> You can also set `window.HEROBOARD_CONFIG` via a `<script>` placed *before*
> `js/config.js`, or read the values from your host’s environment and inject
> them at deploy time.

## 4. Verify

- Refresh. The top-right connection chip shows **Online**.
- In two separate browser instances (different devices), open the site.
- Create a room on one, join with the code on the other.
- The host assigns the joiner to a seat and starts; both see updates in about
  the latency of the realtime channel.

## RLS note

`schema.sql` ships with `using (true)` / `with check (true)` policies **only to
make the demo work with the anonymous key**, matching the existing project’s
approach. For production, restrict to authenticated roles and scope reads to
the user’s own data. Replace the placeholder policies before deployment.

## Hosting

This is a fully static app — deploy `index.html`, `styles.css`, `js/` and the
docs to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages,
Supabase Hosting). Use `scripts/dev.js` locally.
