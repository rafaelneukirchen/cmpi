-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS liderancas_select ON public.liderancas;

CREATE POLICY liderancas_select ON public.liderancas FOR SELECT USING (
  is_admin() OR has_full_leads_access() OR (coordenador_user_id = auth.uid()) OR ((cidade_base_id IS NOT NULL) AND user_can_access_cidade(cidade_base_id))
);

DROP POLICY IF EXISTS equipe_membros_select ON public.equipe_membros;

CREATE POLICY equipe_membros_select ON public.equipe_membros FOR SELECT USING (
  is_admin() OR has_full_leads_access() OR (coordenador_user_id = auth.uid()) OR (user_id = auth.uid())
);

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT USING (
  (user_id = auth.uid()) OR is_admin() OR has_full_leads_access()
);

DROP POLICY IF EXISTS cabos_select_by_cidade ON public.cabos_eleitorais;

CREATE POLICY cabos_select_by_cidade ON public.cabos_eleitorais FOR SELECT USING (
  is_admin() OR has_full_leads_access() OR ((cidade_base_id IS NOT NULL) AND user_can_access_cidade(cidade_base_id)) OR (EXISTS (
    SELECT 1 FROM liderancas l WHERE l.id = cabos_eleitorais.lider_id AND (l.cidade_base_id IS NULL OR user_can_access_cidade(l.cidade_base_id))
  ))
);
