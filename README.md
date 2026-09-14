# HeroBoard

Accessible browser games: **Captain’s Hand Cricket**, Snakes & Ladders, Ludo and Carrom. Plain HTML/CSS/JavaScript.

## Run and test
```sh
npm ci
npm start
npm test
npm run test:engines
```
The preview server binds to port 8080. No build step.

## Captain’s Hand Cricket
- Classic rules: choose 1–6; matching numbers are always out; otherwise the batter scores their selected number.
- Difficulty 1–5 changes AI learning from previous balls, not the current hidden choice.
- Separate native collapsed controls for overs and wickets; six balls per over. Setup choices persist.
- 1/2/3/5/11 players per side. Wickets include 6–11 and 15–17; extra-wicket arcade formats recycle a roster when necessary and count wickets separately.
- Pass-and-play does not speak or display the first secret pick.
- Room host chooses team names, team size, and two joined captains (host/player 2 defaults). Captains alternate drafting teammates. A size of 5 includes the captain.
- Captains choose their own active batter/bowler only; selections lock once either pick is committed. Unpicked players spectate.
- SHA-256 commit/reveal prevents changing a number after the opposing pick locks in normal trusted-device play. It is not a security boundary against a modified client or dishonest host.

## Snakes & Ladders turn flow
- Select **vs AI** and **2 AI opponents** for Player 1 (Red), AI 1 (Green) and AI 2 (Yellow).
- Local and room player counts remain separate from the AI-opponent count.
- A neutral start cue plays only on starting/restarting a match; results are never announced at startup.
- Dice sound alone → “Red rolls 5” → one tick per square, 500 ms apart → “Red moved from Start to square 5.” No per-square speech.
- A six earns another turn, including consecutive AI sixes. A winning move ends the match instead.
- Start is off the board (position 0): a first roll of 5 visits squares 1–5. From square 1, a roll of 5 ends on square 6.
- Exact finish is required; reaching 100 by ladder also wins. Overshoots do not move.
- Pause/resume is available. Hiding the tab pauses the sequence; quitting/restarting cancels old timers and speech waits.
- `npm run test:snakes` runs dedicated sequencing, extra-turn, state-isolation, cancellation and audio-completion regressions.

## Audio and accessibility
Distinct recorded crowd cues for four, five and six; recorded milestone applause. **See [AUDIO_CREDITS.md](AUDIO_CREDITS.md)** for creator, CC BY 4.0 license and edits. Black Soul Ultimate uses a separate CC0 recorded transition. Other HeroBoard effects/music remain browser synthesis. No AI-generated files were added.

Keyboard-operable controls, labelled selects, native disclosures, visible focus, live announcements, optional app speech, modal focus containment, persistent sound settings and reduced motion. OS TalkBack remains independent; disable app speech if it duplicates your screen reader. Hiding/closing the game stops playback.

## Room limitations
**Rooms currently work between tabs on the same browser/device only.** Use different profiles per tab and keep the host tab open. There is no authenticated internet backend configured. The legacy permissive Supabase path is disabled; see [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Do not describe this release as verified secure internet multiplayer.

## Release status
September 2026 changes are tested locally. A local preview is not a production deployment. See the workspace review report for exact tests and outstanding checks.
