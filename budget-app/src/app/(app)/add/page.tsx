'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Category, Card, Owner, TransactionType } from '@/types'
import { supabase } from '@/lib/supabase'
import { cn, OWNER_LABEL } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

type TabType = 'expense' | 'income' | 'saving'

export default function AddPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabType>('expense')
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const [form, setForm] = useState({
    amount: '',
    category_id: '',
    merchant: '',
    note: '',
    card_id: '',
    owner: 'incheon' as Owner,
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    supabase.from('categories').select('*').order('order_num').then(({ data }) => setCategories(data ?? []))
    supabase.from('cards').select('*').then(({ data }) => setCards(data ?? []))
  }, [])

  const filteredCards = cards.filter(c => c.owner === form.owner || c.owner === 'shared')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return
    setSaving(true)

    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: tab,
        owner: form.owner,
        amount: Number(form.amount.replace(/,/g, '')),
        category_id: form.category_id || null,
        merchant: form.merchant || null,
        note: form.note || null,
        card_id: form.card_id || null,
        transaction_date: form.transaction_date,
      }),
    })

    setDone(true)
    setTimeout(() => {
      setDone(false)
      setSaving(false)
      setForm(prev => ({ ...prev, amount: '', merchant: '', note: '', category_id: '', card_id: '' }))
    }, 1200)
  }

  function setAmount(v: string) {
    const n = v.replace(/[^0-9]/g, '')
    setForm(prev => ({ ...prev, amount: n ? Number(n).toLocaleString() : '' }))
  }

  const expenseCategories = categories.filter(c => !['수입', '저축'].includes(c.name))
  const incomeCategories = categories.filter(c => c.name === '수입')
  const savingCategories = categories.filter(c => c.name === '저축')

  const visibleCategories =
    tab === 'expense' ? expenseCategories :
    tab === 'income' ? incomeCategories :
    savingCategories

  return (
    <div className="flex flex-col min-h-full">
      {/* 탭 */}
      <div className="flex border-b border-gray-100">
        {(['expense', 'income', 'saving'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-4 text-sm font-medium transition-colors border-b-2',
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'
            )}
          >
            {t === 'expense' ? '지출' : t === 'income' ? '수입' : '저축'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
        {/* 담당자 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">담당자</label>
          <div className="flex gap-2">
            {(['incheon', 'gaeun', 'shared'] as Owner[]).map(o => (
              <button
                key={o}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, owner: o, card_id: '' }))}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  form.owner === o ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                )}
              >
                {OWNER_LABEL[o]}
              </button>
            ))}
          </div>
        </div>

        {/* 금액 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">금액</label>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-bold outline-none text-right"
              required
            />
            <span className="text-gray-400 font-medium">원</span>
          </div>
        </div>

        {/* 날짜 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">날짜</label>
          <input
            type="date"
            value={form.transaction_date}
            onChange={e => setForm(prev => ({ ...prev, transaction_date: e.target.value }))}
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none"
          />
        </div>

        {/* 카테고리 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">카테고리</label>
          <div className="grid grid-cols-4 gap-2">
            {visibleCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, category_id: cat.id }))}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-colors',
                  form.category_id === cat.id ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600'
                )}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="truncate w-full text-center">{cat.sub_name || cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 가맹점 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">가맹점 / 내용</label>
          <input
            type="text"
            placeholder="예: 스타벅스, 배달의민족"
            value={form.merchant}
            onChange={e => setForm(prev => ({ ...prev, merchant: e.target.value }))}
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none"
          />
        </div>

        {/* 카드 */}
        {tab === 'expense' && (
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">결제 수단</label>
            <div className="flex flex-wrap gap-2">
              {filteredCards.map(card => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, card_id: card.id }))}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-medium transition-colors',
                    form.card_id === card.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {card.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메모 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">메모 (선택)</label>
          <input
            type="text"
            placeholder="메모를 입력하세요"
            value={form.note}
            onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !form.amount}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-white transition-all',
            done ? 'bg-green-500' : 'bg-indigo-600 active:bg-indigo-700',
            (!form.amount) && 'opacity-40'
          )}
        >
          {done ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle size={18} /> 저장됨
            </span>
          ) : '저장하기'}
        </button>
      </form>
    </div>
  )
}
