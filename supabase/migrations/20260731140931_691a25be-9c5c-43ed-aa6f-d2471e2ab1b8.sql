-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.normalize_city_name(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      regexp_replace(
        lower(translate(btrim(coalesce(p,'')),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')),
        '[[:space:]]*[-/,]?[[:space:]]*(sp|s\.p\.|est(ado)? de sao paulo)$', ''),
      '[[:space:]]+', ' ', 'g')),
  '');
$$;

CREATE INDEX IF NOT EXISTS idx_cidades_nome_norm ON public.cidades (public.normalize_city_name(nome));

CREATE OR REPLACE FUNCTION public.resolve_cidade_nome(p_nome text, p_cidade_id uuid DEFAULT NULL)
RETURNS TABLE(cidade_id uuid, cidade_nome text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_id uuid;
  v_nome text;
BEGIN
  v_norm := public.normalize_city_name(p_nome);
  IF v_norm IS NULL AND lower(btrim(coalesce(p_nome,''))) IN ('sp','s.p.','s.p') THEN
    v_norm := 'sao paulo';
  END IF;

  IF v_norm IS NOT NULL THEN
    SELECT c.id, c.nome INTO v_id, v_nome
    FROM public.cidades c
    WHERE public.normalize_city_name(c.nome) = v_norm
    LIMIT 1;
  END IF;

  IF v_id IS NULL AND p_cidade_id IS NOT NULL THEN
    SELECT c.id, c.nome INTO v_id, v_nome
    FROM public.cidades c WHERE c.id = p_cidade_id LIMIT 1;
  END IF;

  RETURN QUERY SELECT COALESCE(v_id, p_cidade_id), COALESCE(v_nome, btrim(p_nome));
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_eleitor_cidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_nome text;
BEGIN
  IF NEW.cidade_nome IS NULL AND NEW.cidade_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT r.cidade_id, r.cidade_nome INTO v_id, v_nome
  FROM public.resolve_cidade_nome(NEW.cidade_nome, NEW.cidade_id) r;
  NEW.cidade_id := v_id;
  NEW.cidade_nome := NULLIF(v_nome, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_eleitor_cidade ON public.eleitores_captados;

CREATE TRIGGER trg_normalize_eleitor_cidade
BEFORE INSERT OR UPDATE OF cidade_nome, cidade_id ON public.eleitores_captados
FOR EACH ROW EXECUTE FUNCTION public.normalize_eleitor_cidade();

CREATE OR REPLACE FUNCTION public.list_cidades_publicas()
RETURNS TABLE(nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.nome FROM public.cidades c ORDER BY c.nome;
$$;

GRANT EXECUTE ON FUNCTION public.list_cidades_publicas() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.normalize_city_name(text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_cidade_nome(text, uuid) TO anon, authenticated;
