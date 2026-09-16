"use client";

import { useEffect, useRef } from "react";
import { useKakaoLoader } from "@/lib/useKakaoLoader";
import type { KakaoNamespace } from "@/lib/kakao-global";
import type { Friend } from "@/lib/types";
import type { CandidateResult } from "@/lib/types";

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
        image: new kakao.maps.MarkerImage(
          f.mode === "car"
            ? "https://t1.daumcdn.net/mapjsapi/images/marker.png"
            : "https://t1.daumcdn.net/mapjsapi/images/marker.png",
          new kakao.maps.Size(24, 35)
        ),
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
      const marker = new kakao.maps.Marker({
        position: pos,
        map,
        image: new kakao.maps.MarkerImage(
          isBest
            ? "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png"
            : "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/blue_b.png",
          new kakao.maps.Size(isSelected ? 32 : 26, isSelected ? 39 : 32)
        ),
        zIndex: isBest ? 10 : 5,
      });
      kakao.maps.event.addListener(marker, "click", () => onSelectCandidate(r.candidate.id));

      const label = new kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="padding:2px 6px;background:${
          isBest ? "#dc2626" : "#2563eb"
        };color:#fff;font-size:11px;border-radius:4px;transform:translateY(-40px);white-space:nowrap;">${
          r.candidate.name
        }${r.maxMinutes ? ` · ${Math.round(r.maxMinutes)}분` : ""}</div>`,
        map,
      });

      markersRef.current.push(marker, label);
      bounds.extend(pos);
      hasPoint = true;
    });

    if (hasPoint) {
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
