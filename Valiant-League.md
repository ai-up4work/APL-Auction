# Valiant League — Platform Knowledge Transfer

> A complete working understanding of the product, compiled from the landing page, admin panels, and live/overlay code reviewed so far. This is meant as a reference document for anyone (human or AI) picking up this codebase cold.

---

## 1. What This Product Is

**Valiant League** is a SaaS platform built for **cricket clubs and tournament organizers**. It is sold (per the landing page) as a one-time / tiered product (Casual / Club / Franchise) that lets a club run an entire cricket competition lifecycle — **draft players via a live points-based auction, build a tournament bracket from the resulting teams, and broadcast matches with a live-synced overlay** — all from one connected system.

The three modules share live data: an action in one place (a bid, a match result, an overlay toggle) is reflected everywhere else instantly. This is achieved via **Supabase** (Postgres + Realtime channels) as the backing store and sync layer throughout.

There is **no real-money gambling** — the auction currency is a **virtual points/purse system** configured per tournament, not cash.

---

## 2. The Three Core Modules (High Level)

| Module | Purpose | Icon on landing page |
|---|---|---|
| **Auction** | Live, points-based player draft for forming team squads | Gavel |
| **Tournament** | Bracket generation & match progression (single/double elimination) | Trophy |
| **Overlay** | Real-time broadcast graphics for streaming actual matches (scorecard, weather, points table, etc.) | MonitorPlay |

### How they connect (inferred / to be confirmed with the user)
- The **Auction** produces **Teams**, each with a drafted **squad of Players** (see §3).
- The **Tournament** module generates a bracket from a set of teams — currently its admin panel (`TournamentAdminPanel`) has its own local team-entry UI, but the natural intended flow is for it to consume the **teams/squads that came out of the Auction** rather than requiring re-entry.
- The **Overlay** module operates per **match** (`matchId`, resolved from an `auctionId`), suggesting one auction/club "space" can have **multiple matches over time** — most plausibly, one match per bracket fixture in the Tournament module. Team info pushed into `MatchSetup` (name, color, logo, squad) lines up closely with the Auction's own Team/Player shapes.
- **Open question for the product owner:** confirm whether the intended pipeline is strictly `Auction → Teams+Squads → Tournament bracket → per-fixture Overlay session`, or whether Tournament/Overlay are meant to also work fully standalone (teams entered independently, no auction run at all).

---

## 3. Module Deep Dive: AUCTION

### 3.1 Core Concept
Teams do **not** bid with real money. Each team gets a **fixed points budget (purse)** set in Rules; players are bought by bidding those points away, with a **tiered increment system** (higher price bands require bigger minimum raises — same idea as IPL-style auctions).

### 3.2 Roles / Interfaces
| Interface | Who uses it | Purpose |
|---|---|---|
| **Admin Panel** (`/admin`) | Organizer | Configure everything before the auction starts |
| **Auctioneer Console** (`/live/[auctionId]/auctioneer`) | The person running the live auction | Call players, hammer sold/unsold, manage flow |
| **Watch/Broadcast Page** (`/watch/[auctionId]`) | Public / spectators / streamer | Real-time read-only view, streamable to Facebook/etc. |
| **Team Owner Page** | Team owners (mobile-first) | Place live bids on players *(mentioned by user, not yet reviewed in code)* |

### 3.3 Admin Panel — Configuration Tabs
The admin flow (`app/admin/page.tsx`) always opens on an **Auction Picker** (no auto-resume of last auction — deliberate, so the wrong auction is never silently shown). Once an auction is entered, config steps are:

- **Teams Tab** *(not yet reviewed in detail, referenced only)*
- **Players Tab** (`PlayersTab.tsx`)
- **Rules Tab** (`RulesTab.tsx`)
- **Session Tab** (`SessionTab.tsx`)
- **Launch Tab** (`LaunchTab.tsx`, referenced, not yet reviewed)

All config tabs **lock** once the auction status is `live` or `paused` — editing is only possible before launch, or after a "Stop"/"Re-auction" action.

