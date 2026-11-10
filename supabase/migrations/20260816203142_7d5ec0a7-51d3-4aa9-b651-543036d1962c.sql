-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.normalize_bairro(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      lower(translate(btrim(coalesce(p,'')), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')),
                    '[^a-z0-9 ]', ' ', 'g'),
                  '\s+', ' ', 'g'),
                '^(jd|jrd|jrdm|jardin|jardins)( |$)', 'jardim ', 'g'),
              '^(vl|vla)( |$)', 'vila ', 'g'),
            '^(pq|prq)( |$)', 'parque ', 'g'),
          '^(cj|cjto|cjt)( |$)', 'conjunto ', 'g'),
        '^(res|resid)( |$)', 'residencial ', 'g'),
      '^(st|sta)( |$)', 'santa ', 'g'),
    '\s+$', '', 'g'),
  '');
$$;

CREATE OR REPLACE FUNCTION public.get_bairros_por_cidade()
RETURNS TABLE(cidade_id uuid, cidade_nome text, regiao_administrativa text, bairros text[], total_bairros integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH bairros_coletados AS (
    SELECT l.cidade_base_id AS cidade_id, unnest(l.bairros) AS bairro
    FROM public.liderancas l
    WHERE l.bairros IS NOT NULL AND array_length(l.bairros, 1) > 0 AND l.cidade_base_id IS NOT NULL
    UNION ALL
    SELECT cb.cidade_base_id, unnest(cb.bairros)
    FROM public.cabos_eleitorais cb
    WHERE cb.bairros IS NOT NULL AND array_length(cb.bairros, 1) > 0 AND cb.cidade_base_id IS NOT NULL
    UNION ALL
    SELECT e.cidade_id, e.bairro
    FROM public.eleitores_captados e
    WHERE e.bairro IS NOT NULL AND btrim(e.bairro) <> '' AND e.cidade_id IS NOT NULL
  ),
  limpos AS (
    SELECT bc.cidade_id,
           public.normalize_bairro(bc.bairro) AS bairro_norm,
           btrim(bc.bairro) AS bairro_orig
    FROM bairros_coletados bc
    WHERE public.normalize_bairro(bc.bairro) IS NOT NULL
      AND length(public.normalize_bairro(bc.bairro)) > 2
      AND public.normalize_bairro(bc.bairro) !~ '^(zona (leste|oeste|norte|sul|central)|nao sei|nao informado|n a|na|sem bairro|outro|outros|teste|cidade|centro sp)$'
  ),
  contagem AS (
    SELECT cidade_id, bairro_norm, bairro_orig, count(*) AS qt
    FROM limpos
    GROUP BY cidade_id, bairro_norm, bairro_orig
  ),
  rotulos AS (
    SELECT DISTINCT ON (cidade_id, bairro_norm)
      cidade_id, bairro_norm, bairro_orig AS bairro_label
    FROM contagem
    ORDER BY cidade_id, bairro_norm, qt DESC, length(bairro_orig) DESC, bairro_orig
  ),
  bairros_ordenados AS (
    SELECT r.cidade_id, array_agg(r.bairro_label ORDER BY r.bairro_norm) AS bairros
    FROM rotulos r
    GROUP BY r.cidade_id
  )
  SELECT c.id, c.nome, c.regiao_administrativa,
         coalesce(bo.bairros, ARRAY[]::text[]),
         coalesce(array_length(bo.bairros, 1), 0)
  FROM public.cidades c
  JOIN bairros_ordenados bo ON bo.cidade_id = c.id
  ORDER BY c.nome;
$function$;
