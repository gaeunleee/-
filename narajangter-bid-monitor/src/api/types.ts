export type BusinessType = "물품" | "용역" | "공사";
export type SourceType = "본공고" | "사전규격";

export interface NormalizedNotice {
  /** 공고번호(본공고) 또는 사전규격등록번호(사전규격). 없으면 제목+기관 조합으로 대체 생성됨 */
  noticeNo: string;
  title: string;
  institution: string | null;
  businessType: BusinessType;
  sourceType: SourceType;
  postedAt: string | null;
  deadline: string | null;
  budgetAmount: number | null;
  detailUrl: string | null;
  /** 업종코드 매칭에 사용되는 원문 텍스트 (투찰가능업종명 등) */
  industryText: string | null;
  productClsfcNo: string | null;
  productClsfcName: string | null;
  /** 필드 매핑 실패 시 디버깅용으로 원본 보존 */
  raw: Record<string, unknown>;
}

export interface FetchWindow {
  /** 조회 시작 (YYYYMMDDHHMM) */
  begin: Date;
  /** 조회 종료 (YYYYMMDDHHMM) */
  end: Date;
}

export interface FetchResult {
  businessType: BusinessType;
  notices: NormalizedNotice[];
  /** 이 업무구분 조회가 실패했는지 여부 (부분 실패를 리포트에 표기하기 위함) */
  failed: boolean;
  errorMessage?: string;
}
