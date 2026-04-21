import { ParsedSMS, Owner } from '@/types'
import { format, isWeekend, parseISO } from 'date-fns'

// ============================================================
// 카드 식별
// ============================================================
// 로카 365   → 가은 카드 (개인 + 생활비 혼용)
// 로카 LIKIT → 인천 카드 (개인 전용)
// 결제문자 수신: 가은 폰에서 두 카드 모두 수신

function detectCard(text: string, senderCard?: string): '365' | 'LIKIT' | null {
  const src = (senderCard ?? '') + text
  if (src.includes('365')) return '365'
  if (src.toUpperCase().includes('LIKIT') || src.includes('라이킷') || src.includes('라이키')) return 'LIKIT'
  return null
}

// ============================================================
// 분류 규칙 (우선순위 순)
// ============================================================

// 1순위: 가맹점 무조건 → 공동 생활비
const ALWAYS_SHARED_LIVING: string[] = [
  '지엠마트', 'GM마트', '정육점', '정육', '다이소',
]

// 2순위: 가맹점 무조건 → 개인 생활비
const ALWAYS_PERSONAL_LIVING: string[] = [
  '미용실', '헤어', '네일', '왁싱', '이발',
]

// 3순위: 외식 카테고리 가맹점
const DINING_KEYWORDS: string[] = [
  // 카페
  '스타벅스', '이디야', '메가커피', '컴포즈', '투썸', '빽다방', '할리스',
  '커피빈', '폴바셋', '엔제리너스', '카페', '커피',
  // 배달
  '배달의민족', '배민', '쿠팡이츠', '요기요',
  // 편의점
  'GS25', 'CU', '세븐일레븐', '미니스톱', '이마트24', 'gs편의점', 'gs25',
  // 식당 키워드
  '식당', '밥', '돈까스', '갈비', '삼겹살', '치킨', '피자', '짜장',
  '짬뽕', '초밥', '스시', '우동', '라멘', '파스타', '버거', '맥도날드',
  '롯데리아', '버거킹', '맘스터치', 'KFC', '서브웨이', '샌드위치',
  '아울렛 점심', '점심', '저녁', '외식',
]

// 카테고리 매핑 (가맹점 키워드 → {name, sub_name})
const MERCHANT_CATEGORY_MAP: Array<{ keywords: string[]; name: string; sub: string }> = [
  // 생활비
  { keywords: ['이마트', '홈플러스', '롯데마트', '코스트코', '마트', '슈퍼'], name: '생활비', sub: '마트' },
  { keywords: ['올리브영', '다이소', '다이소'], name: '생활비', sub: '생활용품' },
  { keywords: ['미용실', '헤어', '네일', '왁싱', '이발'], name: '생활비', sub: '미용' },
  // 고정비
  { keywords: ['넷플릭스', '유튜브프리미엄', '유튜브', '애플', '쿠팡로켓', '멜론', '스포티파이', '왓챠'], name: '고정비', sub: '구독' },
  // 교통
  { keywords: ['KTX', 'SRT', '코레일', '지하철', '버스', '카카오택시', '우버', '타다', '티머니', '후불교통'], name: '교통비', sub: '대중교통' },
  { keywords: ['주유소', '주유', 'GS칼텍스', 'SK에너지', '현대오일뱅크'], name: '교통비', sub: '주유' },
  // 의료
  { keywords: ['병원', '의원', '치과', '한의원', '클리닉', '약국', '드럭스토어'], name: '의료비', sub: '병원' },
  // 쇼핑
  { keywords: ['무신사', '29cm', '에이블리', '지그재그', '패션', '의류', 'H&M', '자라', 'ZARA', '유니클로'], name: '쇼핑', sub: '의류' },
  { keywords: ['쿠팡', '11번가', 'G마켓', '옥션', '위메프', '티몬', '인터파크', '아마존'], name: '쇼핑', sub: '온라인쇼핑' },
  // 여가
  { keywords: ['영화', 'CGV', '롯데시네마', '메가박스', '공연', '콘서트', '전시', '놀이공원', '볼링', '노래방'], name: '여가', sub: '문화생활' },
  { keywords: ['골프', '헬스', '수영장', 'PT', '필라테스', '요가', '클라이밍'], name: '여가', sub: '운동' },
  // 경조사
  { keywords: ['꽃', '화원', '플라워', '선물', '쿠팡플렉스'], name: '경조사', sub: '선물' },
  // 여행
  { keywords: ['호텔', '모텔', '에어비앤비', '야놀자', '여기어때', '숙박'], name: '여행', sub: '숙박' },
  { keywords: ['항공', '에어', '대한항공', '아시아나', '제주항공', '티웨이', '진에어'], name: '여행', sub: '항공' },
]

