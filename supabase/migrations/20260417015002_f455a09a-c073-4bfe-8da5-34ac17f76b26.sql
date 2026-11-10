-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS payment_method text;
