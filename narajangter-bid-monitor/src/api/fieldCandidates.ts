/**
 * data.go.kr 나라장터 API의 실제 응답 필드명은 서비스 버전에 따라 조금씩 달라질 수 있어
 * (예: BidPublicInfoService -> BidPublicInfoService04 개정 이력) 필드명 후보를 리스트로 관리하고
 * 첫 번째로 값이 채워져 있는 후보를 사용한다. 실제 운영 중 필드가 비어 보이면
 * `npm run verify:api` 로 원본 응답을 확인한 뒤 이 파일의 후보 목록에 실제 필드명을 추가하면 된다.
 */
export interface FieldCandidates {
  noticeNo: string[];
  title: string[];
  institution: string[];
  postedAt: string[];
  deadline: string[];
  budgetAmount: string[];
  detailUrl: string[];
  /** 투찰가능업종명 등 업종코드 매칭에 사용할 텍스트 필드 (용역/공사) */
  industryText: string[];
  /** 세부품명번호 (물품) */
  productClsfcNo: string[];
  productClsfcName: string[];
}

export const BID_NOTICE_FIELD_CANDIDATES: FieldCandidates = {
  noticeNo: ["bidNtceNo"],
  title: ["bidNtceNm"],
  institution: ["ntceInsttNm", "dmndInsttNm"],
  postedAt: ["bidNtceDate", "bidNtceBgnDt", "bidNtceBgn", "rgstDt"],
  deadline: ["bidClseDate", "bidClseDt", "opengDate", "opengDt"],
  budgetAmount: ["asignBdgtAmt", "presmptPrce", "bssamt", "bssAmt"],
  detailUrl: ["bidNtceDtlUrl", "bidNtceUrl"],
  industryText: ["bidprcPsblIndstrytyNm", "indstrytyLmtYn"],
  productClsfcNo: ["prdctClsfcNo"],
  productClsfcName: ["prdctClsfcNoNm"],
};

/** getBidPblancListInfoLicenseLimit (면허제한정보조회) 응답 필드 후보 */
export interface LicenseLimitFieldCandidates {
  noticeNo: string[];
  groupNo: string[];
  seqNo: string[];
  licenseLimitName: string[];
  allowedIndustryList: string[];
}

export const LICENSE_LIMIT_FIELD_CANDIDATES: LicenseLimitFieldCandidates = {
  noticeNo: ["bidNtceNo"],
  // lmtGrpNo가 npm run verify:api 실제 응답으로 확인된 필드명 (2026-07-28)
  groupNo: ["lmtGrpNo", "rstrctGroupNo", "prtcptLmtGroupNo", "lmtGroupNo", "rstrctGrupNo"],
  seqNo: ["rstrctSeqNo", "lmtSeqNo"],
  licenseLimitName: ["lcnsLmtNm", "licenseLmtNm", "lmtLicenseNm", "prtcptLcnsLmtNm"],
  // permsnIndstrytyList가 npm run verify:api 실제 응답으로 확인된 필드명 (2026-07-28)
  allowedIndustryList: ["permsnIndstrytyList", "alwIndstrytyNm", "admisIndstrytyNm", "prmisnIndstrytyNm", "aloneIndstrytyNm"],
};

export const PRE_STANDARD_FIELD_CANDIDATES: FieldCandidates = {
  noticeNo: ["bfSpecRgstNo", "sptDscrptRegNo"],
  title: ["prdctClsfcNoNm", "bfSpecTaskNm", "bfSpecRgstNm", "reNm", "prdctNm"],
  institution: ["orderInsttNm", "ntceInsttNm", "dmndInsttNm"],
  postedAt: ["bfSpecRgstDate", "bfSpecRgstDt", "rgstDt"],
  deadline: ["opninRgstClseDt", "opninRgstClseDate", "bfSpecClseDt"],
  budgetAmount: ["asignBdgtAmt", "presmptPrce"],
  detailUrl: ["bfSpecDocFileUrl1", "specDocFileUrl1", "bfSpecRgstUrl"],
  industryText: ["bidprcPsblIndstrytyNm"],
  productClsfcNo: ["prdctClsfcNo"],
  productClsfcName: ["prdctClsfcNoNm"],
};
