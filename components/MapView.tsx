"use client";

import { useEffect, useRef } from "react";
import { useKakaoLoader } from "@/lib/useKakaoLoader";
import type { KakaoNamespace } from "@/lib/kakao-global";
import type { Friend } from "@/lib/types";
import type { CandidateResult } from "@/lib/types";

// Kakao 예제 CDN의 기본 마커 이미지는 저해상도라 확대 시 흐릿해서, 벡터(SVG) 핀을
// 직접 그려서 쓴다. 크기에 상관없이 항상 선명하다.
function pinDataUri(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="14" r="6" fill="#ffffff"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function MapView({
  friends,
  ranked,
  bestId,
  selectedId,
  onSelectCandidate,
}: {
  friends: Friend[];
  ranked: CandidateResult[];
  bestId: string | null;
  selectedId: string | null;
  onSelectCandidate: (id: string) => void;
}) {
  const { loaded, error } = useKakaoLoader();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoNamespace>(null);
  const markersRef = useRef<KakaoNamespace[]>([]);
  // friends/ranked가 실제로 바뀐 경우에만 지도 범위를 다시 맞춘다 - 마커 선택(클릭)만으로는
  // friends/ranked 참조가 그대로라 사용자가 확대/이동한 화면이 유지된다.
  const lastFitDataRef = useRef<{ friends: Friend[] | null; ranked: CandidateResult[] | null }>({
    friends: null,
    ranked: null,
  });

  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return;
    mapRef.current = new window.kakao.maps.Map(containerRef.current, {
      center: new window.kakao.maps.LatLng(37.5665, 126.978),
      level: 8,
    });
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();
    let hasPoint = false;

    friends.forEach((f) => {
      const pos = new kakao.maps.LatLng(f.lat, f.lng);
      const marker = new kakao.maps.Marker({
        position: pos,
        map,
        image: new kakao.maps.MarkerImage(pinDataUri("#27272a"), new kakao.maps.Size(26, 35), {
          offset: new kakao.maps.Point(13, 35),
        }),
      });
      const label = new kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="padding:2px 6px;background:#27272a;color:#fff;font-size:11px;border-radius:4px;transform:translateY(-42px);white-space:nowrap;">${f.label} (${
          f.mode === "car" ? "자차" : "대중교통"
        })</div>`,
        map,
      });
      markersRef.current.push(marker, label);
      bounds.extend(pos);
      hasPoint = true;
    });

    ranked.forEach((r) => {
      const pos = new kakao.maps.LatLng(r.candidate.lat, r.candidate.lng);
      const isBest = r.candidate.id === bestId;
      const isSelected = r.candidate.id === selectedId;
      const size = isSelected ? 34 : 18;
      const height = isSelected ? 46 : 24;
      const marker = new kakao.maps.Marker({
        position: pos,
        map,
        image: new kakao.maps.MarkerImage(
          pinDataUri(isBest ? "#dc2626" : "#2563eb"),
          new kakao.maps.Size(size, height),
          { offset: new kakao.maps.Point(size / 2, height) }
        ),
        zIndex: isBest ? 10 : 5,
      });
      kakao.maps.event.addListener(marker, "click", () => onSelectCandidate(r.candidate.id));

      const label = new kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="padding:2px 6px;background:${
          isBest ? "#dc2626" : "#2563eb"
        };color:#fff;font-size:11px;border-radius:4px;transform:translateY(-${height + 6}px);white-space:nowrap;">${
          r.candidate.name
        }${r.maxMinutes ? ` · ${Math.round(r.maxMinutes)}분` : ""}</div>`,
        map,
      });

      markersRef.current.push(marker, label);
      bounds.extend(pos);
      hasPoint = true;
    });

    const isNewData =
      lastFitDataRef.current.friends !== friends || lastFitDataRef.current.ranked !== ranked;
    lastFitDataRef.current = { friends, ranked };

    if (hasPoint && isNewData) {
      map.setBounds(bounds);
    }
  }, [loaded, friends, ranked, bestId, selectedId, onSelectCandidate]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full rounded-lg" />;
}
