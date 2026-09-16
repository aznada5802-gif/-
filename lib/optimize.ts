import { centroid, maxDistanceFromPoint, type LatLng } from "./geo";
import { searchCategoryNearby } from "./kakao";
import { resolveTravelTime } from "./travel";
import { mapWithConcurrency } from "./concurrency";
import type { Candidate, CandidateResult, FriendOrigin } from "./types";

const SUBWAY_CATEGORY = "SW8";
const MIN_RADIUS_M = 1500;
const MAX_RADIUS_M = 15000;
const MAX_STATION_CANDIDATES = 8;
const CONCURRENCY = 5;

async function buildCandidates(center: LatLng, radiusMeters: number): Promise<Candidate[]> {
  const candidates: Candidate[] = [
    {
      id: "centroid",
      name: "출발지들의 중심점",
      address: "친구들 위치의 산술 평균 좌표",
      lat: center.lat,
      lng: center.lng,
    },
  ];

  try {
    const stations = await searchCategoryNearby(center, SUBWAY_CATEGORY, radiusMeters, 15);
    for (const s of stations.slice(0, MAX_STATION_CANDIDATES)) {
      candidates.push({
        id: `station-${s.id}`,
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
      });
    }
  } catch {
    // 카카오 로컬 API 키가 없거나 실패한 경우 중심점만으로 진행
  }

  return candidates;
}

export async function findFairMeetingPoints(
  origins: FriendOrigin[]
): Promise<{ ranked: CandidateResult[]; centroid: LatLng; candidateCount: number }> {
  if (origins.length < 2) {
    throw new Error("최소 2명 이상의 출발지가 필요합니다");
  }

  const center = centroid(origins);
  const spread = maxDistanceFromPoint(origins, center);
  const radius = Math.min(Math.max(spread * 0.7, MIN_RADIUS_M), MAX_RADIUS_M);

  const candidates = await buildCandidates(center, radius);

  const pairs = candidates.flatMap((candidate) =>
    origins.map((origin) => ({ candidate, origin }))
  );

  const flatResults = await mapWithConcurrency(pairs, CONCURRENCY, async ({ candidate, origin }) => ({
    candidateId: candidate.id,
    result: await resolveTravelTime(origin, { lat: candidate.lat, lng: candidate.lng }),
  }));

  const ranked: CandidateResult[] = candidates.map((candidate) => {
    const results = flatResults
      .filter((r) => r.candidateId === candidate.id)
      .map((r) => r.result);

    const minutesList = results
      .map((r) => r.minutes)
      .filter((m): m is number => m !== null);

    const maxMinutes = minutesList.length ? Math.max(...minutesList) : null;
    const minMinutes = minutesList.length ? Math.min(...minutesList) : null;
    const avgMinutes = minutesList.length
      ? minutesList.reduce((a, b) => a + b, 0) / minutesList.length
      : null;

    return {
      candidate,
      results,
      maxMinutes,
      avgMinutes,
      spreadMinutes:
        maxMinutes !== null && minMinutes !== null ? maxMinutes - minMinutes : null,
    };
  });

  ranked.sort((a, b) => {
    if (a.maxMinutes === null) return 1;
    if (b.maxMinutes === null) return -1;
    return a.maxMinutes - b.maxMinutes;
  });

  return { ranked: ranked.slice(0, 6), centroid: center, candidateCount: candidates.length };
}
