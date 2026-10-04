-- PostgreSQL Database Schema for Personal Finance & Wealth Tracker
-- Direct SQL DDL without ORM

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'INR',
    current_age INTEGER DEFAULT 28,
    target_retirement_age INTEGER DEFAULT 50,
    monthly_income NUMERIC(15, 2) DEFAULT 0.00,
    monthly_expense NUMERIC(15, 2) DEFAULT 0.00,
    target_savings_rate NUMERIC(5, 2) DEFAULT 30.00,
    emergency_fund_amount NUMERIC(15, 2) DEFAULT 0.00,
    dependents_count INTEGER DEFAULT 0,
    health_dependents JSONB DEFAULT '[]'::jsonb,
    is_onboarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safely add is_onboarded to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_expense NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_fund_amount NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS health_dependents JSONB DEFAULT '[]'::jsonb;

-- 2. REFRESH TOKENS TABLE
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL means global system default
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    icon VARCHAR(50) DEFAULT 'Tag',
    color VARCHAR(20) DEFAULT '#10B981',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. SUBCATEGORIES TABLE
CREATE TABLE IF NOT EXISTS subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('SAVINGS', 'CURRENT', 'CREDIT_CARD', 'WALLET', 'FIXED_DEPOSIT', 'INVESTMENT', 'OTHER')),
    balance NUMERIC(15, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'INR',
    institution VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    amount NUMERIC(15, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description VARCHAR(255) NOT NULL,
    notes TEXT,
    tags VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. ASSETS TABLE
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    asset_class VARCHAR(50) NOT NULL CHECK (asset_class IN ('EQUITY', 'MUTUAL_FUND', 'COMMODITY_GOLD', 'REAL_ESTATE', 'CASH_EQUIVALENT', 'FIXED_INCOME', 'CRYPTO', 'OTHER')),
    sub_type VARCHAR(100), -- e.g. 'Physical Gold', 'Large Cap Stock', 'Sovereign Gold Bond', 'Commercial Property'
    invested_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    current_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    quantity NUMERIC(15, 4) DEFAULT 1.0000,
    buy_price NUMERIC(15, 2) DEFAULT 0.00,
    current_price NUMERIC(15, 2) DEFAULT 0.00,
    purchase_date DATE,
    notes TEXT,
    meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. LIABILITIES TABLE (DEBTS & LOANS)
CREATE TABLE IF NOT EXISTS liabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    liability_type VARCHAR(50) NOT NULL CHECK (liability_type IN ('HOME_LOAN', 'PERSONAL_LOAN', 'CAR_LOAN', 'EDUCATION_LOAN', 'CREDIT_CARD', 'GOLD_LOAN', 'BUSINESS_LOAN', 'OTHER')),
    principal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    current_outstanding NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_rate_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    tenure_months INTEGER NOT NULL DEFAULT 12,
    emi_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    start_date DATE DEFAULT CURRENT_DATE,
    lender VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. INSURANCES TABLE (HEALTH, TERM & MOTOR)
CREATE TABLE IF NOT EXISTS insurances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_name VARCHAR(150) NOT NULL,
    insurance_type VARCHAR(30) NOT NULL CHECK (insurance_type IN ('HEALTH', 'TERM', 'MOTOR', 'HOME', 'OTHER')),
    sum_insured NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    annual_premium NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    policy_start_date DATE,
    renewal_date DATE,
    dependents_covered INTEGER DEFAULT 0,
    insurer_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. BUDGETS TABLE
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    monthly_limit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    month INTEGER NOT NULL, -- 1-12
    year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_category_month_year UNIQUE (user_id, category_id, month, year)
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id, asset_class);
CREATE INDEX IF NOT EXISTS idx_liabilities_user ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_insurances_user ON insurances(user_id, insurance_type);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- SEED DEFAULT SYSTEM CATEGORIES
INSERT INTO categories (id, user_id, name, type, icon, color, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, 'Salary', 'INCOME', 'Briefcase', '#10B981', TRUE),
    ('00000000-0000-0000-0000-000000000002', NULL, 'Investments & Returns', 'INCOME', 'TrendingUp', '#059669', TRUE),
    ('00000000-0000-0000-0000-000000000003', NULL, 'Freelance / Business', 'INCOME', 'Laptop', '#34D399', TRUE),
    ('00000000-0000-0000-0000-000000000004', NULL, 'Rental Income', 'INCOME', 'Home', '#6EE7B7', TRUE),
    ('00000000-0000-0000-0000-000000000005', NULL, 'Other Income', 'INCOME', 'PlusCircle', '#A7F3D0', TRUE),

    ('00000000-0000-0000-0000-000000000010', NULL, 'Housing & Rent', 'EXPENSE', 'Home', '#EF4444', TRUE),
    ('00000000-0000-0000-0000-000000000011', NULL, 'Food & Groceries', 'EXPENSE', 'Utensils', '#F59E0B', TRUE),
    ('00000000-0000-0000-0000-000000000012', NULL, 'Utilities & Bills', 'EXPENSE', 'Zap', '#6366F1', TRUE),
    ('00000000-0000-0000-0000-000000000013', NULL, 'Transportation & Fuel', 'EXPENSE', 'Car', '#EC4899', TRUE),
    ('00000000-0000-0000-0000-000000000014', NULL, 'Healthcare & Medical', 'EXPENSE', 'Activity', '#14B8A6', TRUE),
    ('00000000-0000-0000-0000-000000000015', NULL, 'Shopping & Lifestyle', 'EXPENSE', 'ShoppingBag', '#8B5CF6', TRUE),
    ('00000000-0000-0000-0000-000000000016', NULL, 'Entertainment & Leisure', 'EXPENSE', 'Film', '#F97316', TRUE),
    ('00000000-0000-0000-0000-000000000017', NULL, 'Insurance Premiums', 'EXPENSE', 'ShieldCheck', '#3B82F6', TRUE),
    ('00000000-0000-0000-0000-000000000018', NULL, 'Loan EMI & Debt Payoff', 'EXPENSE', 'CreditCard', '#DC2626', TRUE),
    ('00000000-0000-0000-0000-000000000019', NULL, 'Education & Courses', 'EXPENSE', 'BookOpen', '#0284C7', TRUE),
    ('00000000-0000-0000-0000-000000000020', NULL, 'Other Expenses', 'EXPENSE', 'MinusCircle', '#64748B', TRUE)
ON CONFLICT (id) DO NOTHING;

-- SEED DEFAULT SUBCATEGORIES
INSERT INTO subcategories (category_id, name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Monthly Salary'),
    ('00000000-0000-0000-0000-000000000001', 'Bonus & Incentive'),
    ('00000000-0000-0000-0000-000000000002', 'Dividends'),
    ('00000000-0000-0000-0000-000000000002', 'Stock Capital Gains'),
    ('00000000-0000-0000-0000-000000000002', 'Mutual Fund Gains'),
    ('00000000-0000-0000-0000-000000000002', 'Interest (FD/Savings)'),
    ('00000000-0000-0000-0000-000000000010', 'Apartment Rent'),
    ('00000000-0000-0000-0000-000000000010', 'Maintenance & Repairs'),
    ('00000000-0000-0000-0000-000000000010', 'Property Tax'),
    ('00000000-0000-0000-0000-000000000011', 'Daily Groceries'),
    ('00000000-0000-0000-0000-000000000011', 'Dining Out'),
    ('00000000-0000-0000-0000-000000000011', 'Coffee & Snacks'),
    ('00000000-0000-0000-0000-000000000012', 'Electricity Bill'),
    ('00000000-0000-0000-0000-000000000012', 'Water & Gas'),
    ('00000000-0000-0000-0000-000000000012', 'Broadband & Mobile'),
    ('00000000-0000-0000-0000-000000000013', 'Fuel & Petrol'),
    ('00000000-0000-0000-0000-000000000013', 'Cab & Auto'),
    ('00000000-0000-0000-0000-000000000013', 'Vehicle Service'),
    ('00000000-0000-0000-0000-000000000014', 'Doctor Consultations'),
    ('00000000-0000-0000-0000-000000000014', 'Medicines & Pharmacy'),
    ('00000000-0000-0000-0000-000000000014', 'Lab Tests'),
    ('00000000-0000-0000-0000-000000000017', 'Health Insurance Premium'),
    ('00000000-0000-0000-0000-000000000017', 'Term Life Insurance Premium'),
    ('00000000-0000-0000-0000-000000000018', 'Home Loan EMI'),
    ('00000000-0000-0000-0000-000000000018', 'Car Loan EMI'),
    ('00000000-0000-0000-0000-000000000018', 'Personal Loan EMI')
ON CONFLICT DO NOTHING;

-- ===== PHASE 2: ADVANCED FINANCIAL PLANNING TABLES =====

-- 11. FINANCIAL PROFILES TABLE (Detailed User Financial Profile)
CREATE TABLE IF NOT EXISTS financial_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    risk_tolerance VARCHAR(20) NOT NULL CHECK (risk_tolerance IN ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
    investment_experience VARCHAR(20) NOT NULL CHECK (investment_experience IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    time_horizon_years INTEGER DEFAULT 10,
    total_dependents INTEGER DEFAULT 0,
    major_financial_goals TEXT,
    current_liquidity NUMERIC(15, 2) DEFAULT 0.00,
    networth NUMERIC(15, 2) DEFAULT 0.00,
    debt_to_income_ratio NUMERIC(5, 2) DEFAULT 0.00,
    financial_health_score INTEGER DEFAULT 0,
    profile_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. FINANCIAL GOALS TABLE (Multiple Goal Tracking)
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_name VARCHAR(255) NOT NULL,
    goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN ('RETIREMENT', 'DOWN_PAYMENT', 'DEBT_PAYOFF', 'WEALTH_BUILD', 'EDUCATION', 'VACATION', 'BUSINESS', 'EMERGENCY_FUND', 'OTHER')),
    target_amount NUMERIC(15, 2) NOT NULL,
    current_amount NUMERIC(15, 2) DEFAULT 0.00,
    target_date DATE NOT NULL,
    priority INTEGER DEFAULT 3,
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED')),
    suggested_monthly_savings NUMERIC(15, 2) DEFAULT 0.00,
    allocated_monthly_savings NUMERIC(15, 2) DEFAULT 0.00,
    progress_percentage NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. DEBTS TABLE (Extended Debt Tracking)
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debt_name VARCHAR(255) NOT NULL,
    debt_type VARCHAR(50) NOT NULL CHECK (debt_type IN ('CREDIT_CARD', 'PERSONAL_LOAN', 'HOME_LOAN', 'CAR_LOAN', 'EDUCATION_LOAN', 'GOLD_LOAN', 'BUSINESS_LOAN', 'OTHER')),
    principal_amount NUMERIC(15, 2) NOT NULL,
    current_outstanding NUMERIC(15, 2) NOT NULL,
    interest_rate_pct NUMERIC(6, 2) NOT NULL,
    tenure_months INTEGER,
    monthly_emi NUMERIC(15, 2),
    start_date DATE,
    end_date DATE,
    creditor_name VARCHAR(100),
    priority_payoff BOOLEAN DEFAULT FALSE,
    payoff_strategy VARCHAR(30) DEFAULT 'STANDARD' CHECK (payoff_strategy IN ('SNOWBALL', 'AVALANCHE', 'STANDARD')),
    total_interest_paid NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. INSURANCE POLICIES TABLE (Enhanced Insurance Planning)
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_name VARCHAR(255) NOT NULL,
    policy_type VARCHAR(30) NOT NULL CHECK (policy_type IN ('HEALTH', 'TERM_LIFE', 'MOTOR', 'HOME', 'TRAVEL', 'CRITICAL_ILLNESS', 'OTHER')),
    sum_insured NUMERIC(15, 2) NOT NULL,
    annual_premium NUMERIC(15, 2) NOT NULL,
    policy_number VARCHAR(100),
    start_date DATE,
    maturity_date DATE,
    renewal_date DATE,
    coverage_type VARCHAR(50), -- e.g., 'Individual', 'Family', 'Group'
    dependents_covered INTEGER DEFAULT 0,
    insurer_name VARCHAR(100),
    payment_frequency VARCHAR(20) NOT NULL DEFAULT 'YEARLY',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    next_payment_date DATE,
    last_payment_date DATE,
    agent_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'LAPSED', 'RENEWED')),
    document_url TEXT,
    claim_tracker JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) NOT NULL DEFAULT 'YEARLY';
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS next_payment_date DATE;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS last_payment_date DATE;

