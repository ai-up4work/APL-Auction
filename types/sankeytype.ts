export interface Player {
  id: number | string;
  supabaseId?: string;
  name: string;
  /** Optional — not every display context (e.g. simple flow configs) tracks role */
  role?: string;
  origin?: string;
  price: number | string;
  capped?: boolean;
  /** Nullable — some data sources (e.g. static configs) have no image yet */
  img: string | null;
  country?: string;
  status?: 'locked' | 'sold' | 'pending' | 'unsold';
  lotOrder?: number | null;
  teamShortCode?: string | null;
}

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