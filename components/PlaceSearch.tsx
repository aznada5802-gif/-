"use client";

import { useEffect, useRef, useState } from "react";
import type { KakaoNamespace } from "@/lib/kakao-global";

export interface PlaceOption {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function searchByKeyword(kakao: KakaoNamespace, keyword: string): Promise<PlaceOption[]> {
  return new Promise((resolve) => {
    const places = new kakao.maps.services.Places();
    places.keywordSearch(keyword, (data: KakaoNamespace[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) {
        resolve([]);
        return;
      }
      resolve(
        data.slice(0, 6).map((d) => ({
          name: d.place_name,
          address: d.road_address_name || d.address_name,
          lat: parseFloat(d.y),
          lng: parseFloat(d.x),
        }))
      );
    });
  });
}

// 도로명/지번 주소는 장소 키워드 검색으로 안 잡히는 경우가 많아 주소 전용 검색으로 보완한다.
function searchByAddress(kakao: KakaoNamespace, address: string): Promise<PlaceOption[]> {
  return new Promise((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (data: KakaoNamespace[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) {
        resolve([]);
        return;
      }
      resolve(
        data.slice(0, 6).map((d) => ({
          name: d.road_address?.address_name || d.address_name,
          address: d.address_name,
          lat: parseFloat(d.y),
          lng: parseFloat(d.x),
        }))
      );
    });
  });
}

export default function PlaceSearch({
  onSelect,
  disabled,
}: {
  onSelect: (place: PlaceOption) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestId = useRef(0);
  const skipNextSearch = useRef(false);

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (tooShort || typeof window === "undefined" || !window.kakao?.maps) return;

    const requestId = ++latestRequestId.current;

    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      const kakao = window.kakao;
      let results = await searchByKeyword(kakao, trimmed);
      if (results.length === 0) {
        results = await searchByAddress(kakao, trimmed);
      }
      if (requestId !== latestRequestId.current) return; // 더 최신 입력이 있으면 이 결과는 버림
      setSearching(false);
      setOptions(results);
      setHighlightedIndex(results.length > 0 ? 0 : -1);
      if (results.length === 0) {
        setError("검색 결과가 없습니다");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, tooShort]);

  function selectOption(opt: PlaceOption) {
    onSelect(opt);
    setOptions([]);
    setHighlightedIndex(-1);
    skipNextSearch.current = true;
    setQuery(opt.name);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (tooShort || options.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        e.preventDefault();
        selectOption(options[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setOptions([]);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          placeholder="주소, 지하철역, 건물명을 입력하세요"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {!tooShort && searching && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
            검색중…
          </span>
        )}
      </div>
      {!tooShort && error && <p className="text-xs text-red-500">{error}</p>}
      {!tooShort && options.length > 0 && (
        <ul className="mt-1 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white shadow-sm">
          {options.map((opt, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === highlightedIndex ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                <span className="font-medium">{opt.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{opt.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
