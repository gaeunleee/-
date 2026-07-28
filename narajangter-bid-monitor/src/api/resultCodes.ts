/**
 * 공공데이터포털(data.go.kr) OpenAPI 공통 오류코드.
 * https://www.data.go.kr 활용신청 가이드에 명시된 표준 오류코드 체계를 따른다.
 */
export const RESULT_CODE_MESSAGES: Record<string, string> = {
  "00": "정상",
  "01": "어플리케이션 에러",
  "02": "데이터베이스 에러",
  "03": "데이터 없음 (정상, 결과 0건)",
  "04": "HTTP 에러",
  "05": "서비스 연결실패 에러 (타임아웃)",
  "08": "필수값 입력 에러 (필수 요청 파라미터 누락)",
  "10": "잘못된 요청 파라미터 에러",
  "11": "필수요청 파라미터가 없음",
  "12": "해당 오픈API서비스가 없거나 폐기됨",
  "20": "서비스 접근거부",
  "21": "일시적으로 사용할 수 없는 서비스키",
  "22": "서비스 요청제한횟수 초과 (TPS 초과)",
  "30": "등록되지 않은 서비스키 (Encoding/Decoding 키 확인 필요)",
  "31": "기한만료된 서비스키",
  "32": "등록되지 않은 IP",
  "33": "서명되지 않은 호출",
  "99": "기타 에러",
};

/** 재시도로 회복 가능성이 있는 코드 (일시적 오류) */
export const RETRYABLE_RESULT_CODES = new Set(["04", "05", "22"]);

/** 정상으로 취급해야 하는 코드 (결과 0건도 정상) */
export const SUCCESS_RESULT_CODES = new Set(["00", "03"]);

export function describeResultCode(code: string): string {
  return RESULT_CODE_MESSAGES[code] ?? `알 수 없는 결과코드(${code})`;
}
