import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())
  const month = Number(searchParams.get('month') ?? new Date().getMonth() + 1)

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`*, category:categories(*)`)
    .eq('year', year)
    .eq('month', month)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const saving = transactions
    .filter(t => t.type === 'saving')
    .reduce((sum, t) => sum + t.amount, 0)

  // 카테고리별 집계
  const categoryMap = new Map<string, { category: any; amount: number }>()
  transactions
    .filter(t => t.type === 'expense' && t.category)
    .forEach(t => {
      const key = t.category_id!
      if (!categoryMap.has(key)) {
        categoryMap.set(key, { category: t.category, amount: 0 })
      }
      categoryMap.get(key)!.amount += t.amount
    })

  // 예산 조회
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('year', year)
    .or(`month.eq.${month},month.is.null`)

  const budgetMap = new Map<string, number>()
  budgets?.forEach(b => {
    budgetMap.set(b.category_id, b.amount)
  })

  const byCategory = Array.from(categoryMap.values())
    .map(({ category, amount }) => ({
      category,
      amount,
      budget: budgetMap.get(category.id),
      rate: budgetMap.get(category.id)
        ? Math.round((amount / budgetMap.get(category.id)!) * 100)
        : undefined,
    }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    income,
    expense,
    saving,
    balance: income - expense - saving,
    savingRate: income > 0 ? Math.round((saving / income) * 100) : 0,
    byCategory,
  })
}
