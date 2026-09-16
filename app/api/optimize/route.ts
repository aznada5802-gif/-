import { NextRequest, NextResponse } from "next/server";
import { findFairMeetingPoints } from "@/lib/optimize";
import type { OptimizeRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: OptimizeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다" }, { status: 400 });
  }

  const origins = body.origins ?? [];
  if (!Array.isArray(origins) || origins.length < 2) {
    return NextResponse.json(
      { error: "최소 2명 이상의 출발지를 입력해주세요" },
      { status: 400 }
    );
  }

  for (const o of origins) {
    if (
      typeof o.lat !== "number" ||
      typeof o.lng !== "number" ||
      (o.mode !== "car" && o.mode !== "transit")
    ) {
      return NextResponse.json({ error: "출발지 데이터가 올바르지 않습니다" }, { status: 400 });
    }
  }

  try {
    const { ranked, centroid, candidateCount } = await findFairMeetingPoints(origins);
    return NextResponse.json({ ranked, centroid, candidateCount });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
