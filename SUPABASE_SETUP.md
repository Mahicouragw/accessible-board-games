# Internet rooms: not provisioned

The shipped, supported room transport is same-browser BroadcastChannel/localStorage. It is a **trusted same-device demo**, not secure cross-device multiplayer. Browser-stored Hero IDs are not authentication.

The old Supabase transport allowed public state overwrites and is now disabled. Adding an anon key is **not sufficient** to enable it. `supabase/schema.sql` creates the tables and removes the old public-write grants; it deliberately does not grant gameplay access. No live database migration was executed in this workspace. Review and back up your deployment before manually applying lockdown.

Before internet deployment, provide:
1. Supabase Auth identities mapped to memberships; no self-asserted actor IDs.
2. Server-side transactional create/join/draft/start/active-player/commit/reveal commands.
3. Room-scoped RLS reads, constrained chat writes, rate limits and replay protection.
4. Server-owned match snapshots and a tested disconnect/reconnection policy.
5. Integration tests with two authenticated devices plus a hostile/spectator client.

`js/cricket-room.js` contains testable command/rule validation and commit/reveal logic, but moving it to a server requires deriving the actor from authentication, not the request body. Never deploy `USING (true)` public write policies or put a service-role key in browser JavaScript.
