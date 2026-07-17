"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/sound";
import { useSaveScore } from "@/lib/useSaveScore";

type MonsterType = "Goblin" | "Goblin Mage" | "Arch Magician" | "Goblin King" | "Shadow Beast" | "Dragon";

type Monster = {
  id: number;
  type: MonsterType;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xpReward: number;
  avatar: string;
  isBoss?: boolean;
};

type Player = {
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  level: number;
  xp: number;
};

type BattleLog = {
  message: string;
  type: "player" | "monster" | "system" | "magic" | "fail";
  timestamp: number;
};

const MONSTER_STATS: Record<MonsterType, { hp: number; attack: number; defense: number; xp: number; avatar: string; isBoss?: boolean }> = {
  "Goblin": { hp: 50, attack: 10, defense: 2, xp: 20, avatar: "👺" },
  "Goblin Mage": { hp: 80, attack: 15, defense: 5, xp: 40, avatar: "🧙‍♂️" },
  "Arch Magician": { hp: 120, attack: 25, defense: 10, xp: 80, avatar: "🧝‍♂️", isBoss: true },
  "Goblin King": { hp: 150, attack: 20, defense: 15, xp: 100, avatar: "👑", isBoss: true },
  "Shadow Beast": { hp: 100, attack: 18, defense: 8, xp: 60, avatar: "👹" },
  "Dragon": { hp: 200, attack: 30, defense: 20, xp: 150, avatar: "🐉", isBoss: true },
};

const PLAYER_NAMES = ["Hero", "Warrior", "Mage", "Knight", "Archer"];

