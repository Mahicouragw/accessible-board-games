"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { useSaveScore } from "@/lib/useSaveScore";

const S = 360;
const M = 26; // margin to play area
const PR = 17; // pocket radius
const COIN_R = 8.5;
const STRIKER_R = 12;
const LEFT = M;
const RIGHT = S - M;
const POCKETS = [
  [M, M],
  [S - M, M],
  [M, S - M],
  [S - M, S - M],
];

type Kind = "white" | "black" | "queen" | "striker";
type Piece = { x: number; y: number; vx: number; vy: number; r: number; kind: Kind; alive: boolean };

function initPieces(): Piece[] {
  const cx = S / 2;
  const cy = S / 2;
  const pieces: Piece[] = [];
  pieces.push({ x: cx, y: cy, vx: 0, vy: 0, r: COIN_R, kind: "queen", alive: true });
  const ring = (radius: number, count: number, startColor: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.3;
      pieces.push({
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
        vx: 0,
        vy: 0,
        r: COIN_R,
        kind: (i + startColor) % 2 === 0 ? "white" : "black",
        alive: true,
      });
    }
  };
  ring(COIN_R * 2 + 1, 6, 0);
  ring(COIN_R * 4 + 2, 12, 1);
  return pieces;
}

export default function Carrom() {
  const save = useSaveScore("carrom");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<Piece[]>(initPieces());
  const strikerRef = useRef<Piece>({
    x: S / 2, y: S - M - 20, vx: 0, vy: 0, r: STRIKER_R, kind: "striker", alive: true,
  });
  const rafRef = useRef<number>(0);
  const aimRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const movingRef = useRef(false);
  const pottedThisTurn = useRef<Kind[]>([]);

  const [turn, setTurn] = useState(0); // 0 human(white) 1 AI(black)
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [strikerX, setStrikerX] = useState(S / 2);
  const [msg, setMsg] = useState("Drag on the board to aim, release to flick!");
  const [phase, setPhase] = useState<"aim" | "moving" | "over">("aim");
  const [best, setBest] = useState(0);
  const turnRef = useRef(0);
  turnRef.current = turn;

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    // board
    ctx.fillStyle = "#d9a566";
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "#7c4a1e";
    ctx.lineWidth = 4;
    ctx.strokeRect(M - 6, M - 6, S - 2 * M + 12, S - 2 * M + 12);
    ctx.strokeStyle = "#a9713a";
    ctx.lineWidth = 2;
    ctx.strokeRect(M + 8, M + 8, S - 2 * M - 16, S - 2 * M - 16);
    // center circle
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 34, 0, Math.PI * 2);
    ctx.strokeStyle = "#7c4a1e";
    ctx.stroke();
    // baselines
    ctx.strokeStyle = "#b5462b";
    ctx.lineWidth = 3;
    [M + 22, S - M - 22].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(M + 30, y);
      ctx.lineTo(S - M - 30, y);
      ctx.stroke();
    });
    // pockets
    POCKETS.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, PR, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
    });
    // coins
    for (const p of piecesRef.current) {
      if (!p.alive) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.kind === "white" ? "#f8fafc" : p.kind === "black" ? "#1f2937" : "#dc2626";
      ctx.fill();
      ctx.strokeStyle = "#00000055";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // striker
    const st = strikerRef.current;
    if (st.alive) {
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "#0369a1";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // aim line
    if (aimRef.current.active) {
      const dx = st.x - aimRef.current.x;
      const dy = st.y - aimRef.current.y;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x + dx, st.y + dy);
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, []);

  const endTurn = useCallback(() => {
    const potted = pottedThisTurn.current;
    const me = turnRef.current;
    const myColor: Kind = me === 0 ? "white" : "black";
    let sameTurn = false;
    let foul = false;

    setScore((prev) => {
      const next: [number, number] = [prev[0], prev[1]];
      for (const k of potted) {
        if (k === "striker") {
          foul = true;
        } else if (k === "queen") {
          next[me] += 3;
          sameTurn = true;
        } else if (k === myColor) {
          next[me] += 1;
          sameTurn = true;
        } else {
          next[me === 0 ? 1 : 0] += 1;
        }
      }
      return next;
    });

    // reset striker if potted
    if (foul) {
      strikerRef.current.alive = true;
    }

    const remaining = piecesRef.current.some((p) => p.alive && p.kind !== "queen");
    if (!remaining) {
      setPhase("over");
      setScore((prev) => {
        const iWin = prev[0] >= prev[1];
        if (iWin) {
          sound.play("win");
          announce(`Game over. You scored ${prev[0]} to ${prev[1]}. You win!`);
          setMsg(`🎉 You win ${prev[0]}–${prev[1]}!`);
        } else {
          sound.play("lose");
          announce(`Game over. AI scored ${prev[1]} to your ${prev[0]}.`);
          setMsg(`AI wins ${prev[1]}–${prev[0]}`);
        }
        setBest((b) => {
          const nb = Math.max(b, prev[0]);
          if (prev[0] > b) save(prev[0]);
          return nb;
        });
        return prev;
      });
      return;
    }

    const next = sameTurn && !foul ? me : me === 0 ? 1 : 0;
    // reposition striker on that player's baseline
    strikerRef.current.x = S / 2;
    strikerRef.current.y = next === 0 ? S - M - 20 : M + 20;
    strikerRef.current.vx = 0;
    strikerRef.current.vy = 0;
    setStrikerX(S / 2);
    setTurn(next);
    setPhase("aim");
    if (next === 0) {
      setMsg(sameTurn ? "Nice pot! Go again." : "Your turn — aim and flick!");
      announce(sameTurn ? "You potted a coin, shoot again" : "Your turn");
    } else {
      setMsg("AI is aiming…");
      announce("AI's turn");
    }
  }, [save]);

  const physicsStep = useCallback(() => {
    const all = [...piecesRef.current, strikerRef.current];
    let anyMoving = false;
    for (const p of all) {
      if (!p.alive) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      if (Math.hypot(p.vx, p.vy) < 0.06) {
        p.vx = 0;
        p.vy = 0;
      } else {
        anyMoving = true;
      }
      // walls
      if (p.x < LEFT + p.r) { p.x = LEFT + p.r; p.vx = -p.vx * 0.8; }
      if (p.x > RIGHT - p.r) { p.x = RIGHT - p.r; p.vx = -p.vx * 0.8; }
      if (p.y < LEFT + p.r) { p.y = LEFT + p.r; p.vy = -p.vy * 0.8; }
      if (p.y > RIGHT - p.r) { p.y = RIGHT - p.r; p.vy = -p.vy * 0.8; }
    }
    // collisions
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const min = a.r + b.r;
        if (dist < min) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (min - dist) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          const va = a.vx * nx + a.vy * ny;
          const vb = b.vx * nx + b.vy * ny;
          const diff = (vb - va) * 0.95;
          a.vx += diff * nx; a.vy += diff * ny;
          b.vx -= diff * nx; b.vy -= diff * ny;
          if (Math.abs(va - vb) > 2) sound.play("move");
        }
      }
    }
    // pockets
    for (const p of all) {
      if (!p.alive) continue;
      for (const [px, py] of POCKETS) {
        if (Math.hypot(p.x - px, p.y - py) < PR - 2) {
          p.alive = false;
          if (p.kind === "striker") {
            pottedThisTurn.current.push("striker");
          } else {
            pottedThisTurn.current.push(p.kind);
          }
          sound.play("pocket");
        }
      }
    }
    return anyMoving;
  }, []);

  // main loop
  useEffect(() => {
    const loop = () => {
      if (movingRef.current) {
        const moving = physicsStep();
        if (!moving) {
          movingRef.current = false;
          endTurn();
        }
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, physicsStep, endTurn]);

  useEffect(() => {
    announce("Carrom. You are white coins versus AI black. Drag to aim, release to shoot.");
  }, []);

  function toLocal(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * S,
      y: ((e.clientY - rect.top) / rect.height) * S,
    };
  }

  function onDown(e: React.PointerEvent) {
    if (phase !== "aim" || turn !== 0 || movingRef.current) return;
    const { x, y } = toLocal(e);
    aimRef.current = { active: true, x, y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!aimRef.current.active) return;
    const { x, y } = toLocal(e);
    aimRef.current.x = x;
    aimRef.current.y = y;
  }
  function onUp() {
    if (!aimRef.current.active) return;
    const st = strikerRef.current;
    const dx = st.x - aimRef.current.x;
    const dy = st.y - aimRef.current.y;
    aimRef.current.active = false;
    const power = Math.min(Math.hypot(dx, dy), 130);
    if (power < 6) return;
    const ang = Math.atan2(dy, dx);
    const speed = power * 0.16;
    st.vx = Math.cos(ang) * speed;
    st.vy = Math.sin(ang) * speed;
    pottedThisTurn.current = [];
    movingRef.current = true;
    setPhase("moving");
    sound.play("dice");
    announce("Shot!");
  }

  function moveStriker(x: number) {
    if (phase !== "aim" || turn !== 0) return;
    const clamped = Math.max(LEFT + 30, Math.min(RIGHT - 30, x));
    strikerRef.current.x = clamped;
    setStrikerX(clamped);
  }

  // AI turn
  useEffect(() => {
    if (turn === 1 && phase === "aim" && !movingRef.current) {
      const t = setTimeout(() => {
        const targets = piecesRef.current.filter(
          (p) => p.alive && (p.kind === "black" || p.kind === "queen"),
        );
        const st = strikerRef.current;
        if (!targets.length) return;
        const target = targets[Math.floor(Math.random() * targets.length)];
        // aim striker toward a pocket via the target
        const pocket = POCKETS[Math.floor(Math.random() * POCKETS.length)];
        const aimX = target.x + (target.x - pocket[0]) * 0.15;
        const aimY = target.y + (target.y - pocket[1]) * 0.15;
        st.x = Math.max(LEFT + 30, Math.min(RIGHT - 30, target.x));
        st.y = M + 20;
        const dx = aimX - st.x;
        const dy = aimY - st.y;
        const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.25;
        const speed = 12 + Math.random() * 5;
        st.vx = Math.cos(ang) * speed;
        st.vy = Math.sin(ang) * speed;
        pottedThisTurn.current = [];
        movingRef.current = true;
        setPhase("moving");
        sound.play("dice");
      }, 900);
      return () => clearTimeout(t);
    }
  }, [turn, phase]);

  function reset() {
    piecesRef.current = initPieces();
    strikerRef.current = { x: S / 2, y: S - M - 20, vx: 0, vy: 0, r: STRIKER_R, kind: "striker", alive: true };
    pottedThisTurn.current = [];
    movingRef.current = false;
    setScore([0, 0]);
    setTurn(0);
    setStrikerX(S / 2);
    setPhase("aim");
    setMsg("Drag on the board to aim, release to flick!");
    sound.play("click");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className={`rounded-xl border px-4 py-2 ${turn === 0 ? "border-sky-400 ring-2 ring-sky-500" : "border-slate-800"}`}>
          <div className="text-sm font-bold text-sky-400">You ⚪</div>
          <div className="text-xs text-slate-400">Score {score[0]}</div>
        </div>
        <div className={`rounded-xl border px-4 py-2 ${turn === 1 ? "border-rose-400 ring-2 ring-rose-500" : "border-slate-800"}`}>
          <div className="text-sm font-bold text-rose-400">AI ⚫</div>
          <div className="text-xs text-slate-400">Score {score[1]}</div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={S}
        height={S}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        role="img"
        aria-label="Carrom board. Drag to aim and release to flick the striker."
        className="mx-auto w-full max-w-sm touch-none rounded-xl shadow-2xl"
        style={{ aspectRatio: "1 / 1" }}
      />

      {turn === 0 && phase === "aim" && (
        <div className="mt-3">
          <label className="text-xs text-slate-400">Move striker left / right</label>
          <input
            type="range"
            min={LEFT + 30}
            max={RIGHT - 30}
            value={strikerX}
            onChange={(e) => moveStriker(Number(e.target.value))}
            aria-label="Striker position"
            className="w-full accent-sky-500"
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <p className="text-sm text-slate-300">{msg}</p>
        <button
          onClick={reset}
          className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-amber-400"
        >
          {phase === "over" ? "Play Again" : "Reset"}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">Best pot: {best} · Red queen = 3 points.</p>
    </div>
  );
}
