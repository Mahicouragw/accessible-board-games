"use client";

import { useState, useEffect, useRef } from "react";
import { sound } from "@/lib/sound";
import { useSaveScore } from "@/lib/useSaveScore";
import { announce } from "@/lib/a11y";

type Player = {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  howOut?: string;
};

type Team = {
  name: string;
  players: Player[];
  totalRuns: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: number;
};

type BallOutcome = {
  runs: number;
  isWicket: boolean;
  isWide?: boolean;
  isNoBall?: boolean;
  commentary: string;
};

const TEAM_NAMES = ["Mumbai Indians", "Chennai Super Kings", "Royal Challengers", "Kolkata Knight Riders", "Delhi Capitals", "Sunrisers Hyderabad", "Rajasthan Royals", "Gujarat Titans"];
const PLAYER_NAMES = ["Rohit", "Virat", "Dhoni", "Raina", "Kohli", "Rahul", "Pant", "Bumrah", "Jadeja", "Hardik", "Gill", "Iyer", "Surya", "Warner", "Buttler", "Stokes", "Russell", "Narine", "Bravo", "Pollard"];

function getRandomPlayerName(existing: string[]): string {
  const available = PLAYER_NAMES.filter(n => !existing.includes(n));
  if (available.length === 0) return `Player ${existing.length + 1}`;
  return available[Math.floor(Math.random() * available.length)];
}

function generateBallOutcome(battingSkill = 50): BallOutcome {
  const rand = Math.random() * 100;
  
  // Skill affects probabilities - higher skill = more runs, fewer wickets
  const skillFactor = battingSkill / 50;
  
  if (rand < 5 / skillFactor) {
    // Wicket
    const wickets = ["Bowled!", "Caught!", "LBW!", "Run Out!", "Stumped!", "Hit Wicket!"];
    return {
      runs: 0,
      isWicket: true,
      commentary: wickets[Math.floor(Math.random() * wickets.length)],
    };
  } else if (rand < 15) {
    return { runs: 0, isWicket: false, commentary: "Dot ball! No run." };
  } else if (rand < 35) {
    return { runs: 1, isWicket: false, commentary: "Single taken, easy run." };
  } else if (rand < 50) {
    return { runs: 2, isWicket: false, commentary: "Two runs! Good running!" };
  } else if (rand < 60) {
    return { runs: 3, isWicket: false, commentary: "Three runs! Excellent running!" };
  } else if (rand < 80) {
    return { runs: 4, isWicket: false, commentary: "FOUR! Beautiful shot to the boundary!" };
  } else if (rand < 85 && Math.random() < 0.1) {
    return { runs: 1, isWicket: false, isWide: true, commentary: "Wide ball! Extra run." };
  } else {
    return { runs: 6, isWicket: false, commentary: "SIX! Massive hit over the ropes! Crowd goes wild!" };
  }
}

