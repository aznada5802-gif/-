export type TravelMode = "transit" | "car";

export interface Friend {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  mode: TravelMode;
}

export interface FriendOrigin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  mode: TravelMode;
}

export interface Candidate {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface TravelResult {
  friendId: string;
  label: string;
  mode: TravelMode;
  minutes: number | null;
  estimated: boolean;
  modeDetail: string | null;
}

export interface CandidateResult {
  candidate: Candidate;
  results: TravelResult[];
  maxMinutes: number | null;
  avgMinutes: number | null;
  spreadMinutes: number | null;
}

export interface OptimizeRequest {
  origins: FriendOrigin[];
}

export interface OptimizeResponse {
  ranked: CandidateResult[];
  centroid: { lat: number; lng: number };
}
