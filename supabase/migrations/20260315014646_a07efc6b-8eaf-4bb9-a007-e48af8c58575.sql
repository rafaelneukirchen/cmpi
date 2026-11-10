-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.liderancas DROP COLUMN bairro;

ALTER TABLE public.liderancas ADD COLUMN bairros text[] NULL DEFAULT '{}'::text[];
