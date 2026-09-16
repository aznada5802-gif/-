import { centroid, maxDistanceFromPoint, type LatLng } from "./geo";
import { searchCategoryNearby, searchKeywordNearby, type KakaoPlace } from "./kakao";
import { resolveTravelTime } from "./travel";
import { mapWithConcurrency } from "./concurrency";
import type { Candidate, CandidateResult, FriendOrigin } from "./types";

const SUBWAY_CATEGORY = "SW8";
const MIN_RADIUS_M = 1500;
const MAX_RADIUS_M = 20000; // 카카오 로컬 API의 반경 검색 상한
const MAX_STATION_CANDIDATES = 8;
const MIN_CANDIDATES_BEFORE_FALLBACK = 3;
const CONCURRENCY = 5;

// 친구들이 아주 멀리 떨어져 있으면(예: 부산-서울) 산술 중심점이 지하철이 없는
// 산간/농촌 지역에 떨어질 수 있다. 이럴 땐 기차역/버스터미널처럼 장거리 이동
// 거점을 대신 후보로 찾는다.
const LONG_DISTANCE_FALLBACK_KEYWORDS = ["기차역", "고속터미널", "시외버스터미널"];

function toCandidate(prefix: string, place: KakaoPlace): Candidate {
  return {
    id: `${prefix}-${place.id}`,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
  };
}

async function buildCandidates(center: LatLng, radiusMeters: number): Promise<Candidate[]> {
  const candidates: Candidate[] = [
    {
      id: "centroid",
      name: "중심점",
      address: "친구들 출발지의 산술 평균 좌표",
      lat: center.lat,
      lng: center.lng,
    },
  ];
  const seenPlaceIds = new Set<string>();

  try {
    const stations = await searchCategoryNearby(center, SUBWAY_CATEGORY, radiusMeters, 15);
    for (const s of stations.slice(0, MAX_STATION_CANDIDATES)) {
      seenPlaceIds.add(s.id);
      candidates.push(toCandidate("station", s));
    }
  } catch {
    // 카카오 로컬 API 키가 없거나 실패한 경우 중심점만으로 진행
  }

  if (candidates.length - 1 < MIN_CANDIDATES_BEFORE_FALLBACK) {
    for (const keyword of LONG_DISTANCE_FALLBACK_KEYWORDS) {
      try {
        const places = await searchKeywordNearby(center, keyword, radiusMeters, 3);
        for (const p of places) {
          if (seenPlaceIds.has(p.id)) continue;
          seenPlaceIds.add(p.id);
          candidates.push(toCandidate("hub", p));
        }
      } catch {
        // 이 키워드는 건너뛰고 다음 키워드로 계속
      }
    }
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
