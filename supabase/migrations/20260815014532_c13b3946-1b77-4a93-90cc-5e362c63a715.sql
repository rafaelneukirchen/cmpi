-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.cidades
  ADD COLUMN IF NOT EXISTS endereco_entrega text,
  ADD COLUMN IF NOT EXISTS entrega_contato_nome text,
  ADD COLUMN IF NOT EXISTS entrega_contato_telefone text;
