"use client";

import { useEffect, useState } from "react";
import type { KakaoNamespace } from "./kakao-global";

declare global {
  interface Window {
    kakao: KakaoNamespace;
  }
}

const MISSING_KEY_ERROR =
  "NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다 (.env.local 확인)";

let loaderPromise: Promise<void> | null = null;

function loadKakaoSdk(appKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.kakao?.maps) return Promise.resolve();

  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
      script.async = true;
      script.onload = () => {
        window.kakao.maps.load(() => resolve());
      };
      script.onerror = () => reject(new Error("카카오맵 SDK 로드 실패"));
      document.head.appendChild(script);
    });
  }
  return loaderPromise;
}

export function useKakaoLoader() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(
    appKey ? null : MISSING_KEY_ERROR
  );

  useEffect(() => {
    if (!appKey) return;
    loadKakaoSdk(appKey)
      .then(() => setLoaded(true))
      .catch((e: Error) => setError(e.message));
  }, [appKey]);

  return { loaded, error };
}
