import type { LatLng } from "./geo";

const ODSAY_KEY = process.env.ODSAY_API_KEY;

export interface TransitResult {
  totalTimeMinutes: number;
}

/**
 * ODsay 대중교통 길찾기 (지하철+버스 조합). 반환된 경로 중 최단 소요시간을 사용한다.
 * https://lab.odsay.com
 */
export async function getTransitDuration(
  origin: LatLng,
  destination: LatLng
): Promise<TransitResult> {
  if (!ODSAY_KEY) {
    throw new Error("ODSAY_API_KEY가 설정되지 않았습니다 (.env.local 확인)");
  }

  const url = new URL("https://api.odsay.com/v1/api/searchPubTransPathT");
  url.searchParams.set("SX", String(origin.lng));
  url.searchParams.set("SY", String(origin.lat));
  url.searchParams.set("EX", String(destination.lng));
  url.searchParams.set("EY", String(destination.lat));
  url.searchParams.set("apiKey", ODSAY_KEY);
  url.searchParams.set("output", "json");

  const res = await fetch(url, {
    headers: { Referer: process.env.ODSAY_REGISTERED_URI ?? "http://localhost:3000" },
  });
  if (!res.ok) {
    throw new Error(`ODsay 요청 실패: ${res.status}`);
  }
  const data = await res.json();

  if (data.error) {
    const message = Array.isArray(data.error)
      ? data.error[0]?.message
      : "알 수 없는 오류";
    throw new Error(`ODsay 경로 없음: ${message}`);
  }

  const paths: Array<{ info: { totalTime: number } }> = data.result?.path ?? [];
  if (paths.length === 0) {
    throw new Error("ODsay 대중교통 경로를 찾을 수 없습니다");
  }

  const totalTimeMinutes = Math.min(...paths.map((p) => p.info.totalTime));
  return { totalTimeMinutes };
}