-- 15. AI CONVERSATIONS TABLE (Chat History)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_title VARCHAR(255),
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. RECOMMENDATIONS TABLE (AI-Generated Suggestions)
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('DEBT_PAYOFF', 'INVESTMENT', 'SAVINGS', 'INSURANCE', 'BUDGET', 'GOAL', 'TAX', 'LIFESTYLE', 'EMERGENCY', 'OTHER')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    urgency VARCHAR(20) DEFAULT 'MEDIUM' CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    potential_savings NUMERIC(15, 2) DEFAULT 0.00,
    impact_timeframe VARCHAR(50), -- e.g., 'Immediate', '3 months', '1 year'
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'COMPLETED', 'DISMISSED')),
    action_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. SCENARIOS TABLE (What-If Analysis)
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenario_name VARCHAR(255) NOT NULL,
    scenario_type VARCHAR(50) NOT NULL CHECK (scenario_type IN ('INCOME_CHANGE', 'EXPENSE_CHANGE', 'INVESTMENT_RETURN', 'JOB_LOSS', 'INHERITANCE', 'EMERGENCY', 'CUSTOM')),
    description TEXT,
    assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
    results JSONB DEFAULT '{}'::jsonb,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. TAX SETTINGS TABLE (Tax Planning Profile)
CREATE TABLE IF NOT EXISTS tax_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    financial_year VARCHAR(10), -- e.g., 'FY2023-24'
    tax_regime VARCHAR(20) DEFAULT 'NEW' CHECK (tax_regime IN ('OLD', 'NEW')),
    annual_income NUMERIC(15, 2) DEFAULT 0.00,
    section_80c_limit NUMERIC(15, 2) DEFAULT 150000.00,
    section_80c_invested NUMERIC(15, 2) DEFAULT 0.00,
    section_80d_limit NUMERIC(15, 2) DEFAULT 100000.00,
    section_80d_invested NUMERIC(15, 2) DEFAULT 0.00,
    home_loan_interest NUMERIC(15, 2) DEFAULT 0.00,
    estimated_tax_liability NUMERIC(15, 2) DEFAULT 0.00,
    tax_calculator_result JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. FINANCIAL MILESTONES TABLE (Achievements & Streaks)
CREATE TABLE IF NOT EXISTS financial_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone_name VARCHAR(255) NOT NULL,
    milestone_type VARCHAR(50) NOT NULL CHECK (milestone_type IN ('EMERGENCY_FUND', 'DEBT_FREE', 'NET_WORTH', 'INVESTMENT_GOAL', 'SAVINGS_STREAK', 'BUDGET_SUCCESS', 'INSURANCE_COMPLETE', 'OTHER')),
    description TEXT,
    target_value NUMERIC(15, 2),
    achieved_value NUMERIC(15, 2),
    achieved_date DATE,
    is_achieved BOOLEAN DEFAULT FALSE,
    celebration_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR PHASE 2 TABLES
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_priority ON debts(user_id, priority_payoff);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_user ON insurance_policies(user_id, policy_type);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_renewal ON insurance_policies(user_id, renewal_date);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_status ON recommendations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scenarios_user ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_milestones_user ON financial_milestones(user_id);
