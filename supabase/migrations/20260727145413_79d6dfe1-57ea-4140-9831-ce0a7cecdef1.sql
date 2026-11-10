-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_cabos()
RETURNS TABLE(cabo_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cabo_phones AS (
    SELECT id, nome, public.normalize_phone(telefone) AS ph FROM public.cabos_eleitorais WHERE public.normalize_phone(telefone) IS NOT NULL
    UNION
    SELECT id, nome, public.normalize_phone(whatsapp) AS ph FROM public.cabos_eleitorais WHERE public.normalize_phone(whatsapp) IS NOT NULL
  ),
  cabo_by_user AS (
    -- Cabos vinculados a algum usuário do sistema por telefone
    SELECT DISTINCT cp.id AS cabo_id, cp.nome, em.user_id
    FROM cabo_phones cp
    JOIN public.equipe_membros em ON public.normalize_phone(em.telefone) = cp.ph
    WHERE length(cp.ph) >= 10
  ),
  totals_by_user AS (
    SELECT cbu.cabo_id, cbu.nome, COUNT(DISTINCT e.id)::bigint AS total
    FROM cabo_by_user cbu
    JOIN public.eleitores_captados e ON e.captado_por_user_id = cbu.user_id
    GROUP BY cbu.cabo_id, cbu.nome
  ),
  cabo_by_name AS (
    SELECT c.id AS cabo_id, c.nome, public.normalize_person_name(c.nome) AS nn
    FROM public.cabos_eleitorais c
  ),
  totals_by_name AS (
    SELECT cbn.cabo_id, cbn.nome, COUNT(DISTINCT e.id)::bigint AS total
    FROM cabo_by_name cbn
    JOIN public.profiles p ON public.normalize_person_name(p.nome) = cbn.nn
    JOIN public.eleitores_captados e ON e.captado_por_user_id = p.user_id
    GROUP BY cbn.cabo_id, cbn.nome
  )
  SELECT cabo_id, nome, MAX(total) AS total
  FROM (
    SELECT * FROM totals_by_user
    UNION ALL
    SELECT * FROM totals_by_name
  ) x
  GROUP BY cabo_id, nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_cabos() TO authenticated;
