// 카카오맵 JS SDK는 공식 타입 정의를 제공하지 않는다. 이 프로젝트에서 쓰는 범위만
// any로 감싸 한 곳에서만 lint 예외를 허용하고, 나머지 코드에서는 이 별칭을 재사용한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KakaoNamespace = any;