#### Players Tab
- Player fields: **name, role** (Batsman / Bowler / All-rounder / Wicket Keeper), **origin** (Local / Overseas), **base price** (points, default 500), **capped** status (international experience), **photo** (uploaded via `ImageUploadField`, stored under `{auctionId}/Auction-Images/player-images/`).
- **Captain assignment**: a player can be directly assigned as a team's captain in this tab. Captains are **auto-purchased by their team at launch** (deducted from the team's purse) and **skip the live bidding pool entirely**.
- Missing-photo players still work — a placeholder is shown on the auction board; there's a non-blocking warning banner and a "Photo Coverage" stat.
- Sidebar shows: **Pool Summary** (count/value by role), **Photo Coverage**, **Captains Assigned**, **Bulk Actions** (CSV import/export — currently placeholder handlers), **Overseas Quota** breakdown, and a manual **"Lock Player Pool"** toggle (separate from the auction-live lock).
- A **Target Player Pool Size** rule (set in Rules tab) defines the minimum player count needed before the auction can launch.

#### Rules Tab
This is the mechanical heart of the auction. Configurable settings:

- **Total Points per Team** — the purse/budget.
- **Squad Size** — total roster slots per team.
- **Base Price** — default starting bid for all players (including unsold re-entries).
- **Max Overseas Players** per team (0 = unlimited).
- **Target Player Pool Size** — minimum players needed in the registry to launch.
- **Owner Participation** (toggle) — if enabled, the team owner can buy into their own squad via a fixed **Owner Self-Purchase Cost**, which is deducted from the team's budget at launch and pre-fills 1 of the squad slots (so "auctioned slots" = squad size − 1 in that case).
- **Reserve Points Enforcement** (toggle) — blocks a bid if accepting it would leave the team unable to fill its remaining slots at base price. A live warning banner calculates and shows this risk in real time as rules are edited.
- **Max Bid Time per Player** — hard cap (seconds) on how long a single player can stay on the block.
- **Bidding Increment Tiers** — a list of `{from, to, increment}` rows. "From" inclusive, "To" exclusive, last tier uncapped ("No limit"). Admin can add/delete tiers (tier 0 cannot be deleted). This is the tiered raise system: e.g. 500–1000 pts → raise by 100; 1000–3000 → raise by 200; ...; 20000+ → raise by 2000.
- **Unsold Re-entry Rounds** — how many extra passes unsold players get to be re-shuffled back into the bidding pool before being marked permanently unsold.
- A **"Current Config"** summary panel and a **"Danger Zone"** reset-to-defaults action round out the tab.

#### Session Tab
Configures the auction's identity and access, all locked once live:
- **Auction Identity**: Auction Name (required), Auctioneer Name, Venue, **Auction Logo** (represents the *organizer*, not any single team — shown on broadcast/spectator views).
- **Scheduling**: Auction Date, Start Time, and the **Bid Countdown Timer** (the "shot clock" — number of seconds before a bid auto-locks; resets on every new bid).
- **Access Mode** — one of:
  - **Private** — owners only, via PIN.
  - **Spectator Link** — public read-only view.
  - **Broadcast Display** — fullscreen big-screen mode.
  A Spectator/Broadcast Link URL field appears for the latter two modes.
- **Optional Rules**: Owner Participation (mirrors Rules tab toggle) and **Unsold Re-introduction** (whether unsold players re-enter at the end of the main auction).
- A live **Session Summary** panel mirrors all current values.

### 3.4 Live Auction Mechanics

**Lot lifecycle:** each player call is a "**lot**" with statuses:
`shuffling` (reveal animation in progress) → `pending` (live bidding, on the block) → `sold` / `unsold`.

**Shuffle system:** Players are drawn from a pre-shuffled queue (`lot_order`), not re-randomized on every call. There's a distinct **"Shuffle Lot Order"** step (a `shuffleReady` gate) that must be completed before the auctioneer can start calling players at all — separate from the *reveal* animation shown per-lot on the watch page.

**Shot clock:** A countdown (configured in Session tab) resets on every bid placed and **locks bidding** once it hits zero. Locked bidding forces the auctioneer's hand: they must **Hammer Sold** or **Mark Unsold** — no further bids accepted.

