'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Category, Budget } from '@/types'
import { formatKRW, cn } from '@/lib/utils'
import { Pencil, Check, X } from 'lucide-react'

export default function BudgetPage() {
  const now = new Date()
  const year = now.getFullYear()
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').not('name', 'in', '("수입")').order('order_num'),
      supabase.from('budgets').select('*, category:categories(*)').eq('year', year).is('month', null),
    ]).then(([{ data: cats }, { data: buds }]) => {
      setCategories(cats ?? [])
      setBudgets(buds ?? [])
    })
  }, [year])

  function getBudget(catId: string) {
    return budgets.find(b => b.category_id === catId)
  }

  async function saveBudget(catId: string) {
    const amount = Number(editValue.replace(/,/g, ''))
    if (!amount) return

    const existing = getBudget(catId)
    if (existing) {
      const { data } = await supabase.from('budgets').update({ amount }).eq('id', existing.id).select('*, category:categories(*)').single()
      if (data) setBudgets(prev => prev.map(b => b.id === existing.id ? data : b))
    } else {
      const { data } = await supabase.from('budgets').insert({ category_id: catId, year, month: null, amount }).select('*, category:categories(*)').single()
      if (data) setBudgets(prev => [...prev, data])
    }
    setEditing(null)
    setEditValue('')
  }

  const grouped = categories.reduce<Record<string, Category[]>>((acc, cat) => {
    if (!acc[cat.name]) acc[cat.name] = []
    acc[cat.name].push(cat)
    return acc
  }, {})

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)

  return (
    <div>
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10 px-4 py-3">
        <h1 className="font-semibold text-center">예산 관리</h1>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-indigo-50 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">월 총 예산</p>
          <p className="text-2xl font-bold text-indigo-600">{formatKRW(totalBudget)}</p>
        </div>

        {Object.entries(grouped).map(([groupName, cats]) => (
          <div key={groupName}>
            <h2 className="text-xs font-semibold text-gray-500 mb-2">{groupName}</h2>
            <div className="bg-white rounded-2xl divide-y divide-gray-50 shadow-sm">
              {cats.map(cat => {
                const budget = getBudget(cat.id)
                const isEditing = editing === cat.id

                return (
                  <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xl w-8">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cat.sub_name || cat.name}</p>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-28 text-right bg-gray-50 rounded-lg px-2 py-1 text-sm outline-none border border-indigo-300"
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && saveBudget(cat.id)}
                        />
                        <button onClick={() => saveBudget(cat.id)} className="text-green-500"><Check size={16} /></button>
                        <button onClick={() => setEditing(null)} className="text-gray-400"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm', budget ? 'font-semibold text-gray-900' : 'text-gray-300')}>
                          {budget ? formatKRW(budget.amount) : '미설정'}
                        </span>
                        <button
                          onClick={() => { setEditing(cat.id); setEditValue(budget ? String(budget.amount) : '') }}
                          className="text-gray-300 hover:text-indigo-500 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
