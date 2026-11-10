-- Exportação sem dados: somente estrutura e lógica.
CREATE INDEX IF NOT EXISTS idx_eleitores_captados_captado_por_user_id
  ON public.eleitores_captados (captado_por_user_id);

CREATE INDEX IF NOT EXISTS idx_liderancas_coordenador_user_id
  ON public.liderancas (coordenador_user_id);

CREATE INDEX IF NOT EXISTS idx_cabos_eleitorais_coordenador_user_id
  ON public.cabos_eleitorais (coordenador_user_id);

CREATE INDEX IF NOT EXISTS idx_cabos_eleitorais_telefone_norm
  ON public.cabos_eleitorais ((public.normalize_phone(telefone)));

CREATE INDEX IF NOT EXISTS idx_cabos_eleitorais_whatsapp_norm
  ON public.cabos_eleitorais ((public.normalize_phone(whatsapp)));

CREATE INDEX IF NOT EXISTS idx_cabos_eleitorais_nome_norm
  ON public.cabos_eleitorais ((public.normalize_person_name(nome)));

CREATE INDEX IF NOT EXISTS idx_liderancas_nome_norm
  ON public.liderancas ((public.normalize_person_name(nome)));

CREATE INDEX IF NOT EXISTS idx_equipe_membros_telefone_norm
  ON public.equipe_membros ((public.normalize_phone(telefone)));

CREATE INDEX IF NOT EXISTS idx_equipe_membros_nome_norm
  ON public.equipe_membros ((public.normalize_person_name(nome)));

CREATE INDEX IF NOT EXISTS idx_profiles_nome_norm
  ON public.profiles ((public.normalize_person_name(nome)));