**Auctioneer Console (`/live/.../auctioneer`)** — desktop-only:
- Left sidebar: remaining player queue, with **re-entry round badges** (`R1`, `R2`, etc. for players who've been re-shuffled) and a live "awaiting re-entry" counter.
- Center: current player card (photo, role, country, base price), live high bid + leading team, **Hammer Sold** / **Mark Unsold** action buttons, live bid feed table (timestamped, team, amount, leading/outbid status), animated **SOLD/UNSOLD stamp** effects with confetti-style particles.
- Right sidebar: **Financial Dashboard** per team — avg purse, slots left, and per-team cards showing remaining budget (progress bar) and squad fullness (teams that are full get grayed out / locked from further bids).
- Top bar: Pause / Resume / **Complete Auction** (confirm-gated), live shot-clock indicator, and a prominent **"Re-entry Round"** button (badge shows pending-unsold count) once eligible.
- A post-session **Feedback Modal** fires on pause or completion.

**Unsold Re-entry Rounds:**
- Unsold players can be reshuffled back into the pool for another pass, up to the rules-configured round limit.
- A round **fails to start** (and instead permanently finalizes those players as `is_unsold_final = true`) under specific conditions: round-limit reached, all squads full, or no team can afford the cheapest unsold player. The system surfaces *which* of these reasons applied via toast messages.
- Once `is_unsold_final` is true, a player is permanently out — never a re-entry candidate again.

**Watch / Broadcast Page (`/watch/[auctionId]`)** — the public/spectator view:
- Fully realtime via Supabase subscriptions to: lots, bids, team purses, and player flags (unsold/final/reentry-count).
- **"Live" view**: hero player card with shuffle/reveal animation, SOLD/UNSOLD stamp overlays with screen-shake effect, current bid + leading team, per-team stats card (squad filled, remaining purse, top buy), a **Top Buys leaderboard** that auto-interrupts every ~25s, and a scrolling **news ticker** (sold/unsold results).
- **"Flow" view** — a toggle to a **Sankey-style visual diagram** (`FlowCanvas`) showing players flowing into franchises; player pool and franchise lists sit either side, with click-to-highlight tracing of a specific player's or team's connections. Distinguishes "permanently unsold" (dimmed, strike-through, red hatch pattern) from "awaiting re-entry" (badge with round number) from "sold" / "on the block" states.
- Once the auction status is `completed`, the Live view swaps to a **`CompletedContent`** summary screen: total lots, sold/unsold counts, top 5 buys, and per-team spend/roster/purse-left summaries.
- Header shows a live **status badge**: LIVE (red, pulsing) / PAUSED (amber) / COMPLETED (green) — reactive to realtime auction-status changes.

### 3.5 Data Model Notes (inferred from code)
- `auction_lots` table: `player_id`, `status` (`shuffling`/`pending`/`sold`/`unsold`), `winning_team_id`, `current_bid`, etc.
- `players` table: includes `is_unsold`, `is_unsold_final`, `reentry_count`, `lot_order`, `owner_team_code` (captain assignment).
- Team purses are tracked live (`remaining`, `roster` count) via `ensureTeamPurses` + `subscribeToTeamPurses`.
- Bid increments are computed via `getNextBidAmount(currentBid, tiers)` — reads the Rules-tab tier list.

---

## 4. Module Deep Dive: TOURNAMENT

### 4.1 Admin Flow (`TournamentAdminPanel`)
- Organizer builds a **team roster** (name + short code) manually, or clicks **"Autofill demo teams (32)"** for testing/demo purposes.
- **Random Draw** button shuffles seed order before generation.
- Picks a **Format**: `single_elimination` or `double_elimination`, with an inline `FormatDescription` component explaining the format before committing.
- **Generate** builds the bracket (`generateSingleElimination` / `generateDoubleElimination`) from however many teams are currently entered — bracket size is **not hardcoded to a fixed power of 2 the admin must predefine**; `generateBracketRounds` derives round count automatically from team count (e.g. 32 teams → Round of 32 → R16 → QF → SF → Final).
- Results are entered per-match via `MatchResultCard` (pick winner, enter scoreA/scoreB). Recording a result **automatically advances the winner** into the correct slot of the next round (`advanceWinner`, matched by feeder match ID, not index math). A champion banner appears once the final resolves.

### 4.2 Single Elimination
Straightforward forward-advancing bracket. `TournamentBracket` renders rounds side-by-side; winners flow forward each round.

### 4.3 Double Elimination (`DoubleElimBoard`) — the sophisticated piece
- **Two parallel bracket tracks**: **Winners bracket** ("still unbeaten," emerald accent) and **Losers bracket** ("one more loss and you're out," orange accent), each with a distinct tinted section-header banner.
- A loss in the winners bracket **drops the team into the losers bracket** instead of eliminating them outright.
- Visual connector engineering is non-trivial:
  - Cards are laid out in fixed-width columns (`COL_W`/`COL_GAP` constants); row centers are computed by measuring actual DOM rects (`computeRowCenters`), then averaging feeder-match centers for every later round — this makes the layout correct regardless of how irregular the losers-bracket round shapes get.
  - Same-column-gap connectors use a rounded "elbow" path (`elbowPath`).
  - Long vertical "drop into losers bracket" connectors are routed through a **dedicated always-empty vertical lane** (`lanePath` / `laneXBefore`) reserved to the left of each column, specifically so they never visually cut through unrelated cards stacked in between.
  - Connectors are drawn **underneath** all cards on purpose, so any part of a path that happens to pass under a (solid-background) card is naturally hidden — a line only ever appears in genuinely empty gaps.
- Both bracket finals feed into a **Grand Final**, positioned at the vertical midpoint between the two finals.
- If the team coming up from the losers bracket wins the Grand Final, a **Bracket Reset** (decider match) is triggered — since both finalists would then be tied at exactly 1 loss each.
- **Interactive team tracing**: hovering or clicking any team code highlights their *entire path* through the bracket — every card and connector they touch lights up in gold with a glow effect. Click to pin/lock the trace; click again to release.
- **Responsive fallback**: desktop gets the fully-measured absolute-position canvas with real SVG connectors (horizontally scrollable); mobile falls back to simple stacked round sections per bracket, no absolute geometry or connector lines (that geometry doesn't translate to small screens).
- A background team-logo watermark can be rendered behind the Grand Final area (`logoSrc` prop).

### 4.4 Known Gap / Confirmed Open Question
`TournamentAdminPanel` currently manages its own **local team state** (`useState<AdminTeam[]>`) — teams are typed in fresh, not pulled from the Auction module's existing teams/squads. Given the Overlay module's `MatchSetup.teamA/teamB` shape (name, shortCode, color, logoUrl, squad) closely mirrors the Auction's Team shape, the likely intended integration is to **feed Auction-drafted teams directly into Tournament bracket generation** — this needs explicit confirmation/design decision with the product owner before building the connective code.

---

## 5. Module Deep Dive: OVERLAY

This module is a full **live cricket scoring engine plus real-time broadcast graphics system** — considerably more sophisticated than "just a scoreboard overlay."

### 5.1 Key Architectural Concept: `auctionId` → `matchId`
The Overlay admin page is addressed by `auctionId` in the URL, but internally resolves/creates a separate **`matchId`** via `getOrCreateMatch(auctionId)`. This strongly implies the data model is:

> **One auction/club "space" (`auctionId`) can contain multiple matches over time**, each with its own independently persisted Match Setup, Live State, engine state, weather, and on-air channel state — all keyed by `matchId`.

This is the piece that most plausibly connects Tournament → Overlay: each bracket fixture likely gets its own `matchId` / scoring+overlay session.

### 5.2 Overlay Admin — "Control Room" (`OverlayAdminPage`)
Organized as a sequential, gated flow:

1. **Match Setup Panel** — Tournament name/season/logo, venue (with geocoding for weather), format (`T20` / `ODI` / `Test` — determines max-overs logic), match number/title, kickoff time, **Toss Winner + Decision**, and full **Team A / Team B** configuration: name, short code, color, logo, and **squad** (list of names, or richer `squadPlayers` with id + optional photo). Must be **"pushed"** to go live — this unlocks the Live State / Scorer panel below it. `matchSetupCompleted` is a persisted flag gating this.

2. **Live State / Scorer Panel (`LiveStatePanel`)** — the ball-by-ball scoring engine (`useLiveScoringEngine` hook):
   - **Crew slots**: Striker, Non-Striker, Bowler — selected by tapping a player carousel or **drag-and-drop** from the squad list. Players already occupying a role, or already dismissed, are visually locked out (with role/"OUT" badges) in the carousel so they can't be double-assigned.
   - **Ball pad**: buttons for 0/1/2/3/4/6 runs and OUT, plus an **Extras selector** (wide / no-ball / bye / leg-bye) and a **Free Hit toggle** (manual override, though no-balls should auto-imply it).
   - **Context-aware dismissal rules**: the engine computes which dismissal types are legal given the current extra/free-hit state — e.g., on a no-ball or free hit, only **Run Out** is a valid dismissal (bowled/caught/LBW etc. are disabled); on a **wide**, bowled/caught/LBW are also invalid.
   - **Wicket flow**: tapping OUT opens a detail dialog — which batsman is out, dismissal type, fielder name, and (for run-outs) how many runs were completed before the run-out.
   - **Automatic event detection** — no manual triggering needed for: boundaries (4s/6s), batting milestones (fifty/hundred), maiden overs, **innings completion** (all out / overs exhausted / target chased down), and **full match completion**. Each of these automatically fires the corresponding broadcast "moment" graphic the instant it happens.
   - **End Innings / End Match**: a confirmation dialog explains exactly what will happen (target set, second-innings reset, or full match completion + result computed + scoring locked). A **"Last Man Batting"** status card appears when the squad is exhausted of available batters, prompting End Innings/Match directly.
   - **Match Over screen**: a full takeover UI once `matchComplete` is true — trophy badge with entrance animation, winner name, margin, a soft background watermark of the winning team's logo, and **Undo & Keep Scoring** / **Restart Match** actions. Restarting keeps the *same teams and squads* from Match Setup but resets score/overs/target/result; it also explicitly *preserves* the tournament-wide points table and tournament boundary totals (since those track the whole tournament, not one match).
   - **Undo** last ball, **New Partnership**, and a **Manual Correction Panel** for fixing scoring mistakes by hand.
   - All of this ephemeral engine state (dismissed players, undo snapshot, active slot, extra type, free-hit flag, ball sequence, benched batters/bowlers, and a "match-won-already-fired" signature to prevent duplicate graphics on refresh) is **persisted to Supabase per `matchId`**, not just held in memory — meaning a page refresh or a second admin device doesn't lose scoring state or accidentally re-fire the Match Won graphic.

3. **Moments Panel** — manual/backup buttons (Four, Six, Wicket, Fifty, Hundred, Maiden, Match Won) in case a graphic needs a manual re-fire or a corrected value (e.g. editing the auto-detected match result's wording before re-firing). Each has its own inline detail form (batsman picker, dismissal detail, winner/margin/method for Match Won).

4. **Weather Panel** — geocodes the venue and fetches real weather, which becomes an ambient overlay channel; auto-fetch triggers whenever Match Setup is (re-)pushed.

5. **On Air Channels Panel (`OnAirChannels`)** — the actual live broadcast toggle board. Channels are grouped by behavior:
   - **Always On (ambient)**: Weather, Live Score Bar, Tournament Logo.
   - **Full-Screen — one at a time**: Points Table, Match Scorecard, Match Intro. Turning any of these on **auto-suppresses** all ambient + boundary channels underneath it (they're still logically "on," just visually suppressed while a full-screen channel is active — this state is tracked separately as `suppressed` vs `on`).
   - **Boundaries — manual, one at a time**: Match Boundaries totals, Tournament Boundaries totals (mutually exclusive, like a radio group).
   - A **"Clear Everything"** button and a **Test Background** toggle (for layout testing before actually going live) round it out.
   - This on-air state is persisted per `matchId` in Supabase (`loadOnAirChannels`/`saveOnAirChannels`), replacing an earlier localStorage-based version — meaning on-air state is now shared across devices/tabs, not stuck to one browser.
   - Exposes an imperative handle with `notifyMomentFired()` (auto-clears fullscreen panels after a moment graphic fires) and `notifyMatchOver()` (drops everything to just Weather + Tournament Logo once the match ends — a one-shot reset, not a permanent lock; channels can be manually re-toggled afterward).

6. **Program Monitor** — presumably a live preview of the actual broadcast output plus the shareable **Overlay URL** (`/overlay/[auctionId]`) that a streamer points OBS/streaming software at.

7. **Event Log** — a simple scrolling log of the last ~12 fired overlay events, for the admin's own visibility into what's just gone out live.

Connectivity: the whole admin page connects via `connectOverlayBus(auctionId)` — a realtime channel abstraction. On connect, or whenever the bus receives a `requestSync` event (e.g. a viewer's overlay page just loaded), the admin sends a **full sync snapshot** (channel visibility + match setup + live state + weather) so any newly-connecting overlay/viewer instantly catches up to the current live state rather than waiting for the next incremental update.

### 5.3 The Broadcast Overlay Itself: `LiveScoreBar`
The actual on-stream graphic component, rendered as a portal (so it's not affected by ancestor layout), driven purely by `liveState` + `matchSetup` props synced off the overlay bus:

- **Visual design**: a metallic gold-bezel frame, ambient team-color glow behind it, animated shine-ring spinning around each team's circular crest/logo medallion.
- **Layout**: Batting team block (slanted clip-path, team color gradient) → Score (runs-wickets) → Overs (with format-based max, e.g. `/20`) → divider → Striker (name + runs(balls), highlighted) and Non-Striker (dimmed) → collapse/hide toggle → Fielding team block.
- **"This Over" strip**: 6 cricket-ball-styled chips (`BallChip`/`CricketBall`), color- and label-coded — gold/boundary gradient for 4s/6s, red for wickets, grey for extras, dot-ball placeholder, with a pulsing ring on the *most recent* ball and a pop-in entrance animation per chip staggered by index.
- **Bottom strip**: bowler name + figures (wickets-runs, overs.balls), and venue name ("Live from [venue]").
- **Batting-team derivation logic**: independently re-derives "who's batting right now" from `tossWinner`/`tossDecision` + current `inningsNumber`, mirroring the same logic the admin's `LiveStatePanel` uses — done this way so the overlay can compute it standalone without depending on the admin page being open.
- Supports being shown/hidden either **externally controlled** (`show` prop) or **self-toggled** via a small "Show Score" pill button, with smooth scale-in/out entrance/exit animations (900ms in / 650ms out) and a `hideTrigger` prop to hide the manual toggle control entirely (e.g. for a version meant to be purely remote-controlled).
- Respects `prefers-reduced-motion` by collapsing all animation durations to effectively zero.

### 5.4 Persistence Migration Note
Several comments throughout this module explicitly flag a **migration from localStorage to Supabase** for: on-air channel state, engine sync state, live state, weather, and match setup. This was evidently a deliberate architecture upgrade to make all overlay/scoring state **shared across devices and tabs** (e.g., a scorer on a tablet and an admin reviewing on a laptop) rather than being stuck per-browser. Worth knowing if older/cached client code or docs still reference localStorage — that's now stale.

---

## 6. Cross-Cutting Technical Patterns Worth Knowing

- **Supabase Realtime everywhere**: bids, lot status, team purses, player flags, auction status, on-air channels, live cricket state, weather — all propagate live via Supabase subscriptions. Nothing in the live/broadcast paths relies on polling.
- **Full sync snapshot on (re)connect**: both the Auction watch page and the Overlay bus follow the same pattern — a freshly-connecting viewer/overlay requests (or is proactively sent) a complete current-state snapshot rather than only incremental diffs, so there's no "catching up" period with stale/blank data.
- **Locking pattern**: config surfaces (Auction Rules/Session/Players, presumably Teams) all lock the moment the parent entity goes `live`/`paused`, with a consistent `LockBanner` component and disabled-input styling. Editing resumes only via Stop or Re-auction.
- **Confirmation-gated destructive actions**: Complete Auction, End Innings/Match, Restart Match, and re-entry rounds all use explicit confirm dialogs summarizing exactly what will happen before committing.
- **Design system**: consistent use of CSS custom properties (`var(--color-theme-orange)`, `var(--color-surface-glass)`, etc.), a "glass panel" blur aesthetic, `Geist Mono`/`Archivo Narrow`/`Inter` font stack, and Material Symbols icons — this appears to be a shared design token system across all three modules (not each module rolling its own theme).
- **Mobile-aware, but desktop-primary for control surfaces**: the Auctioneer Console is explicitly desktop-only (`DesktopOnlyWrapper`); the double-elim bracket and auction watch page both have deliberate, separately-designed mobile fallbacks rather than just responsive scaling of the desktop layout.

---

## 7. Open Questions To Resolve With Product Owner

1. **Auction → Tournament handoff**: Should `TournamentAdminPanel` be wired to import teams (with drafted squads) directly from a completed Auction, rather than requiring manual re-entry? (Strongly implied by the data shapes, not yet built.)
2. **Tournament → Overlay handoff**: Is each bracket fixture meant to automatically spin up its own Overlay `matchId`/session (pre-filling Match Setup's teamA/teamB from the fixture), or is Overlay match creation currently a fully manual, independent step?
3. **Team Owner (mobile bidding) page**: mentioned by the product owner but not yet reviewed in code — needs its own pass once shared.
4. **Public Auction page**: user described a distinct "public page" for spectators separate from the streamer feed — need to confirm whether that's the same as the `/watch` page reviewed here, or a separate, simpler view.
5. **CSV import/export** in Players Tab is currently a stub (`alert(...)`) — not yet implemented.
6. **Teams Tab** (Auction module) and **Launch Tab** have been referenced but not yet reviewed in detail.