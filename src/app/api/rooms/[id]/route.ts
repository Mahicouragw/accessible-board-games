import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const room = await store.rooms.byId(roomId);
    if (!room) return Response.json({ error: "not found" }, { status: 404 });

    // 👀 Presence tracking: a member whose heartbeat is older than 60 s counts as
    // offline. On transitions, post system messages so everyone in the room sees
    // "X left the room (offline)" / "X joined the room (back online)" by NAME.
    try {
      const since = new Date(Date.now() - 60_000).toISOString();
      const onlineRows = await store.players.onlineSince(since);
      const onlineIds = new Set(onlineRows.map((p) => Number(p.id)));
      const prev: Record<string, boolean> =
        (room as any).meta && typeof (room as any).meta.presence === "object"
          ? (room as any).meta.presence
          : {};
      const next: Record<string, boolean> = {};
      const members = Array.isArray(room.members) ? room.members : [];
      let changed = false;
      for (const m of members) {
        const isOnline = onlineIds.has(Number(m.id));
        next[String(m.id)] = isOnline;
        const was = prev[String(m.id)];
        if (was !== undefined && was !== isOnline) {
          changed = true;
          await store.messages.insert({
            roomId, playerId: m.id, playerName: m.name, avatar: m.avatar,
            kind: "system",
            content: isOnline ? `${m.name} joined the room (back online)` : `${m.name} left the room (offline)`,
          });
        }
      }
      if (changed || Object.keys(prev).length === 0) {
        const meta = { ...((room as any).meta ?? {}), presence: next };
        await store.rooms.update(roomId, { meta, updatedAt: new Date().toISOString() });
        const fresh = await store.rooms.byId(roomId);
        return Response.json({ room: fresh ?? room, cloud: true });
      }
    } catch (presenceErr) {
      console.error("presence tracking failed", presenceErr);
    }

    return Response.json({ room, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

// PATCH { code, meta } — update room meta (team setup: countries, captains,
// striker/bowler). The room HOST may set anything; a team CAPTAIN may only
// change their own team's striker/bowler.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { code, meta } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    if (!c || !meta || typeof meta !== "object") {
      return Response.json({ error: "code and meta required" }, { status: 400 });
    }
    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "register first" }, { status: 404 });
    const room = await store.rooms.byId(roomId);
    if (!room) return Response.json({ error: "room not found" }, { status: 404 });

    const isHost = Number(room.hostId) === Number(me.id);
    const curTeams: any[] = Array.isArray((room as any).meta?.teams) ? (room as any).meta.teams : [];
    const newTeams: any[] = Array.isArray(meta.teams) ? meta.teams : [];
    const isCaptainOf = (t: any) => Number(t?.captainId) === Number(me.id);

    let patch: Record<string, any> = {};
    if (isHost) {
      patch = { meta };
    } else {
      // Captain: may only set strikerId/bowlerId on their own team.
      const myTeamIdx = curTeams.findIndex(isCaptainOf);
      const newTeam = newTeams[myTeamIdx];
      if (myTeamIdx < 0 || !newTeam) {
        return Response.json({ error: "only the room host or a team captain can update the teams" }, { status: 403 });
      }
      const merged = [...curTeams];
      merged[myTeamIdx] = {
        ...merged[myTeamIdx],
        strikerId: newTeam.strikerId ?? merged[myTeamIdx].strikerId,
        bowlerId: newTeam.bowlerId ?? merged[myTeamIdx].bowlerId,
      };
      patch = { meta: { ...(room as any).meta, teams: merged } };
    }
    const updated = await store.rooms.update(roomId, patch);
    return Response.json({ ok: true, room: updated, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