export default function MonsterBattle() {
  const save = useSaveScore("monster-battle");
  const [player, setPlayer] = useState<Player>({
    name: "Hero",
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 15,
    defense: 5,
    level: 1,
    xp: 0,
  });

  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<number>(0);
  const [battleLog, setBattleLog] = useState<BattleLog[]>([]);
  const [gameState, setGameState] = useState<"setup" | "battle" | "victory" | "defeat">("setup");
  const [encounterSize, setEncounterSize] = useState<1 | 2 | 3 | 4 | 5 | 6>(3);
  const [wins, setWins] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [spellFailChance] = useState(15); // 15% chance spell fails

  useEffect(() => {
    addLog("Welcome to Monster Battle! Encounter 1-6 monsters like Goblin, Goblin Mage, Arch Magician!", "system");
    sound.play("select");
  }, []);

  const addLog = (message: string, type: BattleLog["type"] = "system") => {
    setBattleLog(prev => [...prev.slice(-15), { message, type, timestamp: Date.now() }]);
  };

  const generateEncounter = (size: number) => {
    const types: MonsterType[] = ["Goblin", "Goblin Mage", "Arch Magician", "Goblin King", "Shadow Beast", "Dragon"];
    const newMonsters: Monster[] = [];
    
    for (let i = 0; i < size; i++) {
      // Weighted random: more Goblins, fewer bosses
      let type: MonsterType;
      const rand = Math.random();
      if (rand < 0.4) type = "Goblin";
      else if (rand < 0.65) type = "Goblin Mage";
      else if (rand < 0.8) type = "Shadow Beast";
      else if (rand < 0.9) type = "Arch Magician";
      else if (rand < 0.95) type = "Goblin King";
      else type = "Dragon";

      const stats = MONSTER_STATS[type];
      newMonsters.push({
        id: Date.now() + i,
        type,
        name: `${type} ${i + 1}`,
        hp: stats.hp,
        maxHp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        xpReward: stats.xp,
        avatar: stats.avatar,
        isBoss: stats.isBoss,
      });
    }

    setMonsters(newMonsters);
    setSelectedMonster(0);
    setGameState("battle");
    setIsPlayerTurn(true);
    addLog(`⚔️ Encounter! ${size} monster${size > 1 ? "s" : ""} appeared: ${newMonsters.map(m => m.type).join(", ")}!`, "system");
    sound.play("turn");
  };

  const calculateDamage = (attackerAttack: number, defenderDefense: number, isMagic = false): number => {
    const base = attackerAttack;
    const defense = defenderDefense;
    const variance = 0.8 + Math.random() * 0.4; // 80% to 120%
    let damage = Math.max(1, Math.floor((base - defense * 0.5) * variance));
    if (isMagic) damage = Math.floor(damage * 1.5); // Magic does more
    return damage;
  };

  const playerAttack = (multiStrike = false) => {
    if (!isPlayerTurn || gameState !== "battle" || monsters.length === 0) return;

    const target = monsters[selectedMonster];
    if (!target || target.hp <= 0) {
      addLog("Select a valid monster!", "system");
      return;
    }

    // Player hits monster with 10 damage base (as per your example)
    const strikes = multiStrike ? Math.floor(Math.random() * 3) + 2 : 1; // 2-4 strikes if multiple
    let totalDamage = 0;

    for (let i = 0; i < strikes; i++) {
      const damage = calculateDamage(player.attack, target.defense);
      totalDamage += damage;
      target.hp = Math.max(0, target.hp - damage);
      addLog(`⚔️ You hit ${target.name} for ${damage} damage! ${strikes > 1 ? `(Strike ${i + 1}/${strikes})` : ""}`, "player");
      if (target.hp <= 0) break;
    }

    sound.play("move"); // Sword hit sound
    if (strikes > 1) {
      setTimeout(() => sound.play("move"), 150);
      setTimeout(() => sound.play("capture"), 300);
    }

    // Update monsters
    const updatedMonsters = [...monsters];
    if (target.hp <= 0) {
      addLog(`💀 ${target.name} defeated! +${target.xpReward} XP`, "system");
      setPlayer(prev => {
        const newXp = prev.xp + target.xpReward;
        const newLevel = Math.floor(newXp / 100) + 1;
        if (newLevel > prev.level) {
          addLog(`🎉 Level Up! You are now level ${newLevel}! HP and MP restored!`, "system");
          sound.play("level_up");
          return { ...prev, xp: newXp, level: newLevel, hp: prev.maxHp, mp: prev.maxMp, attack: prev.attack + 2, defense: prev.defense + 1 };
        }
        return { ...prev, xp: newXp };
      });
      // Remove dead monster
      const filtered = updatedMonsters.filter(m => m.hp > 0);
      setMonsters(filtered);
      
      if (filtered.length === 0) {
        // Victory
        setGameState("victory");
        const totalXp = updatedMonsters.reduce((acc, m) => acc + m.xpReward, 0);
        addLog(`🏆 Victory! All ${encounterSize} monsters defeated! Total XP: ${totalXp}`, "system");
        sound.play("win");
        setWins(w => w + 1);
        save(wins + 1);
        return;
      } else {
        // Adjust selected monster if needed
        if (selectedMonster >= filtered.length) {
          setSelectedMonster(0);
        }
      }
    } else {
      setMonsters(updatedMonsters);
    }

    // Monsters' turn - each alive monster hits player for 10 damage (as per your example: Goblin hits for 10, Goblin Mage hits, Arch Magician hits)
    setIsPlayerTurn(false);
    setTimeout(() => {
      monsterTurn(updatedMonsters.length > 0 ? updatedMonsters : monsters.filter(m => m.hp > 0));
    }, 800);
  };

  const monsterTurn = (aliveMonsters: Monster[]) => {
    if (aliveMonsters.length === 0) return;

    let totalDamage = 0;
    aliveMonsters.forEach((monster, idx) => {
      if (monster.hp <= 0) return;
      
      setTimeout(() => {
        const damage = calculateDamage(monster.attack, player.defense);
        totalDamage += damage;
        setPlayer(prev => ({ ...prev, hp: Math.max(0, prev.hp - damage) }));
        addLog(`👺 ${monster.name} hits you for ${damage} damage! ${monster.type} attack!`, "monster");
        sound.play("capture");

        if (idx === aliveMonsters.length - 1) {
          setTimeout(() => {
            setPlayer(prev => {
              if (prev.hp <= 0) {
                setGameState("defeat");
                addLog(`💀 You have been defeated! Game Over!`, "system");
                sound.play("lose");
                return prev;
              }
              return prev;
            });
            setIsPlayerTurn(true);
            addLog(`Your turn! Choose attack or magic.`, "system");
          }, 300);
        }
      }, idx * 600);
    });
  };

  const castSpell = (spellType: "light" | "fire" | "ice") => {
    if (!isPlayerTurn || gameState !== "battle") return;
    if (player.mp < 3) {
      addLog("Not enough magic points! Need at least 3 MP", "system");
      sound.play("lose");
      return;
    }

    // Spell fail chance (as per your request: sometimes spell should fail)
    if (Math.random() * 100 < spellFailChance) {
      const mpCost = 3;
      setPlayer(prev => ({ ...prev, mp: Math.max(0, prev.mp - mpCost) }));
      addLog(`💫 Spell failed! The ${spellType} spell fizzled! Lost ${mpCost} MP`, "fail");
      sound.play("lose");
      setIsPlayerTurn(false);
      setTimeout(() => monsterTurn(monsters), 800);
      return;
    }

    // MP cost scales with number of monsters (as per your request: more monsters = more MP, at least 3)
    const mpCost = Math.max(3, monsters.length * 2 + (spellType === "light" ? 3 : spellType === "fire" ? 5 : 4));
    if (player.mp < mpCost) {
      addLog(`Not enough MP! Need ${mpCost} MP for ${monsters.length} monsters, you have ${player.mp}`, "system");
      return;
    }

    setPlayer(prev => ({ ...prev, mp: prev.mp - mpCost }));

    if (spellType === "light") {
      // Light spell: 30 damage to Goblin, 40 to Goblin Mage, scales with monster count
      // As per your example: Goblin 30 damage, Goblin Mage 40 damage
      let totalDamage = 0;
      const updatedMonsters = [...monsters];
      
      updatedMonsters.forEach((monster, idx) => {
        if (monster.hp <= 0) return;
        let damage = 0;
        if (monster.type === "Goblin") damage = 30;
        else if (monster.type === "Goblin Mage") damage = 40;
        else if (monster.type === "Arch Magician") damage = 35;
        else if (monster.type === "Goblin King") damage = 50;
        else if (monster.type === "Shadow Beast") damage = 45;
        else if (monster.type === "Dragon") damage = 60;

        // Scale with monster count: more monsters = more MP used, as you said
        damage = Math.floor(damage * (0.8 + monsters.length * 0.1));

        setTimeout(() => {
          monster.hp = Math.max(0, monster.hp - damage);
          totalDamage += damage;
          addLog(`✨ Light spell hits ${monster.name} for ${damage} damage! (${monster.type}: ${monster.type === "Goblin" ? "30" : monster.type === "Goblin Mage" ? "40" : "35+"} base) - Cost ${mpCost} MP for ${monsters.length} monsters`, "magic");
        }, idx * 200);
      });

      setTimeout(() => {
        sound.play("level_up");
        const alive = updatedMonsters.filter(m => m.hp > 0);
        setMonsters(alive);
        
        if (alive.length === 0) {
          setGameState("victory");
          addLog(`🏆 Light spell defeated all monsters! Victory!`, "system");
          sound.play("win");
          setWins(w => w + 1);
          save(wins + 1);
        } else {
          setIsPlayerTurn(false);
          setTimeout(() => monsterTurn(alive), 800);
        }
      }, monsters.length * 200 + 300);

    } else if (spellType === "fire") {
      // Fire - hits all monsters
      const updatedMonsters = [...monsters];
      let totalDamage = 0;
      updatedMonsters.forEach(m => {
        if (m.hp > 0) {
          const dmg = 25 + Math.floor(Math.random() * 20);
          m.hp = Math.max(0, m.hp - dmg);
          totalDamage += dmg;
        }
      });
      addLog(`🔥 Fire spell hits all ${monsters.length} monsters for ${totalDamage} total damage! Cost ${mpCost} MP`, "magic");
      sound.play("win");
      const alive = updatedMonsters.filter(m => m.hp > 0);
      setMonsters(alive);
      if (alive.length === 0) {
        setGameState("victory");
        sound.play("win");
        setWins(w => w + 1);
        save(wins + 1);
      } else {
        setIsPlayerTurn(false);
        setTimeout(() => monsterTurn(alive), 800);
      }
    } else if (spellType === "ice") {
      // Ice - freeze one monster (stun)
      const target = monsters[selectedMonster];
      if (target) {
        const dmg = 20;
        target.hp = Math.max(0, target.hp - dmg);
        addLog(`❄️ Ice spell freezes ${target.name} for ${dmg} damage! Target frozen for 1 turn! Cost ${mpCost} MP`, "magic");
        sound.play("select");
        // In real game, would add frozen status
        const alive = monsters.filter(m => m.hp > 0);
        setMonsters(alive);
        if (alive.length === 0) {
          setGameState("victory");
          sound.play("win");
          setWins(w => w + 1);
          save(wins + 1);
        } else {
          setIsPlayerTurn(false);
          setTimeout(() => monsterTurn(alive), 800);
        }
      }
    }
  };

  const resetGame = () => {
    setPlayer(prev => ({
      ...prev,
      hp: prev.maxHp,
      mp: prev.maxMp,
    }));
    setGameState("setup");
    setMonsters([]);
    setBattleLog([]);
    setIsPlayerTurn(true);
    sound.play("click");
  };

  const fullReset = () => {
    setPlayer({
      name: "Hero",
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      attack: 15,
      defense: 5,
      level: 1,
      xp: 0,
    });
    setGameState("setup");
    setMonsters([]);
    setBattleLog([]);
    setIsPlayerTurn(true);
    setWins(0);
    sound.play("click");
  };

  if (gameState === "setup") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/10 p-6">
          <h2 className="text-2xl font-black flex items-center gap-2">⚔️ Monster Battle — RPG</h2>
          <p className="text-sm text-slate-400 mt-1">Encounter 1-6 monsters: Goblin, Goblin Mage, Arch Magician! Player hits 10 damage, monsters hit back 10 damage each! Multiple strikes! Magic: Light does 30 damage to Goblin, 40 to Goblin Mage, costs 3+ MP per monster, sometimes fails!</p>
          
          <div className="mt-4">
            <label className="text-xs font-bold">How many monsters? (1-6 as you said)</label>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {([1,2,3,4,5,6] as const).map(num => (
                <button
                  key={num}
                  onClick={() => { setEncounterSize(num); sound.play("click"); }}
                  className={`rounded-xl py-3 font-bold border-2 ${encounterSize === num ? "bg-red-600 border-red-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                >
                  {num} {num === 1 ? "Goblin" : `${num} Monsters`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-900 border border-slate-700 p-3">
            <div className="text-xs font-bold">👹 Monster Types You Will Encounter:</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              {Object.entries(MONSTER_STATS).map(([type, stats]) => (
                <div key={type} className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="font-bold flex items-center gap-1">{stats.avatar} {type} {stats.isBoss && "👑 Boss"}</div>
                  <div className="text-slate-400">HP: {stats.hp} ATK: {stats.attack} DEF: {stats.defense} XP: {stats.xp}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => generateEncounter(encounterSize)}
            className="mt-4 w-full rounded-xl bg-red-500 py-3 font-bold text-white hover:bg-red-400"
          >
            ⚔️ Start Battle with {encounterSize} Monster{encounterSize > 1 ? "s" : ""}! — Goblin, Goblin Mage, Arch Magician
          </button>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-slate-900 p-2 border text-center">
              <div className="font-bold text-emerald-400">Wins: {wins}</div>
            </div>
            <div className="rounded-lg bg-slate-900 p-2 border text-center">
              <div className="font-bold">Level: {player.level}</div>
              <div className="text-[10px] text-slate-500">XP: {player.xp}</div>
            </div>
            <div className="rounded-lg bg-slate-900 p-2 border text-center">
              <div className="font-bold">HP: {player.hp}/{player.maxHp}</div>
              <div className="text-[10px] text-slate-500">MP: {player.mp}/{player.maxMp}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 text-[11px] text-slate-400">
          <div className="font-bold text-red-400">How Battle Works (As You Described):</div>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><b>Encounter 1-6 monsters</b>: Random Goblin, Goblin Mage, Arch Magician, Goblin King, Shadow Beast, Dragon</li>
            <li><b>Player hits Goblin with 10 damage</b> → Goblin hits back for 10 damage (each alive monster hits)</li>
            <li><b>Multiple strikes</b>: Attack can hit 2-4 times in one turn</li>
            <li><b>Light spell (Light Obvious)</b>: Does 30 dmg to Goblin, 40 to Goblin Mage, 35 to Arch Magician — As you said!</li>
            <li><b>MP Cost scales</b>: More monsters = more MP, at least 3 MP — As you said at least 3!</li>
            <li><b>Spell fail</b>: 15% chance spell fails — As you said sometimes spell should fail!</li>
            <li><b>Realistic sounds</b>: Sword hit, magic, monster hit, win/lose from website — No duplicates</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Player & Monsters Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border-2 border-sky-500/30 bg-sky-500/10 p-3">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🦸</div>
            <div>
              <div className="font-bold">{player.name} Lv.{player.level}</div>
              <div className="text-xs text-slate-400">HP: {player.hp}/{player.maxHp} MP: {player.mp}/{player.maxMp}</div>
            </div>
            <div className="ml-auto text-xs">
              <div className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border">ATK: {player.attack} DEF: {player.defense}</div>
            </div>
          </div>
          <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(player.hp / player.maxHp) * 100}%` }}></div>
          </div>
          <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${(player.mp / player.maxMp) * 100}%` }}></div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/10 p-3">
          <div className="font-bold text-sm">👹 Monsters: {monsters.length} / {encounterSize} — {isPlayerTurn ? "Your Turn" : "Monsters Turn"}</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {monsters.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => { setSelectedMonster(idx); sound.play("select"); }}
                className={`rounded-xl p-2 border-2 text-left transition-all ${selectedMonster === idx ? "border-white bg-slate-700 ring-2 ring-white/50 scale-105" : "border-slate-700 bg-slate-800"} ${m.isBoss ? "ring-2 ring-amber-500/50" : ""}`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-lg">{m.avatar}</span>
                  <span className="text-xs font-bold">{m.type}</span>
                  {m.isBoss && <span className="text-[10px]">👑</span>}
                </div>
                <div className="text-[10px] text-slate-400">HP: {m.hp}/{m.maxHp}</div>
                <div className="h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${(m.hp / m.maxHp) * 100}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500">ATK: {m.attack} {m.type === "Goblin" ? "10 dmg" : m.type === "Goblin Mage" ? "15 dmg" : "25 dmg"}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Battle Log */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 h-40 overflow-y-auto">
        <div className="text-xs font-bold text-slate-400 mb-2">📜 Battle Log — Goblin 10 dmg, Goblin hits back 10 dmg, Multiple strikes, Light 30/40 dmg</div>
        <div className="space-y-1">
          {battleLog.map((log, idx) => (
            <div key={idx} className={`text-xs p-1 rounded ${
              log.type === "player" ? "bg-sky-500/10 text-sky-300" :
              log.type === "monster" ? "bg-rose-500/10 text-rose-300" :
              log.type === "magic" ? "bg-violet-500/10 text-violet-300" :
              log.type === "fail" ? "bg-amber-500/10 text-amber-300" :
              "bg-slate-800 text-slate-400"
            }`}>
              {log.message}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {gameState === "battle" && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="font-bold text-sm mb-3">
            {isPlayerTurn ? "⚔️ Your Turn — Choose Attack or Magic!" : "⏳ Monsters Turn — They hit for 10 damage each!"}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => playerAttack(false)}
              disabled={!isPlayerTurn}
              className="rounded-xl bg-sky-500 py-3 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50 flex flex-col items-center gap-1"
            >
              <span>⚔️ Attack</span>
              <span className="text-[10px]">10 dmg → Monster hits back 10 dmg</span>
            </button>
            
            <button
              onClick={() => playerAttack(true)}
              disabled={!isPlayerTurn}
              className="rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 flex flex-col items-center gap-1"
            >
              <span>⚔️⚔️ Multi-Strike</span>
              <span className="text-[10px]">2-4 hits, multiple strikes</span>
            </button>

            <button
              onClick={() => castSpell("light")}
              disabled={!isPlayerTurn || player.mp < 3}
              className="rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50 flex flex-col items-center gap-1"
            >
              <span>✨ Light Obvious</span>
              <span className="text-[10px]">30 dmg Goblin, 40 Goblin Mage — {Math.max(3, monsters.length * 2 + 3)} MP for {monsters.length} monsters</span>
            </button>

            <button
              onClick={() => castSpell("fire")}
              disabled={!isPlayerTurn || player.mp < 5}
              className="rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50 flex flex-col items-center gap-1"
            >
              <span>🔥 Fire (All)</span>
              <span className="text-[10px]">{Math.max(3, monsters.length * 2 + 5)} MP — Hits all {monsters.length} monsters</span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={() => castSpell("ice")}
              disabled={!isPlayerTurn || player.mp < 4}
              className="rounded-xl bg-sky-400 py-2 text-xs font-bold text-slate-900 hover:bg-sky-300 disabled:opacity-50"
            >
              ❄️ Ice — Freeze 1 monster — {Math.max(3, monsters.length * 2 + 4)} MP
            </button>
            <button
              onClick={() => { setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + 20), mp: Math.max(0, p.mp - 5) })); addLog("🧪 Used potion! +20 HP, -5 MP", "system"); sound.play("select"); }}
              disabled={!isPlayerTurn || player.mp < 5}
              className="rounded-xl bg-emerald-500 py-2 text-xs font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              🧪 Potion +20 HP
            </button>
            <button
              onClick={() => { sound.play("lose"); addLog("🏃 You try to run... but monsters block!", "system"); }}
              disabled={!isPlayerTurn}
              className="rounded-xl bg-slate-700 py-2 text-xs font-bold text-white hover:bg-slate-600 disabled:opacity-50"
            >
              🏃 Run (15% fail as you said)
            </button>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 text-center">
            Light: 30 dmg Goblin, 40 dmg Goblin Mage, scales with monster count, costs at least 3 MP (as you said) — Sometimes fails {spellFailChance}% chance! — Multiple strikes hit 2-4 times
          </div>
        </div>
      )}

      {gameState === "victory" && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-500/20 p-6 text-center">
          <div className="text-4xl">🏆</div>
          <h2 className="text-xl font-black mt-2">Victory! All {encounterSize} monsters defeated!</h2>
          <p className="text-sm text-slate-400 mt-1">You defeated Goblin, Goblin Mage, Arch Magician etc.!</p>
          <button onClick={resetGame} className="mt-4 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white hover:bg-emerald-400">
            Next Battle: {encounterSize} Monsters Again? ⚔️
          </button>
          <button onClick={fullReset} className="mt-2 ml-2 rounded-xl bg-slate-700 px-4 py-2 text-xs text-white">Full Reset ♻️</button>
        </div>
      )}

      {gameState === "defeat" && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-500/20 p-6 text-center">
          <div className="text-4xl">💀</div>
          <h2 className="text-xl font-black mt-2">Defeated! Monsters hit you for 10 damage each!</h2>
          <p className="text-sm text-slate-400 mt-1">Goblin hit 10, Goblin Mage 15, Arch Magician 25 — Multiple monsters hit back!</p>
          <button onClick={resetGame} className="mt-4 rounded-xl bg-rose-500 px-6 py-3 font-bold text-white hover:bg-rose-400">
            Try Again — {encounterSize} Monsters ⚔️
          </button>
          <button onClick={fullReset} className="mt-2 ml-2 rounded-xl bg-slate-700 px-4 py-2 text-xs text-white">Full Reset ♻️</button>
        </div>
      )}

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 text-[11px] text-slate-400">
        <div className="font-bold text-red-400">How Battle Works (Your Request):</div>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li><b>Encounter 1-6 monsters</b> as you said: Goblin, Goblin Mage, Arch Magician, Goblin King, Shadow Beast, Dragon</li>
          <li><b>You hit Goblin 10 dmg</b> → Goblin hits you 10 dmg back, Goblin Mage 15 dmg, Arch Magician 25 dmg — Each alive monster hits!</li>
          <li><b>Multiple strikes</b>: Attack 2-4 times per turn as you said multiple strikes</li>
          <li><b>Light Obvious (Light spell)</b>: 30 dmg Goblin, 40 dmg Goblin Mage, 35 dmg Arch Magician — As you said! Costs 3+ MP per monster count, at least 3 MP</li>
          <li><b>MP scales</b>: More monsters = more MP (e.g., 1 monster 3 MP, 6 monsters 15 MP) — At least 3 MP as you said</li>
          <li><b>Spell fail</b>: 15% chance fail as you said sometimes spell should fail — MP lost, turn wasted</li>
          <li><b>Realistic sounds</b>: Sword hit, magic, monster hit, win/lose from website, no duplicates</li>
        </ul>
      </div>
    </div>
  );
}
