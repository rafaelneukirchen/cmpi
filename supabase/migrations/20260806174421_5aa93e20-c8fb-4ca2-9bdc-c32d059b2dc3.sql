-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_scope_for(_user_id uuid)
RETURNS TABLE(captado_id uuid, captador_user_id uuid, tipo_captador text, lider_id uuid, coord_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT CASE WHEN public.is_admin() THEN COALESCE(_user_id, auth.uid()) ELSE auth.uid() END AS u
  ),
  sub_coords AS (
    SELECT DISTINCT em.user_id
    FROM public.equipe_membros em, me
    WHERE em.coordenador_user_id = me.u AND em.user_id IS NOT NULL
  ),
  coord_set AS (
    SELECT u AS id FROM me WHERE u IS NOT NULL
    UNION
    SELECT user_id FROM sub_coords
  ),
  meus_lideres AS (
    SELECT l.id FROM public.liderancas l, me WHERE l.coordenador_user_id = me.u
    UNION
    SELECT p.lideranca_vinculada_id FROM public.profiles p, me
      WHERE p.user_id = me.u AND p.lideranca_vinculada_id IS NOT NULL
    UNION
    SELECT l.id FROM public.liderancas l
      WHERE l.coordenador_user_id IN (SELECT user_id FROM sub_coords)
  )
  SELECT h.captado_id, h.captador_user_id, h.tipo_captador, h.lider_id, h.coord_id
  FROM public.get_captados_hierarchy() h, me
  WHERE (public.has_role(me.u, 'admin'::app_role))
     OR (h.captador_user_id IS NOT NULL AND h.captador_user_id IN (SELECT id FROM coord_set))
     OR (h.coord_id IS NOT NULL AND h.coord_id IN (SELECT id FROM coord_set))
     OR (h.lider_id IS NOT NULL AND h.lider_id IN (SELECT id FROM meus_lideres));
$$;

CREATE OR REPLACE FUNCTION public.get_captados_scope()
RETURNS TABLE(captado_id uuid, captador_user_id uuid, tipo_captador text, lider_id uuid, coord_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_captados_scope_for(auth.uid());
$$;
