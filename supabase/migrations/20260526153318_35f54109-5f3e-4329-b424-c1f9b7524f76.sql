-- Exportação sem dados: somente estrutura e lógica.
CREATE UNIQUE INDEX IF NOT EXISTS dobradinhas_candidato_lideranca_unique
ON public.dobradinhas (lower(trim(candidato_parceiro)), lideranca_id);
