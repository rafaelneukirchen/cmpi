-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.movements
  ADD COLUMN leader_name text,
  ADD COLUMN coordinator_name text;