// ============================================================
// 시간 기반 개인/공동 판별
// 평일 08:00~19:00 → 개인
// 주말 → 공동
// 평일 19:00 이후 / 08:00 이전 → 공동
// ============================================================
function classifyOwnerByTime(date: Date, cardType: '365' | 'LIKIT'): Owner {
  const baseOwner: Owner = cardType === '365' ? 'gaeun' : 'incheon'

  if (isWeekend(date)) return 'shared'

  const hour = date.getHours()
  const isBusinessHours = hour >= 8 && hour < 19
  return isBusinessHours ? baseOwner : 'shared'
}

// ============================================================
// 가맹점 기반 카테고리 분류
// ============================================================
export function classifyByMerchant(merchant: string): {
  owner: Owner | null   // null = 시간 기반으로 판별
  categoryName: string
  categorySub: string
  isSharedForced: boolean
} {
  const m = merchant.toLowerCase()

  // 1순위: 무조건 공동 생활비
  for (const kw of ALWAYS_SHARED_LIVING) {
    if (merchant.includes(kw) || m.includes(kw.toLowerCase())) {
      return { owner: 'shared', categoryName: '생활비', categorySub: '마트', isSharedForced: true }
    }
  }

  // 2순위: 무조건 개인 생활비
  for (const kw of ALWAYS_PERSONAL_LIVING) {
    if (merchant.includes(kw) || m.includes(kw.toLowerCase())) {
      return { owner: null, categoryName: '생활비', categorySub: '미용', isSharedForced: false }
    }
  }

  // 3순위: 외식 카테고리
  for (const kw of DINING_KEYWORDS) {
    if (merchant.includes(kw) || m.includes(kw.toLowerCase())) {
      return { owner: null, categoryName: '외식', categorySub: '식당', isSharedForced: false }
    }
  }

  // 4순위: 나머지 카테고리 매핑
  for (const rule of MERCHANT_CATEGORY_MAP) {
    for (const kw of rule.keywords) {
      if (merchant.includes(kw) || m.includes(kw.toLowerCase())) {
        return { owner: null, categoryName: rule.name, categorySub: rule.sub, isSharedForced: false }
      }
    }
  }

  return { owner: null, categoryName: '기타', categorySub: '', isSharedForced: false }
}

// ============================================================
// SMS 파싱 메인 함수
// ============================================================
export interface ParsedSMSFull extends ParsedSMS {
  owner: Owner
  categoryName: string
  categorySub: string
  isSharedForced: boolean
  parsedAt: Date
}

export function parseSMS(smsText: string, senderCard?: string): ParsedSMSFull | null {
  const text = smsText.trim()

  if (!text.includes('[로카]') && !text.includes('로카')) return null

  // 카드 종류 판별
  const cardType = detectCard(text, senderCard)
  if (!cardType) return null

  // 금액 추출
  const amountMatch = text.match(/(\d{1,3}(?:,\d{3})*)원/)
  if (!amountMatch) return null
  const amount = parseInt(amountMatch[1].replace(/,/g, ''), 10)

  // 날짜+시간 추출 (MM/DD HH:MM 형식)
  const dateTimeMatch = text.match(/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/)
  const dateOnlyMatch = text.match(/(\d{2})\/(\d{2})/)

  const now = new Date()
  let parsedAt = now

  if (dateTimeMatch) {
    const [, mm, dd, hh, min] = dateTimeMatch
    parsedAt = new Date(now.getFullYear(), Number(mm) - 1, Number(dd), Number(hh), Number(min))
  } else if (dateOnlyMatch) {
    const [, mm, dd] = dateOnlyMatch
    parsedAt = new Date(now.getFullYear(), Number(mm) - 1, Number(dd), now.getHours(), now.getMinutes())
  }

  const dateStr = format(parsedAt, 'yyyy-MM-dd')

  // 가맹점 추출
  const merchantPatterns = [
    /승인\(일시불\)\s+([가-힣a-zA-Z0-9\s·\-()]+?)\s+\d{2}\/\d{2}/,
    /승인\s+([가-힣a-zA-Z0-9\s·\-()]+?)\s+\d{2}\/\d{2}/,
    /승인\s+([가-힣a-zA-Z0-9\s·\-()]+?)(?:\s+\d|$)/,
  ]
  let merchant = ''
  for (const pattern of merchantPatterns) {
    const match = text.match(pattern)
    if (match) { merchant = match[1].trim(); break }
  }

  // 가맹점 기반 분류
  const { owner: forcedOwner, categoryName, categorySub, isSharedForced } = classifyByMerchant(merchant)

  // 최종 owner 결정: 가맹점 강제 > 시간 기반
  const owner: Owner = forcedOwner ?? classifyOwnerByTime(parsedAt, cardType)

  const cardName = cardType === '365' ? '로카 365' : '로카 LIKIT'

  return {
    amount,
    merchant,
    date: dateStr,
    cardName,
    owner,
    categoryName,
    categorySub,
    isSharedForced,
    parsedAt,
  }
}
