import type { LatLng } from "./geo";

const ODSAY_KEY = process.env.ODSAY_API_KEY;

export interface TransitResult {
  totalTimeMinutes: number;
  modeSummary: string | null;
}

const TRAIN_TYPE_LABEL: Record<number, string> = {
  1: "KTX",
  2: "새마을호",
  3: "무궁화호",
  4: "누리로",
  6: "ITX-새마을",
  7: "KTX-산천",
  8: "ITX-청춘",
};

interface OdsayLane {
  name?: string; // 지하철: 호선명 (예: "2호선")
  busNo?: string; // 버스: 노선번호 (예: "140")
}

interface OdsaySubPath {
  trafficType: number;
  trainType?: number;
  lane?: OdsayLane[];
}

function legLabel(sub: OdsaySubPath): string | null {
  switch (sub.trafficType) {
    case 1: {
      const line = sub.lane?.[0]?.name;
      return line ? `지하철 ${line}` : "지하철";
    }
    case 2: {
      const busNo = sub.lane?.[0]?.busNo;
      return busNo ? `버스 ${busNo}번` : "버스";
    }
    case 4:
      return sub.trainType ? (TRAIN_TYPE_LABEL[sub.trainType] ?? "기차") : "기차";
    case 5:
      return "항공기";
    default:
      return null; // 도보 등 이동수단이 아닌 구간은 요약에서 제외
  }
}

function summarize(subPath: OdsaySubPath[]): string | null {
  const labels: string[] = [];
  for (const sub of subPath) {
    const label = legLabel(sub);
    if (label && labels[labels.length - 1] !== label) {
      labels.push(label);
    }
  }
  return labels.length ? labels.join(" → ") : null;
}

/**
 * ODsay 대중교통 길찾기 (지하철+버스+기차 조합). 반환된 경로 중 최단 소요시간을 사용한다.
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

  const paths: Array<{ info: { totalTime: number }; subPath?: OdsaySubPath[] }> =
    data.result?.path ?? [];
  if (paths.length === 0) {
    throw new Error("ODsay 대중교통 경로를 찾을 수 없습니다");
  }

  const fastest = paths.reduce((best, p) => (p.info.totalTime < best.info.totalTime ? p : best));
  return {
    totalTimeMinutes: fastest.info.totalTime,
    modeSummary: summarize(fastest.subPath ?? []),
  };
}
