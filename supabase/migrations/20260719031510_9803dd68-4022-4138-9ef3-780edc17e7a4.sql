-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.liderancas
  ADD COLUMN IF NOT EXISTS permite_cadastro_cabos boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_lideranca_para_cadastro_cabo(p_token text)
RETURNS TABLE(lideranca_id uuid, lideranca_nome text, cidade_nome text, coordenador_user_id uuid, permite boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.nome, c.nome, l.coordenador_user_id, l.permite_cadastro_cabos
  FROM public.liderancas l
  LEFT JOIN public.cidades c ON c.id = l.cidade_base_id
  WHERE l.token_publico = lower(trim(p_token))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_lideranca_para_cadastro_cabo(text) TO anon, authenticated;
