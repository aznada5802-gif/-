import type { LatLng } from "./geo";

const REST_KEY = process.env.KAKAO_REST_API_KEY;

function authHeaders() {
  if (!REST_KEY) {
    throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다 (.env.local 확인)");
  }
  return { Authorization: `KakaoAK ${REST_KEY}` };
}

export interface KakaoPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMeters: number | null;
}

/**
 * 좌표 주변의 특정 카테고리 장소를 거리순으로 검색.
 * category_group_code 예: SW8=지하철역, CE7=카페
 */
export async function searchCategoryNearby(
  center: LatLng,
  categoryGroupCode: string,
  radiusMeters: number,
  size = 15
): Promise<KakaoPlace[]> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", categoryGroupCode);
  url.searchParams.set("x", String(center.lng));
  url.searchParams.set("y", String(center.lat));
  url.searchParams.set("radius", String(Math.min(Math.max(Math.round(radiusMeters), 1), 20000)));
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", String(Math.min(size, 15)));

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`카카오 카테고리 검색 실패: ${res.status}`);
  }
  const data = await res.json();
  const documents: Array<{
    id: string;
    place_name: string;
    address_name: string;
    road_address_name?: string;
    x: string;
    y: string;
    distance?: string;
  }> = data.documents ?? [];

  return documents.map((d) => ({
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    lat: parseFloat(d.y),
    lng: parseFloat(d.x),
    distanceMeters: d.distance ? parseFloat(d.distance) : null,
  }));
}

/**
 * 좌표 주변에서 키워드로 장소 검색 (지하철역이 없는 지역에서 기차역/버스터미널 등을
 * 찾을 때 사용 - 이런 곳들은 고정된 category_group_code가 없음).
 */
export async function searchKeywordNearby(
  center: LatLng,
  keyword: string,
  radiusMeters: number,
  size = 5
): Promise<KakaoPlace[]> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", keyword);
  url.searchParams.set("x", String(center.lng));
  url.searchParams.set("y", String(center.lat));
  url.searchParams.set("radius", String(Math.min(Math.max(Math.round(radiusMeters), 1), 20000)));
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", String(Math.min(size, 15)));

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`카카오 키워드 검색 실패: ${res.status}`);
  }
  const data = await res.json();
  const documents: Array<{
    id: string;
    place_name: string;
    address_name: string;
    road_address_name?: string;
    x: string;
    y: string;
    distance?: string;
  }> = data.documents ?? [];

  return documents.map((d) => ({
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    lat: parseFloat(d.y),
    lng: parseFloat(d.x),
    distanceMeters: d.distance ? parseFloat(d.distance) : null,
  }));
}

export interface DrivingResult {
  durationSeconds: number;
  distanceMeters: number;
}

/**
 * 카카오모빌리티 자동차 길찾기. REST 키에 모빌리티 권한이 없으면 에러를 던진다
 * (호출부에서 직선거리 기반 추정치로 폴백 처리).
 */
export async function getDrivingDuration(
  origin: LatLng,
  destination: LatLng
): Promise<DrivingResult> {
  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", `${origin.lng},${origin.lat}`);
  url.searchParams.set("destination", `${destination.lng},${destination.lat}`);
  url.searchParams.set("priority", "RECOMMEND");

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`카카오모빌리티 길찾기 실패: ${res.status}`);
  }
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route || route.result_code !== 0) {
    throw new Error("카카오모빌리티 경로를 찾을 수 없습니다");
  }
  return {
    durationSeconds: route.summary.duration,
    distanceMeters: route.summary.distance,
  };
}
