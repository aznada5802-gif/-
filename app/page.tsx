"use client";

import { useMemo, useState } from "react";
import PlaceSearch, { type PlaceOption } from "@/components/PlaceSearch";
import MapView from "@/components/MapView";
import type { CandidateResult, Friend, TravelMode } from "@/lib/types";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `friend-${idCounter}`;
}

type SortMode = "max" | "spread";

export default function Home() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingPlace, setPendingPlace] = useState<PlaceOption | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");
  const [pendingMode, setPendingMode] = useState<TravelMode>("transit");
  const [searchResetKey, setSearchResetKey] = useState(0);

  const [ranked, setRanked] = useState<CandidateResult[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("max");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetPendingForm() {
    setEditingId(null);
    setPendingPlace(null);
    setPendingLabel("");
    setPendingMode("transit");
    setSearchResetKey((k) => k + 1);
  }

  function submitFriend() {
    if (!pendingPlace) return;
    const label = pendingLabel.trim() || pendingPlace.name;

    if (editingId) {
      setFriends((prev) =>
        prev.map((f) =>
          f.id === editingId
            ? {
                ...f,
                label,
                address: pendingPlace.address,
                lat: pendingPlace.lat,
                lng: pendingPlace.lng,
                mode: pendingMode,
              }
            : f
        )
      );
    } else {
      const friend: Friend = {
        id: nextId(),
        label,
        address: pendingPlace.address,
        lat: pendingPlace.lat,
        lng: pendingPlace.lng,
        mode: pendingMode,
      };
      setFriends((prev) => [...prev, friend]);
    }
    resetPendingForm();
  }

  function startEditFriend(friend: Friend) {
    setEditingId(friend.id);
    setPendingPlace({
      name: friend.label,
      address: friend.address,
      lat: friend.lat,
      lng: friend.lng,
    });
    setPendingLabel(friend.label);
    setPendingMode(friend.mode);
    setSearchResetKey((k) => k + 1);
  }

  function removeFriend(id: string) {
    setFriends((prev) => prev.filter((f) => f.id !== id));
    if (editingId === id) {
      resetPendingForm();
    }
  }

  function updateFriendMode(id: string, mode: TravelMode) {
    setFriends((prev) => prev.map((f) => (f.id === id ? { ...f, mode } : f)));
  }

  async function findMeetingPoint() {
    if (friends.length < 2) {
      setError("친구를 2명 이상 추가해주세요");
      return;
    }
    setLoading(true);
    setError(null);
    setRanked([]);
    setSelectedId(null);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origins: friends.map((f) => ({
            id: f.id,
            label: f.label,
            lat: f.lat,
            lng: f.lng,
            mode: f.mode,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "요청 실패");
      }
      setRanked(data.ranked);
      setSortMode("max");
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  const displayRanked = useMemo(() => {
    const key = sortMode === "max" ? "maxMinutes" : "spreadMinutes";
    return [...ranked].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (va === null) return 1;
      if (vb === null) return -1;
      return va - vb;
    });
  }, [ranked, sortMode]);

  const bestId = displayRanked[0]?.candidate.id ?? null;
  const effectiveSelectedId = selectedId ?? bestId;
  const selectedResult =
    displayRanked.find((r) => r.candidate.id === effectiveSelectedId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">
          <span className="text-red-600">공</span>평하게{" "}
          <span className="text-red-600">산</span>정했어{" "}
          <span className="text-red-600">당</span>장출발해
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          친구들의 출발지와 이동 수단(대중교통/자차)을 입력하면, 가장 늦게 도착하는
          사람의 이동시간을 최소화하는 공평한 만남 장소를 찾아드려요.
        </p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">
              {editingId ? "친구 정보 수정" : "친구 추가"}
            </h2>
            <div className="flex flex-col gap-2">
              <PlaceSearch key={searchResetKey} onSelect={setPendingPlace} />
              {pendingPlace && (
                <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                  선택됨: <span className="font-medium">{pendingPlace.name}</span>{" "}
                  ({pendingPlace.address})
                </div>
              )}
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="이름 (선택, 예: 민수)"
                value={pendingLabel}
                onChange={(e) => setPendingLabel(e.target.value)}
              />
              <div className="flex gap-2">
                <ModeToggle mode={pendingMode} onChange={setPendingMode} />
              </div>
              <div className="flex gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetPendingForm}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    취소
                  </button>
                )}
                <button
                  type="button"
                  onClick={submitFriend}
                  disabled={!pendingPlace}
                  className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                  {editingId ? "수정 완료" : "친구로 추가"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">
              친구 목록 ({friends.length})
            </h2>
            {friends.length === 0 ? (
              <p className="text-xs text-zinc-400">아직 추가된 친구가 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {friends.map((f) => (
                  <li
                    key={f.id}
                    className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                      editingId === f.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-zinc-100"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800">{f.label}</p>
                      <p className="truncate text-xs text-zinc-500">{f.address}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ModeToggle
                        mode={f.mode}
                        onChange={(m) => updateFriendMode(f.id, m)}
                        compact
                      />
                      <button
                        type="button"
                        onClick={() => startEditFriend(f)}
                        className="text-xs text-zinc-400 hover:text-blue-500"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFriend(f.id)}
                        className="text-xs text-zinc-400 hover:text-red-500"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={findMeetingPoint}
              disabled={friends.length < 2 || loading}
              className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {loading ? "계산 중..." : "가장 공평한 장소 찾기"}
            </button>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </section>

          {displayRanked.length > 0 && (
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-700">추천 장소 순위</h2>
                <div className="grid grid-cols-2 overflow-hidden rounded-md border border-zinc-300 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSortMode("max");
                      setSelectedId(null);
                    }}
                    className={`whitespace-nowrap px-2 py-1 font-medium ${
                      sortMode === "max" ? "bg-zinc-800 text-white" : "bg-white text-zinc-600"
                    }`}
                  >
                    최대시간 최소화
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortMode("spread");
                      setSelectedId(null);
                    }}
                    className={`whitespace-nowrap px-2 py-1 font-medium ${
                      sortMode === "spread" ? "bg-zinc-800 text-white" : "bg-white text-zinc-600"
                    }`}
                  >
                    편차 최소화
                  </button>
                </div>
              </div>
              <p className="mb-2 text-xs text-zinc-400">
                {sortMode === "max"
                  ? "가장 늦게 도착하는 사람의 시간이 가장 짧은 순서예요."
                  : "친구들 간 도착 시간 차이가 가장 적은 순서예요."}
              </p>
              <ul className="flex flex-col gap-2">
                {displayRanked.map((r, i) => (
                  <li key={r.candidate.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.candidate.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                        r.candidate.id === effectiveSelectedId
                          ? "border-blue-400 bg-blue-50"
                          : "border-zinc-100 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-800">
                          {i === 0 ? "🏆 " : `${i + 1}. `}
                          {r.candidate.name}
                        </span>
                        <span className="text-xs font-semibold text-zinc-600">
                          최대 {r.maxMinutes !== null ? Math.round(r.maxMinutes) : "-"}분 · 편차{" "}
                          {r.spreadMinutes !== null ? Math.round(r.spreadMinutes) : "-"}분
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{r.candidate.address}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex min-h-[400px] flex-col gap-4 lg:min-h-0">
          <div className="h-[400px] max-h-[480px] min-h-0 overflow-hidden rounded-lg border border-zinc-200 lg:h-[480px]">
            <MapView
              friends={friends}
              ranked={displayRanked}
              bestId={bestId}
              selectedId={effectiveSelectedId}
              onSelectCandidate={setSelectedId}
            />
          </div>

          {selectedResult && (
            <section className="flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                {selectedResult.candidate.name} · 친구별 이동시간
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                    <th className="py-1.5 font-medium">이름</th>
                    <th className="py-1.5 font-medium">수단</th>
                    <th className="py-1.5 font-medium text-right">소요시간</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResult.results.map((r) => (
                    <tr key={r.friendId} className="border-b border-zinc-50">
                      <td className="py-1.5 text-zinc-700">{r.label}</td>
                      <td className="py-1.5 text-zinc-500">
                        {r.mode === "car" ? "🚗 자차" : "🚌 대중교통"}
                        {r.modeDetail && (
                          <span className="ml-1 text-xs text-zinc-400">({r.modeDetail})</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right font-medium text-zinc-800">
                        {r.minutes !== null ? `${Math.round(r.minutes)}분` : "-"}
                        {r.estimated && (
                          <span className="ml-1 text-[10px] font-normal text-amber-500">
                            (추정)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                <span>
                  최대 {selectedResult.maxMinutes !== null ? Math.round(selectedResult.maxMinutes) : "-"}분
                </span>
                <span>
                  평균 {selectedResult.avgMinutes !== null ? Math.round(selectedResult.avgMinutes) : "-"}분
                </span>
                <span>
                  편차 {selectedResult.spreadMinutes !== null ? Math.round(selectedResult.spreadMinutes) : "-"}분
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
  compact,
}: {
  mode: TravelMode;
  onChange: (m: TravelMode) => void;
  compact?: boolean;
}) {
  const base = compact
    ? "whitespace-nowrap px-2 py-1 text-[11px]"
    : "whitespace-nowrap px-3 py-1.5 text-xs";
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-zinc-300">
      <button
        type="button"
        onClick={() => onChange("transit")}
        className={`${base} font-medium ${
          mode === "transit" ? "bg-zinc-800 text-white" : "bg-white text-zinc-600"
        }`}
      >
        🚌 대중교통
      </button>
      <button
        type="button"
        onClick={() => onChange("car")}
        className={`${base} font-medium ${
          mode === "car" ? "bg-zinc-800 text-white" : "bg-white text-zinc-600"
        }`}
      >
        🚗 자차
      </button>
    </div>
  );
}
