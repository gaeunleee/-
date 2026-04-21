import { ParsedSMS, Owner } from '@/types'
import { format } from 'date-fns'

// 로카카드 SMS 패턴
// 예: [로카] 인천 12,000원 승인 스타벅스 04/21 14:32
// 예: [Web발신][로카] 6,500원 승인(일시불) 스타벅스 04/21 14:32
const LOCA_PATTERNS = [
  // [로카] 금액원 승인 가맹점 MM/DD HH:MM
  /\[로카\].*?(\d{1,3}(?:,\d{3})*)원\s*승인[^\n]*?\s+([가-힣a-zA-Z0-9\s]+?)\s+(\d{2})\/(\d{2})/,
  // 금액원 가맹점
  /(\d{1,3}(?:,\d{3})*)원.*승인.*?([가-힣a-zA-Z0-9]+)\s+(\d{2})\/(\d{2})/,
]

// 카드 소유자 판별 키워드
const OWNER_KEYWORDS: Record<string, Owner> = {
  '365':    'incheon',  // 로카 365 → 인천
  '라이키': 'gaeun',   // 로카 라이키 → 가은
}

export function parseSMS(smsText: string, senderCard?: string): ParsedSMS | null {
  const text = smsText.trim()

  // 로카카드 여부 확인
  if (!text.includes('[로카]') && !text.includes('로카')) {
    return null
  }

  let amount = 0
  let merchant = ''
  let dateStr = format(new Date(), 'yyyy-MM-dd')
  let owner: Owner = 'incheon'

  // 금액 추출 (12,000원 또는 12000원)
  const amountMatch = text.match(/(\d{1,3}(?:,\d{3})*)원/)
  if (amountMatch) {
    amount = parseInt(amountMatch[1].replace(/,/g, ''), 10)
  }

  if (!amount) return null

  // 날짜 추출 (MM/DD 형식)
  const dateMatch = text.match(/(\d{2})\/(\d{2})/)
  if (dateMatch) {
    const year = new Date().getFullYear()
    const month = dateMatch[1]
    const day = dateMatch[2]
    dateStr = `${year}-${month}-${day}`
  }

  // 가맹점 추출: "승인" 또는 "승인(일시불)" 이후의 텍스트
  const merchantPatterns = [
    /승인\(일시불\)\s+([가-힣a-zA-Z0-9\s·\-]+?)\s+\d{2}\/\d{2}/,
    /승인\s+([가-힣a-zA-Z0-9\s·\-]+?)\s+\d{2}\/\d{2}/,
    /승인\s+([가-힣a-zA-Z0-9\s·\-]+?)(?:\s+\d|$)/,
  ]

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern)
    if (match) {
      merchant = match[1].trim()
      break
    }
  }

  // 카드 소유자 판별
  for (const [keyword, cardOwner] of Object.entries(OWNER_KEYWORDS)) {
    if (text.includes(keyword) || senderCard?.includes(keyword)) {
      owner = cardOwner
      break
    }
  }

  // senderCard가 명시된 경우 우선 적용
  if (senderCard) {
    if (senderCard.includes('365')) owner = 'incheon'
    else if (senderCard.includes('라이키')) owner = 'gaeun'
  }

  const cardName = owner === 'incheon' ? '로카 365' : '로카 라이키'

  return { amount, merchant, date: dateStr, cardName, owner }
}

// 가맹점명으로 카테고리 추천 (DB 매핑 전 클라이언트 사전 매핑)
export const QUICK_CATEGORY_MAP: Record<string, { name: string; sub: string }> = {
  '스타벅스': { name: '외식', sub: '카페' },
  '이디야':   { name: '외식', sub: '카페' },
  '메가커피': { name: '외식', sub: '카페' },
  '투썸':     { name: '외식', sub: '카페' },
  '컴포즈':   { name: '외식', sub: '카페' },
  '배달의민족': { name: '외식', sub: '배달' },
  '배민':     { name: '외식', sub: '배달' },
  '쿠팡이츠': { name: '외식', sub: '배달' },
  'GS':       { name: '외식', sub: '편의점' },
  'CU':       { name: '외식', sub: '편의점' },
  '세븐':     { name: '외식', sub: '편의점' },
  '이마트':   { name: '생활비', sub: '마트' },
  '홈플러스': { name: '생활비', sub: '마트' },
  '롯데마트': { name: '생활비', sub: '마트' },
  '코스트코': { name: '생활비', sub: '마트' },
  '다이소':   { name: '생활비', sub: '생활용품' },
  '올리브영': { name: '생활비', sub: '생활용품' },
  '넷플릭스': { name: '고정비', sub: '구독' },
  '유튜브':   { name: '고정비', sub: '구독' },
  '애플':     { name: '고정비', sub: '구독' },
  '쿠팡':     { name: '쇼핑', sub: '잡화' },
  'KTX':      { name: '교통비', sub: '대중교통' },
  'SRT':      { name: '교통비', sub: '대중교통' },
}

export function guessCategory(merchant: string): { name: string; sub: string } | null {
  for (const [keyword, category] of Object.entries(QUICK_CATEGORY_MAP)) {
    if (merchant.includes(keyword)) return category
  }
  return null
}
