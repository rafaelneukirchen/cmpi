-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS serial_number text;

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS serial_number text;
