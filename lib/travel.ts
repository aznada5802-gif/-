import { getDrivingDuration } from "./kakao";
import { getTransitDuration } from "./odsay";
import { haversineMeters, type LatLng } from "./geo";
import type { FriendOrigin, TravelResult } from "./types";

// 실제 API 호출이 실패했을 때(키 미설정, 경로 없음, 할당량 초과 등) 직선거리 기반으로
// 대략치를 낸다. 실제 대중교통은 직선이 아니라 노선을 따라가고 환승 대기가 있어서
// 체감 속도가 훨씬 느리다 - 실측 비교(정헌빌딩→한남역, 실제 31~40분) 기준으로 보정.
const FALLBACK_CAR_KMH = 28;
const FALLBACK_TRANSIT_KMH = 18;
const FALLBACK_TRANSIT_OVERHEAD_MIN = 15; // 도보+대기+환승 여유시간

function estimateMinutes(origin: LatLng, destination: LatLng, mode: "car" | "transit") {
  const km = haversineMeters(origin, destination) / 1000;
  if (mode === "car") {
    return (km / FALLBACK_CAR_KMH) * 60;
  }
  return (km / FALLBACK_TRANSIT_KMH) * 60 + FALLBACK_TRANSIT_OVERHEAD_MIN;
}

export async function resolveTravelTime(
  origin: FriendOrigin,
  destination: LatLng
): Promise<TravelResult> {
  const originPoint: LatLng = { lat: origin.lat, lng: origin.lng };

  try {
    if (origin.mode === "car") {
      const { durationSeconds } = await getDrivingDuration(originPoint, destination);
      return {
        friendId: origin.id,
        label: origin.label,
        mode: origin.mode,
        minutes: durationSeconds / 60,
        estimated: false,
        modeDetail: null,
      };
    }
    const { totalTimeMinutes, modeSummary } = await getTransitDuration(originPoint, destination);
    return {
      friendId: origin.id,
      label: origin.label,
      mode: origin.mode,
      minutes: totalTimeMinutes,
      estimated: false,
      modeDetail: modeSummary,
    };
  } catch {
    return {
      friendId: origin.id,
      label: origin.label,
      mode: origin.mode,
      minutes: estimateMinutes(originPoint, destination, origin.mode),
      estimated: true,
      modeDetail: null,
    };
  }
}
