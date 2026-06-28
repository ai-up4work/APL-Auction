// lib/auctionDefaults.ts
// Default IPL-style teams and players pre-populated for every new auction.

import type { Team, Player } from "@/types/auction";

let _tid = 100;
let _pid = 100;

export const DEFAULT_TEAMS: Omit<Team, "supabaseId" | "roster">[] = [
  { id: _tid++, code: "CSK",  name: "Chennai Super Kings",         tier: "A", owner: "Ambani",        pin: "123456", color: "#F9CD1C", logo: "" },
  { id: _tid++, code: "MI",   name: "Mumbai Indians",              tier: "A", owner: "Mumbai",        pin: "234578", color: "#004BA0", logo: "" },
  { id: _tid++, code: "RCB",  name: "Royal Challengers Bengaluru", tier: "A", owner: "Bengaluru",     pin: "345678", color: "#EC1C24", logo: "" },
  { id: _tid++, code: "KKR",  name: "Kolkata Knight Riders",       tier: "A", owner: "Kolkata",       pin: "456789", color: "#3A225D", logo: "" },
  { id: _tid++, code: "SRH",  name: "Sunrisers Hyderabad",         tier: "B", owner: "Hyderabad",     pin: "567890", color: "#F26522", logo: "" },
  { id: _tid++, code: "PBKS", name: "Punjab Kings",                tier: "B", owner: "Punjab",        pin: "678901", color: "#ED1B24", logo: "" },
  { id: _tid++, code: "RR",   name: "Rajasthan Royals",            tier: "B", owner: "Rajasthan",     pin: "789012", color: "#254AA5", logo: "" },
  { id: _tid++, code: "DC",   name: "Delhi Capitals",              tier: "B", owner: "Delhi",         pin: "890123", color: "#0078BC", logo: "" },
  { id: _tid++, code: "GT",   name: "Gujarat Titans",              tier: "C", owner: "Gujarat",       pin: "901234", color: "#1C4E9D", logo: "" },
  { id: _tid++, code: "LSG",  name: "Lucknow Super Giants",        tier: "C", owner: "Uttar Pradesh", pin: "012345", color: "#A72056", logo: "" },
];

export const DEFAULT_PLAYERS: Omit<Player, "supabaseId">[] = [
  // Batters
  { id: _pid++, name: "Virat Kohli",       role: "Batter",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Rohit Sharma",      role: "Batter",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Shubman Gill",      role: "Batter",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "KL Rahul",          role: "Batter",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Ruturaj Gaikwad",   role: "Batter",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Yashasvi Jaiswal",  role: "Batter",      origin: "local",    price: 500, capped: false, img: "", country: "India"       },
  { id: _pid++, name: "Shreyas Iyer",      role: "Batter",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Sanju Samson",      role: "WK-Batter",   origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  // All-rounders
  { id: _pid++, name: "Hardik Pandya",     role: "All-rounder", origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Ravindra Jadeja",   role: "All-rounder", origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Axar Patel",        role: "All-rounder", origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Washington Sundar", role: "All-rounder", origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Venkatesh Iyer",    role: "All-rounder", origin: "local",    price: 500, capped: false, img: "", country: "India"       },
  // Bowlers
  { id: _pid++, name: "Jasprit Bumrah",    role: "Bowler",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Mohammed Shami",    role: "Bowler",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Yuzvendra Chahal",  role: "Bowler",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "Arshdeep Singh",    role: "Bowler",      origin: "local",    price: 500, capped: true,  img: "", country: "India"       },
  { id: _pid++, name: "T Natarajan",       role: "Bowler",      origin: "local",    price: 500, capped: false, img: "", country: "India"       },
  // Overseas
  { id: _pid++, name: "Jos Buttler",       role: "WK-Batter",   origin: "overseas", price: 500, capped: true,  img: "", country: "England"     },
  { id: _pid++, name: "David Warner",      role: "Batter",      origin: "overseas", price: 500, capped: true,  img: "", country: "Australia"   },
  { id: _pid++, name: "Pat Cummins",       role: "Bowler",      origin: "overseas", price: 500, capped: true,  img: "", country: "Australia"   },
  { id: _pid++, name: "Rashid Khan",       role: "Bowler",      origin: "overseas", price: 500, capped: true,  img: "", country: "Afghanistan" },
  { id: _pid++, name: "Nicholas Pooran",   role: "WK-Batter",   origin: "overseas", price: 500, capped: true,  img: "", country: "West Indies" },
  { id: _pid++, name: "Faf du Plessis",    role: "Batter",      origin: "overseas", price: 500, capped: true,  img: "", country: "South Africa"},
  { id: _pid++, name: "Mitchell Starc",    role: "Bowler",      origin: "overseas", price: 500, capped: true,  img: "", country: "Australia"   },
  { id: _pid++, name: "Sunil Narine",      role: "All-rounder", origin: "overseas", price: 500, capped: true,  img: "", country: "West Indies" },
];