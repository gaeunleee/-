import type { BusinessType } from "./types.js";

export const DEFAULT_BID_NOTICE_BASE_URL = "http://apis.data.go.kr/1230000/ad/BidPublicInfoService";
export const DEFAULT_PRE_STANDARD_BASE_URL = "http://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService";

/** 업무구분별 오퍼레이션명. 물품(Thng)/용역(Servc)/공사(Cnstwk) 3종만 다룬다 (전시업체 특성상 외자/기타는 범위 밖). */
export const BID_NOTICE_OPERATIONS: Record<BusinessType, string> = {
  물품: "getBidPblancListInfoThng",
  용역: "getBidPblancListInfoServc",
  공사: "getBidPblancListInfoCnstwk",
};

export const PRE_STANDARD_OPERATIONS: Record<BusinessType, string> = {
  물품: "getPublicPrcureThngInfoThng",
  용역: "getPublicPrcureThngInfoServc",
  공사: "getPublicPrcureThngInfoCnstwk",
};
