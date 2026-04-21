import { NextRequest, NextResponse } from 'next/server'
import { parseSMS, guessCategory } from '@/lib/sms-parser'
import { createServiceClient } from '@/lib/supabase'

// iOS 단축어에서 호출하는 SMS webhook
// POST { sms: string, card: string, secret: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sms, card, secret } = body

    // 인증 확인
    if (secret !== process.env.SMS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sms) {
      return NextResponse.json({ error: 'SMS text required' }, { status: 400 })
    }

    // SMS 파싱
    const parsed = parseSMS(sms, card)
    if (!parsed) {
      return NextResponse.json({ error: 'Failed to parse SMS', raw: sms }, { status: 422 })
    }

    const supabase = createServiceClient()

    // 카드 ID 조회
    const { data: cardData } = await supabase
      .from('cards')
      .select('id')
      .eq('name', parsed.cardName)
      .single()

    // 가맹점으로 카테고리 추측
    const guessed = guessCategory(parsed.merchant)
    let categoryId: string | null = null

    if (guessed) {
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('name', guessed.name)
        .eq('sub_name', guessed.sub)
        .single()
      categoryId = catData?.id ?? null
    }

    // DB에 자동 기입
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        type: 'expense',
        owner: parsed.owner,
        amount: parsed.amount,
        category_id: categoryId,
        merchant: parsed.merchant,
        card_id: cardData?.id ?? null,
        transaction_date: parsed.date,
        raw_sms: sms,
        is_auto_parsed: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      transaction: data,
      parsed,
      categoryGuessed: !!categoryId,
    })
  } catch (err) {
    console.error('SMS webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
