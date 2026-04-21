export type Owner = 'incheon' | 'gaeun' | 'shared'
export type TransactionType = 'income' | 'expense' | 'saving'

export interface Category {
  id: string
  name: string
  sub_name: string | null
  icon: string | null
  color: string | null
  order_num: number
}

export interface Card {
  id: string
  owner: Owner
  name: string
  sms_keyword: string | null
  is_auto_parse: boolean
}

export interface Transaction {
  id: string
  type: TransactionType
  owner: Owner
  amount: number
  category_id: string | null
  merchant: string | null
  note: string | null
  card_id: string | null
  transaction_date: string
  year: number
  month: number
  raw_sms: string | null
  is_auto_parsed: boolean
  created_at: string
  category?: Category
  card?: Card
}

export interface Budget {
  id: string
  category_id: string
  year: number
  month: number | null
  amount: number
  category?: Category
}

export interface MonthlySummary {
  income: number
  expense: number
  saving: number
  balance: number
  savingRate: number
  byCategory: CategorySummary[]
}

export interface CategorySummary {
  category: Category
  amount: number
  budget?: number
  rate?: number
}

export interface ParsedSMS {
  amount: number
  merchant: string
  date: string
  cardName: string
  owner: Owner
}
