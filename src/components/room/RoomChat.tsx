"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

type Msg = {
  id: number;
  playerId: number;
  playerName: string;
  avatar: string;
  kind: "text" | "voice" | "system";
  content: string;
  createdAt: string;
};

export default function RoomChat({ roomId }: { roomId: number }) {
  const { player } = useSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  // Poll for new messages.
  useEffect(() => {
    if (!player) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/messages?after=${lastId.current}`);
        const data = await res.json();
        const incoming: Msg[] = data.messages ?? [];
        if (!active || incoming.length === 0) return;
        lastId.current = incoming[incoming.length - 1].id;
        setMessages((prev) => [...prev, ...incoming].slice(-100));
        const fromOthers = incoming.some((m) => m.playerId !== (player?.id ?? 0) && m.kind !== "system");
        if (fromOthers) {
          sound.play("select");
          const last = incoming[incoming.length - 1];
          announce(
            last.kind === "voice"
              ? `${last.playerName} sent a voice message`
              : `${last.playerName} says ${last.content}`,
          );
        }
        scrollDown();
      } catch {
        /* ignore */
      }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [player, roomId, scrollDown]);

  async function sendText() {
    const body = text.trim();
    if (!body || !player || sending) return;
    setSending(true);
    setText("");
    try {
      await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "", kind: "text", content: body }),
      });
      sound.play("click");
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (!player) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 700_000) {
          announce("Voice message too long, please keep it short.");
          return;
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          await fetch(`/api/rooms/${roomId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: player?.code ?? "", kind: "voice", content: dataUrl }),
          });
          sound.play("turn");
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      announce("Recording voice message");
      // auto-stop at 15s
      setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") stopRecording();
      }, 15000);
    } catch {
      announce("Microphone permission is needed for voice messages.");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-3 font-bold">💬 Room Chat</div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        style={{ minHeight: 240, maxHeight: 420 }}
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            No messages yet. Say hi, send a voice note, or start a call!
          </p>
        )}
        {messages.map((m) => {
          const mine = player && m.playerId === (player?.id ?? 0);
          if (m.kind === "system") {
            return (
              <div key={m.id} className="text-center text-xs text-slate-500">
                {m.content}
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-slate-700 text-lg">
                {m.avatar}
              </div>
              <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                <div className="text-xs text-slate-500">{m.playerName}</div>
                {m.kind === "voice" ? (
                  <audio
                    controls
                    src={m.content}
                    className="mt-1 h-9 w-52 max-w-full"
                    aria-label={`Voice message from ${m.playerName}`}
                  />
                ) : (
                  <div
                    className={`mt-1 inline-block rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {m.content}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-800 p-3">
        <button
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? "Stop recording voice message" : "Record voice message"}
          className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-lg transition ${
            recording ? "animate-pulse bg-rose-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {recording ? "⏹️" : "🎤"}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
          placeholder={recording ? "Recording…" : "Type a message…"}
          disabled={recording}
          aria-label="Message input"
          className="flex-1 rounded-full border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-500"
        />
        <button
          onClick={sendText}
          disabled={sending || !text.trim()}
          aria-label="Send message"
          className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-sky-500 text-lg text-slate-950 transition hover:bg-sky-400 disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
