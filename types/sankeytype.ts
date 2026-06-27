export type Player = {
  id: string;
  name: string;
  status: 'sold' | 'pending' | 'locked';
  price: string;
  teamShortCode: string | null;
  img: string | null;
};

export type Team = {
  id: string;
  shortCode: string;
  name: string;
  purse: string;
  logoUrl: string | null;
};

export type AuctionConfig = {
  players: Player[];
  teams: Team[];
};
