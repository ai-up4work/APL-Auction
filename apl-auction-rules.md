# APL Auction — How It Should Work

## Pre-Auction (Admin Side)

Before the auction begins, the admin completes all five setup steps in the War Room.

### Step 1 — Teams
- All franchises are registered with their name, logo, identity colour, and owner details.
- Each team is automatically allocated **50,000 points** as their total bidding budget.
- If an owner wishes to play as a participant in the league, they flag this during setup:
  - **3,000 points** are automatically deducted from their team's budget at auction start.
  - One squad slot is pre-filled with the owner.

### Step 2 — Players
- Every eligible player is added to the pool with their name, role (Batsman / Bowler / All-rounder / Wicket Keeper), origin (Local / Overseas), and photo.
- Every player's base price is set to **500 points** by default. The admin can adjust individual base prices if needed.
- The full pool is then **locked** — no players can be added or removed once the auction begins.

### Step 3 — Rules
- The admin confirms or adjusts:
  - The bidding increment tier table
  - Squad size (**16**)
  - Base price (**500 pts**)
  - Overseas rules
- These settings are **locked on launch**.

### Step 4 — Session
- The admin sets the auction name, date, time, venue, auctioneer name, bid countdown timer (default **15 seconds**), and access mode (private / spectator link / broadcast display).

### Step 5 — Launch
- Admin runs the pre-flight checklist:
  - All teams present
  - All players added
  - Shuffle order generated
- Once all checks pass, the **Start Auction** button activates and the admin launches into **Live Mode**.

---

## The Auction Room — Live

Once launched, the system enters **Live Mode**. All configuration is now locked. Team owners join via their assigned credentials.

### Round Structure
- The auction does **not** have rounds by role or category — all players are treated equally and enter the pool in the shuffled order generated before launch.
- There are no marquee sets or priority groups.

### Player Entry
The auctioneer (or the system automatically) calls the next player from the shuffled queue. The player's card appears on screen showing:
- Name, photo, role, origin
- Base price: 500 points
- Current highest bid: —
- Current highest bidder: —
- Countdown timer: 15 seconds

### Bidding
- The timer starts at **15 seconds** the moment a player is called.
- Any team that has not yet filled their 16-player squad and has sufficient points remaining can place a bid.
- Bids must meet the minimum increment based on the current price tier:

| Current Bid | Minimum Next Bid |
|---|---|
| 500 – 1,000 pts | +100 pts |
| 1,000 – 3,000 pts | +200 pts |
| 3,000 – 6,000 pts | +500 pts |
| 6,000 – 20,000 pts | +1,000 pts |
| Above 20,000 pts | +2,000 pts |

- Every time a new bid is placed, the timer resets to 15 seconds. This continues until no new bid comes in before the timer hits zero.
- When the timer hits 0 with no new bid, the player is **sold** to the highest bidder at the current price. That amount is deducted from the winning team's remaining points budget.

### Team Elimination from Bidding
A team is automatically excluded from bidding on a player if:
- They have already filled all **16 squad slots**, OR
- Their remaining points are less than the current bid + minimum increment (they can't afford to outbid)

Once a team fills 16 players, they exit the auction entirely — they cannot bid on any further players.

### Unsold Players
- If a player receives no bids (no team bids above the 500 pt base price before the timer expires), the player is marked **unsold** and set aside.
- At the end of the main auction, all unsold players are reintroduced one by one at the same 500 point base price.
- Teams that still have open slots and remaining budget can bid again.

### Points Management
Teams must be strategic. With 50,000 points and 16 slots to fill:
- Average spend per player = **3,125 points**
- Minimum possible spend (all at base) = **8,000 points** (16 × 500)
- A team that overspends early risks being unable to fill all 16 slots

If a team cannot fill all 16 slots by the end of the auction (including the unsold re-entry round), the **APL Auction Committee** may impose penalties or take corrective action per Rule 7.

### Bidding Discipline
- No fake bids — a bid placed cannot be withdrawn
- No time-wasting bids — deliberately stalling is a violation
- Violations result in bid cancellation, point penalties, or suspension from the auction at the committee's discretion
- The admin has override controls to cancel a bid or pause the auction

---

## Post-Auction

Once all players are sold or the unsold re-entry round concludes:
- Each team owner submits their final squad list of 16 players with all bid amounts confirmed
- The system generates a full auction report — every player, winning team, and points spent
- Any disputes are escalated to the APL Auction Committee, whose decision is final and binding
- The admin closes the session — all data is locked and the league moves to the scheduling phase

---

## Summary of Key Numbers

| Rule | Value |
|---|---|
| Budget per team | 50,000 pts |
| Squad size | 16 players |
| Base price | 500 pts |
| Owner buy-in | 3,000 pts |
| Bid timer | 15 seconds |
| Unsold re-entry base | 500 pts |
