export type PlatformRegion = "kr" | "na1" | "euw1" | "eun1" | "jp1";
export type RoutingRegion = "asia" | "americas" | "europe";

export const PLATFORM_TO_ROUTING: Record<PlatformRegion, RoutingRegion> = {
  kr: "asia",
  jp1: "asia",
  na1: "americas",
  euw1: "europe",
  eun1: "europe",
};

export const PLATFORM_LABELS: Record<PlatformRegion, string> = {
  kr: "한국",
  jp1: "일본",
  na1: "북미",
  euw1: "유럽 서부",
  eun1: "유럽 동북",
};

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface LeagueEntry {
  queueType: string; // RANKED_SOLO_5x5 | RANKED_FLEX_SR
  tier: string; // IRON..CHALLENGER
  rank: string; // I..IV
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface MatchParticipant {
  puuid: string;
  riotIdGameName: string;
  riotIdTagline: string;
  teamId: number;
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  teamPosition: string;
}

export interface MatchInfo {
  matchId: string;
  gameCreation: number;
  gameDuration: number;
  queueId: number;
  participants: MatchParticipant[];
}

export class RiotApiError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`Riot API ${status}: ${url}`);
    this.name = "RiotApiError";
  }
}
