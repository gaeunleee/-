-- ============================================
-- 2026 가계부 DB 스키마
-- ============================================

-- 카테고리
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,           -- 고정비, 생활비, 외식, ...
  sub_name text,                -- 카페, 배달, 마트, ...
  icon text,
  color text,
  order_num int DEFAULT 0
);

-- 카드
CREATE TABLE cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL,          -- 'incheon' | 'gaeun' | 'shared'
  name text NOT NULL,           -- 로카 365, 로카 라이키, 삼성카드, 체크카드
  sms_keyword text,             -- SMS 파싱용 키워드
  is_auto_parse boolean DEFAULT false
);

-- 가맹점 카테고리 매핑 (자동분류용)
CREATE TABLE merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE, -- 스타벅스, 배달의민족, ...
  category_id uuid REFERENCES categories(id),
  sub_name text
);

-- 거래 내역 (수입/지출/저축 통합)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,                     -- 'income' | 'expense' | 'saving'
  owner text NOT NULL,                    -- 'incheon' | 'gaeun' | 'shared'
  amount bigint NOT NULL,
  category_id uuid REFERENCES categories(id),
  merchant text,
  note text,
  card_id uuid REFERENCES cards(id),
  transaction_date date NOT NULL,
  year int GENERATED ALWAYS AS (EXTRACT(year FROM transaction_date)::int) STORED,
  month int GENERATED ALWAYS AS (EXTRACT(month FROM transaction_date)::int) STORED,
  raw_sms text,                           -- 원본 SMS 텍스트
  is_auto_parsed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 예산
CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id),
  year int NOT NULL,
  month int,                    -- NULL = 연간 기본값
  amount bigint NOT NULL,
  UNIQUE (category_id, year, month)
);

-- ============================================
-- 기본 카테고리 데이터
-- ============================================
INSERT INTO categories (name, sub_name, icon, color, order_num) VALUES
  ('고정비', '관리비',   '🏠', '#6366f1', 1),
  ('고정비', '대출금',   '🏦', '#6366f1', 2),
  ('고정비', '휴대폰',   '📱', '#6366f1', 3),
  ('고정비', '인터넷',   '🌐', '#6366f1', 4),
  ('고정비', '보험',     '🛡️', '#6366f1', 5),
  ('고정비', '구독',     '📺', '#6366f1', 6),
  ('고정비', '회비',     '👥', '#6366f1', 7),
  ('저축',   '적금',     '💰', '#22c55e', 8),
  ('저축',   '주식/투자','📈', '#22c55e', 9),
  ('생활비', '마트',     '🛒', '#f59e0b', 10),
  ('생활비', '생활용품', '🧴', '#f59e0b', 11),
  ('생활비', '미용',     '💇', '#f59e0b', 12),
  ('의료비', '병원',     '🏥', '#ef4444', 13),
  ('의료비', '약국',     '💊', '#ef4444', 14),
  ('교통비', '대중교통', '🚌', '#8b5cf6', 15),
  ('교통비', '택시',     '🚕', '#8b5cf6', 16),
  ('경조사', '축의금',   '💝', '#ec4899', 17),
  ('경조사', '선물',     '🎁', '#ec4899', 18),
  ('경조사', '가족행사', '👨‍👩‍👧', '#ec4899', 19),
  ('쇼핑',   '의류',     '👕', '#14b8a6', 20),
  ('쇼핑',   '잡화',     '🛍️', '#14b8a6', 21),
  ('외식',   '식당',     '🍽️', '#f97316', 22),
  ('외식',   '카페',     '☕', '#f97316', 23),
  ('외식',   '배달',     '🛵', '#f97316', 24),
  ('외식',   '편의점',   '🏪', '#f97316', 25),
  ('여가',   '문화생활', '🎬', '#06b6d4', 26),
  ('여가',   '취미',     '🎮', '#06b6d4', 27),
  ('여행',   '숙박',     '✈️', '#3b82f6', 28),
  ('여행',   '교통',     '🚂', '#3b82f6', 29),
  ('수입',   '급여',     '💵', '#10b981', 30),
  ('수입',   '기타수입', '💴', '#10b981', 31);

-- ============================================
-- 기본 카드 데이터
-- ============================================
INSERT INTO cards (owner, name, sms_keyword, is_auto_parse) VALUES
  ('incheon', '로카 365',   '[로카]',   true),
  ('incheon', '삼성카드',   NULL,        false),
  ('gaeun',   '로카 라이키','[로카]',   true),
  ('gaeun',   '체크카드',   NULL,        false),
  ('shared',  '현금',       NULL,        false);

-- ============================================
-- 가맹점 기본 매핑 데이터
-- ============================================
INSERT INTO merchants (keyword, category_id, sub_name)
SELECT keyword, c.id, sub
FROM (VALUES
  ('스타벅스',     '외식', '카페'),
  ('이디야',       '외식', '카페'),
  ('메가커피',     '외식', '카페'),
  ('컴포즈',       '외식', '카페'),
  ('투썸',         '외식', '카페'),
  ('배달의민족',   '외식', '배달'),
  ('배민',         '외식', '배달'),
  ('쿠팡이츠',     '외식', '배달'),
  ('요기요',       '외식', '배달'),
  ('GS편의점',     '외식', '편의점'),
  ('CU',           '외식', '편의점'),
  ('세븐일레븐',   '외식', '편의점'),
  ('이마트',       '생활비', '마트'),
  ('홈플러스',     '생활비', '마트'),
  ('롯데마트',     '생활비', '마트'),
  ('코스트코',     '생활비', '마트'),
  ('다이소',       '생활비', '생활용품'),
  ('올리브영',     '생활비', '생활용품'),
  ('넷플릭스',     '고정비', '구독'),
  ('유튜브',       '고정비', '구독'),
  ('애플',         '고정비', '구독'),
  ('쿠팡',         '쇼핑', '잡화'),
  ('무신사',       '쇼핑', '의류'),
  ('KTX',          '교통비', '대중교통'),
  ('SRT',          '교통비', '대중교통'),
  ('카카오택시',   '교통비', '택시'),
  ('우버',         '교통비', '택시')
) AS t(keyword, name, sub)
JOIN categories c ON c.name = t.name AND c.sub_name = t.sub;

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모든 거래 조회/수정 가능 (2인 가계부)
CREATE POLICY "authenticated users can do all" ON transactions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can do all" ON budgets
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "all can read categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "all can read cards" ON cards
  FOR SELECT USING (true);

CREATE POLICY "all can read merchants" ON merchants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can manage merchants" ON merchants
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
