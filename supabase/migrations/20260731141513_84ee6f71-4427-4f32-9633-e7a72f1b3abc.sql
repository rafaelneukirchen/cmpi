-- Exportação sem dados: somente estrutura e lógica.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.resolve_cidade_nome(p_nome text, p_cidade_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(cidade_id uuid, cidade_nome text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_norm text;
  v_bare text;
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

  -- 2) Ignora preposições (do/de/da/dos/das/d)
  IF v_id IS NULL AND v_norm IS NOT NULL THEN
    v_bare := btrim(regexp_replace(' ' || v_norm || ' ', ' (do|de|da|dos|das|d) ', ' ', 'g'));
    v_bare := regexp_replace(v_bare, '\s+', ' ', 'g');
    SELECT c.id, c.nome INTO v_id, v_nome
    FROM public.cidades c
    WHERE regexp_replace(btrim(regexp_replace(' ' || public.normalize_city_name(c.nome) || ' ', ' (do|de|da|dos|das|d) ', ' ', 'g')), '\s+', ' ', 'g') = v_bare
    LIMIT 1;
  END IF;

  -- 3) Similaridade (erros de digitação)
  IF v_id IS NULL AND v_norm IS NOT NULL AND length(v_norm) >= 5 THEN
    SELECT c.id, c.nome INTO v_id, v_nome
    FROM public.cidades c
    WHERE extensions.similarity(public.normalize_city_name(c.nome), v_norm) >= 0.55
    ORDER BY extensions.similarity(public.normalize_city_name(c.nome), v_norm) DESC
    LIMIT 1;
  END IF;

  IF v_id IS NULL AND p_cidade_id IS NOT NULL THEN
    SELECT c.id, c.nome INTO v_id, v_nome
    FROM public.cidades c WHERE c.id = p_cidade_id LIMIT 1;
  END IF;

  RETURN QUERY SELECT COALESCE(v_id, p_cidade_id), COALESCE(v_nome, btrim(p_nome));
END;
$function$;
