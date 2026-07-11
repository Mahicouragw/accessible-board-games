"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomMember } from "@/db/schema";
import { useSession } from "@/lib/session";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function VoiceCall({
  roomId,
  members,
}: {
  roomId: number;
  members: RoomMember[];
}) {
  const { player } = useSession();
  const [inCall, setInCall] = useState(false);
  const [connected, setConnected] = useState<number[]>([]);
  const [muted, setMuted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audiosRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const lastSignalId = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inCallRef = useRef(false);

  const myId = player?.id ?? 0;
  const code = player?.code ?? "";

  const sendSignal = useCallback(
    async (toId: number, kind: string, payload: unknown) => {
      try {
        await fetch(`/api/rooms/${roomId}/signals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, toId, kind, payload }),
        });
      } catch {
        /* ignore */
      }
    },
    [roomId, code],
  );

  const attachRemote = useCallback((peerId: number, stream: MediaStream) => {
    let el = audiosRef.current.get(peerId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      audiosRef.current.set(peerId, el);
    }
    el.srcObject = stream;
    el.play().catch(() => {});
  }, []);

  const createPeer = useCallback(
    (peerId: number) => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      localStreamRef.current
        ?.getTracks()
        .forEach((t) => pc.addTrack(t, localStreamRef.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(peerId, "ice", e.candidate.toJSON());
      };
      pc.ontrack = (e) => {
        attachRemote(peerId, e.streams[0]);
        setConnected((c) => (c.includes(peerId) ? c : [...c, peerId]));
      };
      pc.onconnectionstatechange = () => {
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setConnected((c) => c.filter((x) => x !== peerId));
        }
      };
      peersRef.current.set(peerId, pc);
      return pc;
    },
    [sendSignal, attachRemote],
  );

  const handleSignal = useCallback(
    async (sig: { fromId: number; kind: string; payload: unknown }) => {
      const peerId = sig.fromId;
      if (sig.kind === "offer") {
        const pc = createPeer(peerId);
        await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(peerId, "answer", answer);
      } else if (sig.kind === "answer") {
        const pc = peersRef.current.get(peerId);
        if (pc && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
        }
      } else if (sig.kind === "ice") {
        const pc = peersRef.current.get(peerId);
        if (pc) {
          try {
            await pc.addIceCandidate(sig.payload as RTCIceCandidateInit);
          } catch {
            /* ignore */
          }
        }
      } else if (sig.kind === "hangup") {
        const pc = peersRef.current.get(peerId);
        pc?.close();
        peersRef.current.delete(peerId);
        setConnected((c) => c.filter((x) => x !== peerId));
      }
    },
    [createPeer, sendSignal],
  );

  // Call as initiator toward peers with a larger id (avoids double offers).
  const callHigherPeers = useCallback(async () => {
    for (const m of members) {
      if (m.id <= myId) continue;
      if (peersRef.current.has(m.id)) continue;
      const pc = createPeer(m.id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(m.id, "offer", offer);
    }
  }, [members, myId, createPeer, sendSignal]);

  const startCall = useCallback(async () => {
    if (!player) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setInCall(true);
      inCallRef.current = true;
      sound.play("turn");
      announce("Voice call started. You are connected.");
      await callHigherPeers();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/rooms/${roomId}/signals?code=${code}&after=${lastSignalId.current}`,
          );
          const data = await res.json();
          const sigs = data.signals ?? [];
          for (const s of sigs) {
            lastSignalId.current = Math.max(lastSignalId.current, s.id);
            await handleSignal(s);
          }
          await callHigherPeers();
        } catch {
          /* ignore */
        }
      }, 1600);
    } catch {
      announce("Microphone permission is required to join the call.");
    }
  }, [player, roomId, code, callHigherPeers, handleSignal]);

  const endCall = useCallback(() => {
    inCallRef.current = false;
    setInCall(false);
    setConnected([]);
    if (pollRef.current) clearInterval(pollRef.current);
    peersRef.current.forEach((pc, id) => {
      sendSignal(id, "hangup", null);
      pc.close();
    });
    peersRef.current.clear();
    audiosRef.current.forEach((a) => {
      a.srcObject = null;
    });
    audiosRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    sound.play("click");
    announce("Call ended.");
  }, [sendSignal]);

  function toggleMute() {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    announce(next ? "Microphone muted" : "Microphone on");
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      peersRef.current.forEach((pc) => pc.close());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <div className="font-bold">📞 Voice Call</div>
        {inCall && (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
            {connected.length + 1} on call
          </span>
        )}
      </div>

      {!inCall ? (
        <button
          onClick={startCall}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 font-bold text-white transition hover:opacity-90"
        >
          📞 Join Voice Call
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={toggleMute}
            aria-pressed={muted}
            className={`flex-1 rounded-xl px-4 py-3 font-bold transition ${
              muted ? "bg-amber-500 text-slate-950" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
          >
            {muted ? "🔇 Unmute" : "🎙️ Mute"}
          </button>
          <button
            onClick={endCall}
            className="flex-1 rounded-xl bg-rose-500 px-4 py-3 font-bold text-white transition hover:bg-rose-400"
          >
            📴 Leave
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Talk live with everyone in the room. Uses your microphone.
      </p>
    </div>
  );
}
