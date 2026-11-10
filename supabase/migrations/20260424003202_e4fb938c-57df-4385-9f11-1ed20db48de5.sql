-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS criado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS criado_por_nome text;

ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS criado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS criado_por_nome text;

ALTER TABLE public.payment_schedule
  ADD COLUMN IF NOT EXISTS criado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS criado_por_nome text;
