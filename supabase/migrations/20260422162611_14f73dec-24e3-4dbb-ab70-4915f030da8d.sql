-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.reimbursements ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS payment_method text;
