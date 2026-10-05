export type UserRole = 'player' | 'admin';

export interface Profile {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  role: UserRole;
  assigned_club_id?: string | null;
  has_spun_wheel: boolean;
  created_at: string;
  updated_at: string;
}

export interface League {
  id: string;
  name: string;
  country: string;
  logo_url?: string | null;
  created_at: string;
}

export interface Club {
  id: string;
  league_id: string;
  name: string;
  short_name: string;
  logo_url?: string | null;
  overall_rating: number;
  created_at: string;
  leagues?: League;
}

export interface Player {
  id: string;
  club_id: string;
  name: string;
  position: string;
  rating: number;
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
  photo_url?: string | null;
  nationality?: string | null;
  created_at: string;
}

export type TournamentStatus = 'draft' | 'in_progress' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  total_rounds: number;
  current_round: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  club_id: string;
  joined_at: string;
  profiles?: Profile;
  clubs?: Club;
}

export interface Round {
  id: string;
  tournament_id: string;
  round_number: number;
  name: string;
  is_active: boolean;
  is_completed: boolean;
  created_at: string;
}

export type MatchStatus = 'scheduled' | 'live' | 'pending_approval' | 'disputed' | 'finished';

export interface Match {
  id: string;
  tournament_id: string;
  round_id: string;
  home_user_id: string;
  home_club_id: string;
  home_score: number;
  away_user_id: string;
  away_club_id: string;
  away_score: number;
  status: MatchStatus;
  local_submitted_at?: string | null;
  visitor_reviewed_at?: string | null;
  dispute_reason?: string | null;
  resolved_by?: string | null;
  created_at: string;
  updated_at: string;
  home_user?: Profile;
  away_user?: Profile;
  home_club?: Club;
  away_club?: Club;
}

export type MatchEventType = 'goal' | 'yellow_card' | 'red_card';

export interface MatchEvent {
  id: string;
  match_id: string;
  user_id: string;
  club_id: string;
  player_id?: string | null;
  event_type: MatchEventType;
  minute: number;
  created_at: string;
  players?: Player;
}

export interface LeaderboardItem {
  tournament_id: string;
  user_id: string;
  username: string;
  club_id: string;
  club_name: string;
  club_short_name: string;
  club_logo_url?: string | null;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

