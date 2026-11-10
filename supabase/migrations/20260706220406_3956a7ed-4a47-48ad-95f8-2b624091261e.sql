-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.dobradinhas
  DROP CONSTRAINT IF EXISTS dobradinhas_lideranca_id_fkey;

ALTER TABLE public.dobradinhas
  ADD CONSTRAINT dobradinhas_lideranca_id_fkey
  FOREIGN KEY (lideranca_id)
  REFERENCES public.liderancas(id)
  ON DELETE CASCADE;