export default function Cricket() {
  const save = useSaveScore("cricket");
  const [gameState, setGameState] = useState<"setup" | "toss" | "batting" | "bowling" | "innings_break" | "result">("setup");
  const [teamSize, setTeamSize] = useState<3 | 4 | 5 | 11>(5);
  const [overs, setOvers] = useState<5 | 10 | 20 | 50>(5);
  const [tossWinner, setTossWinner] = useState<"user" | "computer" | null>(null);
  const [tossChoice, setTossChoice] = useState<"bat" | "bowl" | null>(null);
  const [userBattingFirst, setUserBattingFirst] = useState(true);
  const [currentInnings, setCurrentInnings] = useState<1 | 2>(1);
  
  const [userTeam, setUserTeam] = useState<Team>({
    name: "Your Team",
    players: [],
    totalRuns: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: 0,
  });
  
  const [computerTeam, setComputerTeam] = useState<Team>({
    name: "Computer Team",
    players: [],
    totalRuns: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: 0,
  });

  const [striker, setStriker] = useState<number>(0);
  const [nonStriker, setNonStriker] = useState<number>(1);
  const [currentBall, setCurrentBall] = useState<number>(0);
  const [commentary, setCommentary] = useState<string>("Welcome to Accessible Cricket! Choose team size and overs to start.");
  const [ballHistory, setBallHistory] = useState<BallOutcome[]>([]);
  const [lastOutcome, setLastOutcome] = useState<BallOutcome | null>(null);
  const [isUserBatting, setIsUserBatting] = useState(true);
  const [target, setTarget] = useState<number | null>(null);

  const commentaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (commentaryRef.current) {
      commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
    }
  }, [ballHistory]);

  const initializeTeams = () => {
    const userPlayers: Player[] = [];
    const compPlayers: Player[] = [];
    const usedNames: string[] = [];
    
    for (let i = 0; i < teamSize; i++) {
      const name = getRandomPlayerName(usedNames);
      usedNames.push(name);
      userPlayers.push({
        name: i === 0 ? "You" : name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
      });
    }
    
    for (let i = 0; i < teamSize; i++) {
      const name = getRandomPlayerName(usedNames);
      usedNames.push(name);
      compPlayers.push({
        name: i === 0 ? "Computer" : name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
      });
    }

    setUserTeam({
      name: `Your Team (${teamSize} players)`,
      players: userPlayers,
      totalRuns: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      extras: 0,
    });

    setComputerTeam({
      name: `Computer Team (${teamSize} players)`,
      players: compPlayers,
      totalRuns: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      extras: 0,
    });

    setStriker(0);
    setNonStriker(1);
    setCurrentBall(0);
    setBallHistory([]);
    setLastOutcome(null);
  };

  const handleSetup = () => {
    initializeTeams();
    setGameState("toss");
    setCommentary(`Teams ready! ${teamSize} players each, ${overs} overs match. Time for toss!`);
    sound.play("select");
    announce(`Teams ready, ${teamSize} players each, ${overs} overs`);
  };

  const handleToss = (choice: "heads" | "tails") => {
    const tossResult = Math.random() < 0.5 ? "heads" : "tails";
    const userWon = choice === tossResult;
    setTossWinner(userWon ? "user" : "computer");
    setCommentary(`Toss: ${tossResult}! ${userWon ? "You won the toss!" : "Computer won the toss!"} Choose to bat or bowl.`);
    sound.play(userWon ? "win" : "lose");
    announce(`${tossResult}, ${userWon ? "you won" : "computer won"} toss`);
  };

  const handleTossChoice = (choice: "bat" | "bowl") => {
    setTossChoice(choice);
    const userBatsFirst = (tossWinner === "user" && choice === "bat") || (tossWinner === "computer" && choice === "bowl");
    setUserBattingFirst(userBatsFirst);
    setIsUserBatting(userBatsFirst);
    setCurrentInnings(1);
    setGameState("batting");
    setCommentary(`${userBatsFirst ? "You" : "Computer"} will bat first! ${userBatsFirst ? "You are batting" : "Computer is batting"}. Good luck!`);
    sound.play("select");
  };

  const playBall = () => {
    const battingTeam = isUserBatting ? userTeam : computerTeam;
    const bowlingTeam = isUserBatting ? computerTeam : userTeam;
    
    if (striker >= battingTeam.players.length) return;

    const outcome = generateBallOutcome(isUserBatting ? 60 : 50);
    setLastOutcome(outcome);

    // Update ball history
    const newHistory = [...ballHistory, outcome].slice(-20);
    setBallHistory(newHistory);

    // Update commentary
    const overStr = `${battingTeam.overs}.${battingTeam.balls}`;
    const newCommentary = `Over ${overStr}: ${outcome.commentary} ${outcome.runs > 0 ? `+${outcome.runs}` : ""} ${outcome.isWicket ? "WICKET!" : ""}`;
    setCommentary(newCommentary);
    announce(newCommentary);

    // Play realistic cricket sounds
    if (outcome.isWicket) {
      sound.play("lose");
      setTimeout(() => sound.play("capture"), 200);
    } else if (outcome.runs === 4) {
      sound.play("select");
      setTimeout(() => sound.play("win"), 100);
    } else if (outcome.runs === 6) {
      sound.play("win");
    } else if (outcome.runs > 0) {
      sound.play("move");
    } else {
      sound.play("click");
    }

    // Update batting team
    const updatedBattingTeam = { ...battingTeam };
    const strikerPlayer = updatedBattingTeam.players[striker];
    
    if (strikerPlayer) {
      strikerPlayer.balls++;
      if (!outcome.isWicket) {
        strikerPlayer.runs += outcome.runs;
        if (outcome.runs === 4) strikerPlayer.fours++;
        if (outcome.runs === 6) strikerPlayer.sixes++;
        updatedBattingTeam.totalRuns += outcome.runs;
      }
      if (outcome.isWide || outcome.isNoBall) {
        updatedBattingTeam.extras += 1;
        updatedBattingTeam.totalRuns += 1;
      }
    }

    if (outcome.isWicket) {
      strikerPlayer.out = true;
      strikerPlayer.howOut = outcome.commentary;
      updatedBattingTeam.wickets++;
      
      // Next batsman
      const nextBatsman = updatedBattingTeam.players.findIndex((p, idx) => idx > striker && !p.out && idx !== nonStriker);
      if (nextBatsman === -1) {
        // All out or no more batsmen - find any not out not currently batting
        const anyNotOut = updatedBattingTeam.players.findIndex((p, idx) => !p.out && idx !== striker && idx !== nonStriker);
        if (anyNotOut !== -1) {
          setStriker(anyNotOut);
        }
      } else {
        setStriker(nextBatsman);
      }
    } else if (outcome.runs % 2 === 1) {
      // Odd runs, switch striker
      const temp = striker;
      setStriker(nonStriker);
      setNonStriker(temp);
    }

    // Update balls and overs
    if (!outcome.isWide && !outcome.isNoBall) {
      updatedBattingTeam.balls++;
      if (updatedBattingTeam.balls >= 6) {
        updatedBattingTeam.overs++;
        updatedBattingTeam.balls = 0;
        // Switch striker at over end
        const temp = striker;
        setStriker(nonStriker);
        setNonStriker(temp);
      }
    }

    // Check innings end
    const isAllOut = updatedBattingTeam.wickets >= teamSize - 1 || updatedBattingTeam.players.filter(p => !p.out).length <= 1;
    const isOversComplete = updatedBattingTeam.overs >= overs;
    const isTargetChased = currentInnings === 2 && target !== null && updatedBattingTeam.totalRuns >= target;

    if (isAllOut || isOversComplete || isTargetChased) {
      if (currentInnings === 1) {
        // First innings over
        const firstInningsRuns = updatedBattingTeam.totalRuns;
        setTarget(firstInningsRuns + 1);
        setCommentary(`Innings Break! ${battingTeam.name} scored ${firstInningsRuns}/${updatedBattingTeam.wickets} in ${updatedBattingTeam.overs}.${updatedBattingTeam.balls} overs. ${isUserBatting ? "Computer" : "You"} need ${firstInningsRuns + 1} to win!`);
        
        if (isUserBatting) {
          setUserTeam(updatedBattingTeam);
        } else {
          setComputerTeam(updatedBattingTeam);
        }

        setCurrentInnings(2);
        setIsUserBatting(!isUserBatting);
        setGameState("innings_break");
        sound.play("turn");
        
        setTimeout(() => {
          // Reset for second innings
          const secondTeam = !isUserBatting ? userTeam : computerTeam;
          const resetPlayers = secondTeam.players.map(p => ({ ...p, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, howOut: undefined }));
          if (!isUserBatting) {
            setUserTeam({ ...userTeam, players: resetPlayers, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0 });
          } else {
            setComputerTeam({ ...computerTeam, players: resetPlayers, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0 });
          }
          setStriker(0);
          setNonStriker(1);
          setBallHistory([]);
          setGameState("batting");
        }, 3000);
      } else {
        // Second innings over - match result
        setGameState("result");
        const userFinal = isUserBatting ? updatedBattingTeam.totalRuns : userTeam.totalRuns;
        const compFinal = isUserBatting ? computerTeam.totalRuns : updatedBattingTeam.totalRuns;
        
        if (isUserBatting) {
          setUserTeam(updatedBattingTeam);
        } else {
          setComputerTeam(updatedBattingTeam);
        }

        let resultMsg = "";
        if (userFinal > compFinal) {
          const margin = currentInnings === 2 && target ? `${userFinal - compFinal} runs` : `${teamSize - 1 - updatedBattingTeam.wickets} wickets`;
          resultMsg = `🎉 You Win by ${margin}! ${userFinal} vs ${compFinal}`;
          sound.play("win");
          save(Math.max(userFinal, compFinal));
        } else if (compFinal > userFinal) {
          const margin = `${compFinal - userFinal} runs`;
          resultMsg = `😔 Computer Wins by ${margin}! ${compFinal} vs ${userFinal}`;
          sound.play("lose");
        } else {
          resultMsg = `🤝 Match Tied! Both scored ${userFinal}`;
          sound.play("turn");
        }
        setCommentary(resultMsg);
        announce(resultMsg);
      }
    } else {
      // Continue innings
      if (isUserBatting) {
        setUserTeam(updatedBattingTeam);
      } else {
        setComputerTeam(updatedBattingTeam);
      }
    }

    setCurrentBall(prev => prev + 1);
  };

  const currentBattingTeam = isUserBatting ? userTeam : computerTeam;
  const currentBowlingTeam = isUserBatting ? computerTeam : userTeam;

  if (gameState === "setup") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-6">
          <h2 className="text-2xl font-black flex items-center gap-2">🏏 Cricket — Team vs Team</h2>
          <p className="text-sm text-slate-400 mt-1">Choose team size (3,4,5,11 players) and overs (5,10,20,50) — Player vs Computer — Score like 345, 45, 50/3 etc.</p>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300">Team Size (Players per Team)</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([3, 4, 5, 11] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => { setTeamSize(size); sound.play("click"); }}
                    className={`rounded-xl py-3 text-sm font-bold border-2 ${teamSize === size ? "bg-violet-600 border-violet-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                  >
                    {size} Players {size === 3 ? "(3 vs 3)" : size === 4 ? "(4 vs 4) Ludo Style" : size === 5 ? "(5 vs 5) 345 Style" : "(11 vs 11) Real"}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">345 in one team = 3,4,5 players, 45 = 4-5 players, 50503 = 50 overs, 5 overs, 03 wickets</div>
            </div>
            
            <div>
              <label className="text-xs font-bold text-slate-300">Overs per Innings</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([5, 10, 20, 50] as const).map(o => (
                  <button
                    key={o}
                    onClick={() => { setOvers(o); sound.play("click"); }}
                    className={`rounded-xl py-3 text-sm font-bold border-2 ${overs === o ? "bg-emerald-600 border-emerald-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                  >
                    {o} Overs {o === 5 ? "(Quick 3-4-5)" : o === 50 ? "(Real 50-50)" : ""}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">5 overs = quick game 45 runs, 50 overs = real match 345 runs</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-900 border border-slate-700 p-3">
            <div className="text-xs font-bold">📱 4 Phone Numbers? Teams: {teamSize} vs {teamSize}</div>
            <div className="text-[11px] text-slate-400">Ludo style 4 players = 4 colours, but Cricket {teamSize} vs {teamSize} = Team vs Team. Score like 345/7, 45/2, 50/3, 345 vs 45 etc.</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-800 rounded p-2">Your Team: {teamSize} players<br/>Computer Team: {teamSize} players<br/>Total: {teamSize * 2} players match</div>
              <div className="bg-slate-800 rounded p-2">Overs: {overs} per innings<br/>Balls: {overs * 6} balls<br/>Target: 345 runs example</div>
            </div>
          </div>

          <button
            onClick={handleSetup}
            className="mt-4 w-full rounded-xl bg-emerald-500 py-3 font-bold text-slate-900 hover:bg-emerald-400"
          >
            Start Cricket Match 🏏 3-4-5 vs Computer — Score 345!
          </button>

          <div className="mt-3 text-[10px] text-slate-500 text-center">Realistic sounds: Bat hit, crowd cheer for 4/6, wicket, realistic music — All games</div>
        </div>

        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3">
          <div className="text-xs font-bold">🔊 Realistic Cricket Sounds:</div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-slate-400">
            <div>🏏 Bat Hit - Wooden strike</div>
            <div>🎉 Four - Crowd cheer + applause</div>
            <div>🎆 Six - Six! Massive! Crowd wild</div>
            <div>💥 Wicket - Bowled, Caught, LBW</div>
            <div>🎵 Background - Stadium crowd</div>
            <div>📱 Team - 3,4,5,11 players</div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === "toss") {
    return (
      <div className="max-w-md mx-auto rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-6 text-center">
        <div className="text-4xl">🪙</div>
        <h2 className="mt-2 text-xl font-bold">Toss Time!</h2>
        <p className="mt-1 text-sm text-slate-400">Choose heads or tails — Winner chooses bat or bowl</p>
        {!tossWinner ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => handleToss("heads")} className="rounded-xl bg-amber-500 py-3 font-bold text-slate-900 hover:bg-amber-400">Heads 🪙</button>
            <button onClick={() => handleToss("tails")} className="rounded-xl bg-slate-700 py-3 font-bold text-white hover:bg-slate-600">Tails 🪙</button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-sm font-bold text-emerald-400">{tossWinner === "user" ? "You won!" : "Computer won!"} — Choose:</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => handleTossChoice("bat")} className="rounded-xl bg-sky-500 py-3 font-bold text-white hover:bg-sky-400">🏏 Bat First</button>
              <button onClick={() => handleTossChoice("bowl")} className="rounded-xl bg-emerald-500 py-3 font-bold text-slate-900 hover:bg-emerald-400">⚾ Bowl First</button>
            </div>
          </div>
        )}
        <div className="mt-4 text-xs text-slate-500">{commentary}</div>
      </div>
    );
  }

  if (gameState === "innings_break") {
    return (
      <div className="max-w-md mx-auto rounded-2xl border-2 border-violet-500/50 bg-violet-500/10 p-6 text-center">
        <div className="text-4xl">☕</div>
        <h2 className="mt-2 text-xl font-bold">Innings Break!</h2>
        <p className="mt-2 text-sm">{commentary}</p>
        <div className="mt-4 animate-pulse text-sm text-slate-400">Starting second innings in 3 seconds...</div>
      </div>
    );
  }

  if (gameState === "result") {
    const userWon = userTeam.totalRuns > computerTeam.totalRuns;
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className={`rounded-2xl border-2 p-6 text-center ${userWon ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10"}`}>
          <div className="text-5xl">{userWon ? "🎉" : "😔"}</div>
          <h2 className="mt-2 text-2xl font-black">{userWon ? "You Win!" : "Computer Wins!"}</h2>
          <p className="mt-2 text-sm">{commentary}</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-900 p-3 border">
              <div className="text-xs text-slate-400">Your Team</div>
              <div className="text-xl font-black">{userTeam.totalRuns}/{userTeam.wickets}</div>
              <div className="text-xs text-slate-500">{userTeam.overs}.{userTeam.balls} overs</div>
            </div>
            <div className="rounded-xl bg-slate-900 p-3 border">
              <div className="text-xs text-slate-400">Computer Team</div>
              <div className="text-xl font-black">{computerTeam.totalRuns}/{computerTeam.wickets}</div>
              <div className="text-xs text-slate-500">{computerTeam.overs}.{computerTeam.balls} overs</div>
            </div>
          </div>
          <button onClick={() => { setGameState("setup"); setCommentary("Welcome to Accessible Cricket!"); }} className="mt-4 rounded-xl bg-sky-500 px-6 py-3 font-bold text-white hover:bg-sky-400">
            Play Again 🏏
          </button>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="font-bold">📊 Scorecard — Team vs Team {teamSize} vs {teamSize} — Scores like 345, 45, 50/3</h3>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-sky-400">Your Team — {userTeam.totalRuns}/{userTeam.wickets} ({userTeam.overs}.{userTeam.balls} ov)</div>
              {userTeam.players.map((p, idx) => (
                <div key={idx} className="mt-1 flex justify-between text-xs border-b border-slate-800 py-1">
                  <span className={p.out ? "text-slate-500" : "text-white font-bold"}>{p.name} {idx === striker && currentInnings === (isUserBatting ? 1 : 2) ? "*" : ""}</span>
                  <span>{p.runs} ({p.balls}) {p.fours > 0 && `${p.fours}x4`} {p.sixes > 0 && `${p.sixes}x6`} {p.out && `— ${p.howOut}`}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold text-rose-400">Computer Team — {computerTeam.totalRuns}/{computerTeam.wickets} ({computerTeam.overs}.{computerTeam.balls} ov)</div>
              {computerTeam.players.map((p, idx) => (
                <div key={idx} className="mt-1 flex justify-between text-xs border-b border-slate-800 py-1">
                  <span className={p.out ? "text-slate-500" : "text-white font-bold"}>{p.name}</span>
                  <span>{p.runs} ({p.balls}) {p.fours > 0 && `${p.fours}x4`} {p.sixes > 0 && `${p.sixes}x6`} {p.out && `— ${p.howOut}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Scoreboard like 345 vs 45, 50/3 etc */}
      <div className="rounded-2xl border-2 border-slate-700 bg-slate-900 p-4">
        <div className="flex justify-between items-center">
          <div className="text-center">
            <div className="text-xs text-slate-400">{userTeam.name}</div>
            <div className="text-2xl font-black">{userTeam.totalRuns}/{userTeam.wickets}</div>
            <div className="text-xs text-slate-500">{userTeam.overs}.{userTeam.balls} / {overs} overs</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">VS</div>
            <div className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Target: {target ? `${target}` : `${computerTeam.totalRuns + 1}`} • {teamSize} vs {teamSize}</div>
            <div className="text-xs text-slate-400 mt-1">Innings {currentInnings} • {isUserBatting ? "You Bat" : "You Bowl"}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">{computerTeam.name}</div>
            <div className="text-2xl font-black">{computerTeam.totalRuns}/{computerTeam.wickets}</div>
            <div className="text-xs text-slate-500">{computerTeam.overs}.{computerTeam.balls} / {overs} overs</div>
          </div>
        </div>

        {target && currentInnings === 2 && (
          <div className="mt-3 rounded-xl bg-violet-500/10 border border-violet-500/30 p-2 text-center">
            <div className="text-xs font-bold text-violet-300">
              {isUserBatting ? `Need ${target - currentBattingTeam.totalRuns} runs in ${(overs - currentBattingTeam.overs) * 6 - currentBattingTeam.balls} balls` : `Computer needs ${target - currentBattingTeam.totalRuns} runs`}
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-800 p-2">
            <div className="text-[10px] text-slate-500">Striker: {currentBattingTeam.players[striker]?.name} *</div>
            <div className="font-bold">{currentBattingTeam.players[striker]?.runs} ({currentBattingTeam.players[striker]?.balls})</div>
          </div>
          <div className="rounded-xl bg-slate-800 p-2">
            <div className="text-[10px] text-slate-500">Non-Striker: {currentBattingTeam.players[nonStriker]?.name}</div>
            <div className="font-bold">{currentBattingTeam.players[nonStriker]?.runs} ({currentBattingTeam.players[nonStriker]?.balls})</div>
          </div>
        </div>

        {lastOutcome && (
          <div className={`mt-3 rounded-xl p-3 text-center font-bold text-lg ${lastOutcome.isWicket ? "bg-rose-500/20 border border-rose-500/50 text-rose-400" : lastOutcome.runs === 6 ? "bg-violet-500/20 border border-violet-500/50 text-violet-300" : lastOutcome.runs === 4 ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400" : "bg-slate-800 border border-slate-700"}`}>
            {lastOutcome.isWicket ? `💥 ${lastOutcome.commentary}` : lastOutcome.runs === 0 ? "Dot Ball" : `${lastOutcome.runs} Run${lastOutcome.runs > 1 ? "s" : ""}! ${lastOutcome.commentary}`}
          </div>
        )}
      </div>

      {/* Commentary */}
      <div ref={commentaryRef} className="rounded-2xl border border-slate-800 bg-slate-900 p-3 h-32 overflow-y-auto">
        <div className="text-xs font-bold text-slate-400 mb-1">📻 Commentary — Ball by Ball (Like 345 vs 45, 50/3):</div>
        <div className="text-xs text-slate-300">{commentary}</div>
        <div className="mt-2 space-y-1">
          {ballHistory.slice(-6).map((b, i) => (
            <div key={i} className="text-[11px] text-slate-500">
              {b.runs === 0 && !b.isWicket ? "•" : b.isWicket ? "W" : b.runs} {b.commentary}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
        <div className="text-sm font-bold">
          {isUserBatting ? "🏏 Your Turn to Bat — Tap HIT!" : "⚾ Computer Batting — Watch!"}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          Player vs Computer • Team vs Team • {teamSize} players each • Score like {userTeam.totalRuns}/{userTeam.wickets} vs {computerTeam.totalRuns}/{computerTeam.wickets} — 345 Style!
        </div>
        <button
          onClick={playBall}
          disabled={!isUserBatting}
          className="mt-3 w-full rounded-xl bg-emerald-500 py-4 text-lg font-black text-slate-900 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUserBatting ? `🏏 HIT! — ${currentBattingTeam.players[striker]?.name} Batting` : "Computer Batting..."}
        </button>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
          <button onClick={() => sound.play("click")} className="rounded bg-slate-700 py-1">Click 🔊</button>
          <button onClick={() => sound.play("win")} className="rounded bg-slate-700 py-1">Four/Six 🎉</button>
          <button onClick={() => sound.setMusic(!sound.settings.music)} className="rounded bg-violet-600 py-1 text-white">Music {sound.settings.music ? "On" : "Off"} 🎵</button>
        </div>
      </div>

      {/* Scoreboard detailed */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
        <div className="text-xs font-bold">📊 Scorecard — {teamSize} vs {teamSize} — Scores like 345, 45, 50/3 etc.</div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <div className="font-bold text-sky-400">{userTeam.name} — {userTeam.totalRuns}/{userTeam.wickets}</div>
            {userTeam.players.map((p, idx) => (
              <div key={idx} className={`flex justify-between py-0.5 ${idx === striker ? "bg-slate-800 rounded px-1" : ""}`}>
                <span>{p.name}{idx === striker ? "*" : ""} {p.out ? `(${p.howOut})` : ""}</span>
                <span>{p.runs} {p.balls > 0 && `(${p.balls})`}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="font-bold text-rose-400">{computerTeam.name} — {computerTeam.totalRuns}/{computerTeam.wickets}</div>
            {computerTeam.players.map((p, idx) => (
              <div key={idx} className="flex justify-between py-0.5">
                <span>{p.name} {p.out ? `(${p.howOut})` : ""}</span>
                <span>{p.runs} {p.balls > 0 && `(${p.balls})`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