CREATE OR REPLACE FUNCTION public.get_captados_hierarchy()
RETURNS TABLE(
  captado_id uuid,
  captador_user_id uuid,
  tipo_captador text,
  lider_id uuid,
  coord_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS MATERIALIZED (
    SELECT
      e.id AS captado_id,
      e.captado_por_user_id AS captador_user_id,
      e.tipo_captador,
      e.lideranca_id,
      p.lideranca_vinculada_id,
      public.normalize_person_name(p.nome) AS profile_nome_norm,
      em.coordenador_user_id AS equipe_coord_id,
      public.normalize_person_name(em.nome) AS equipe_nome_norm,
      public.normalize_phone(em.telefone) AS equipe_tel_norm,
      ur.user_id AS self_coord_id
    FROM public.eleitores_captados e
    LEFT JOIN public.profiles p ON p.user_id = e.captado_por_user_id
    LEFT JOIN public.equipe_membros em ON em.user_id = e.captado_por_user_id
    LEFT JOIN public.user_roles ur
      ON ur.user_id = e.captado_por_user_id
     AND ur.role IN ('coordenador_estadual', 'coordenador_regional')
  ),
  cabos_por_telefone AS MATERIALIZED (
    SELECT DISTINCT ON (phone_norm)
      phone_norm,
      id,
      lider_id,
      coordenador_user_id
    FROM (
      SELECT
        public.normalize_phone(telefone) AS phone_norm,
        id,
        lider_id,
        coordenador_user_id,
        updated_at,
        created_at
      FROM public.cabos_eleitorais
      WHERE public.normalize_phone(telefone) IS NOT NULL
      UNION ALL
      SELECT
        public.normalize_phone(whatsapp) AS phone_norm,
        id,
        lider_id,
        coordenador_user_id,
        updated_at,
        created_at
      FROM public.cabos_eleitorais
      WHERE public.normalize_phone(whatsapp) IS NOT NULL
    ) c
    WHERE length(phone_norm) >= 10
    ORDER BY phone_norm, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
  ),
  cabos_por_nome AS MATERIALIZED (
    SELECT DISTINCT ON (nome_norm)
      public.normalize_person_name(nome) AS nome_norm,
      id,
      lider_id,
      coordenador_user_id
    FROM public.cabos_eleitorais
    WHERE public.normalize_person_name(nome) IS NOT NULL
    ORDER BY public.normalize_person_name(nome), updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
  ),
  lider_por_nome AS MATERIALIZED (
    SELECT DISTINCT ON (nome_norm)
      public.normalize_person_name(nome) AS nome_norm,
      id,
      coordenador_user_id
    FROM public.liderancas
    WHERE public.normalize_person_name(nome) IS NOT NULL
    ORDER BY public.normalize_person_name(nome), updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
  )
  SELECT
    b.captado_id,
    b.captador_user_id,
    b.tipo_captador,
    COALESCE(
      b.lideranca_id,
      b.lideranca_vinculada_id,
      cabo_tel.lider_id,
      cabo_profile.lider_id,
      cabo_equipe.lider_id,
      lider_nome_profile.id,
      lider_nome_equipe.id
    ) AS lider_id,
    COALESCE(
      lider_direto.coordenador_user_id,
      lider_vinculado.coordenador_user_id,
      lider_cabo_tel.coordenador_user_id,
      lider_cabo_profile.coordenador_user_id,
      lider_cabo_equipe.coordenador_user_id,
      lider_nome_profile.coordenador_user_id,
      lider_nome_equipe.coordenador_user_id,
      b.self_coord_id,
      b.equipe_coord_id,
      cabo_tel.coordenador_user_id,
      cabo_profile.coordenador_user_id,
      cabo_equipe.coordenador_user_id
    ) AS coord_id
  FROM base b
  LEFT JOIN public.liderancas lider_direto ON lider_direto.id = b.lideranca_id
  LEFT JOIN public.liderancas lider_vinculado ON lider_vinculado.id = b.lideranca_vinculada_id
  LEFT JOIN cabos_por_telefone cabo_tel ON cabo_tel.phone_norm = b.equipe_tel_norm
  LEFT JOIN public.liderancas lider_cabo_tel ON lider_cabo_tel.id = cabo_tel.lider_id
  LEFT JOIN cabos_por_nome cabo_profile
    ON cabo_tel.id IS NULL
   AND cabo_profile.nome_norm = b.profile_nome_norm
  LEFT JOIN public.liderancas lider_cabo_profile ON lider_cabo_profile.id = cabo_profile.lider_id
  LEFT JOIN cabos_por_nome cabo_equipe
    ON cabo_tel.id IS NULL
   AND cabo_profile.id IS NULL
   AND cabo_equipe.nome_norm = b.equipe_nome_norm
  LEFT JOIN public.liderancas lider_cabo_equipe ON lider_cabo_equipe.id = cabo_equipe.lider_id
  LEFT JOIN lider_por_nome lider_nome_profile
    ON b.lideranca_id IS NULL
   AND b.lideranca_vinculada_id IS NULL
   AND cabo_tel.id IS NULL
   AND cabo_profile.id IS NULL
   AND cabo_equipe.id IS NULL
   AND lider_nome_profile.nome_norm = b.profile_nome_norm
  LEFT JOIN lider_por_nome lider_nome_equipe
    ON b.lideranca_id IS NULL
   AND b.lideranca_vinculada_id IS NULL
   AND cabo_tel.id IS NULL
   AND cabo_profile.id IS NULL
   AND cabo_equipe.id IS NULL
   AND lider_nome_profile.id IS NULL
   AND lider_nome_equipe.nome_norm = b.equipe_nome_norm;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_hierarchy() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_liderancas()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    l.id AS user_id,
    l.nome,
    COUNT(h.captado_id)::bigint AS total
  FROM public.liderancas l
  LEFT JOIN public.get_captados_hierarchy() h ON h.lider_id = l.id
  GROUP BY l.id, l.nome
  HAVING COUNT(h.captado_id) > 0
  ORDER BY total DESC, l.nome ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_liderancas() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH coord_ids AS MATERIALIZED (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('coordenador_estadual', 'coordenador_regional')
    UNION
    SELECT DISTINCT em.coordenador_user_id
    FROM public.equipe_membros em
    WHERE em.coordenador_user_id IS NOT NULL
    UNION
    SELECT DISTINCT l.coordenador_user_id
    FROM public.liderancas l
    WHERE l.coordenador_user_id IS NOT NULL
    UNION
    SELECT DISTINCT c.coordenador_user_id
    FROM public.cabos_eleitorais c
    WHERE c.coordenador_user_id IS NOT NULL
  )
  SELECT
    c.user_id,
    COALESCE(p.nome, 'Coordenação') AS nome,
    COUNT(h.captado_id)::bigint AS total
  FROM coord_ids c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  LEFT JOIN public.get_captados_hierarchy() h ON h.coord_id = c.user_id
  GROUP BY c.user_id, p.nome
  HAVING COUNT(h.captado_id) > 0
  ORDER BY total DESC, nome ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_coordenacao() TO authenticated, service_role;
