-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.has_full_leads_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IN (
    '64312bfb-abda-42f8-9112-f12dc16fbde9'::uuid, -- Andrea Jesus
    'd5d8b872-99d0-42af-b630-da5f8c7021cc'::uuid  -- Mônica Cristina Bicalho Spagnuolo
  )
$$;

DROP POLICY IF EXISTS eleitores_captados_select ON public.eleitores_captados;

CREATE POLICY eleitores_captados_select ON public.eleitores_captados
FOR SELECT
USING (
  is_admin()
  OR public.has_full_leads_access()
  OR captado_por_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM equipe_membros em
    WHERE em.coordenador_user_id = auth.uid()
      AND em.user_id = eleitores_captados.captado_por_user_id
  )
  OR EXISTS (
    SELECT 1 FROM liderancas l
    WHERE l.id = eleitores_captados.lideranca_id
      AND (
        l.coordenador_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM coordenador_cidades cc
          WHERE cc.user_id = auth.uid()
            AND (cc.cidade_id = l.cidade_base_id OR cc.cidade_id = ANY (l.cidades_representadas))
        )
      )
  )
);

DROP POLICY IF EXISTS contatos_coordenacao_select ON public.contatos_coordenacao;

CREATE POLICY contatos_coordenacao_select ON public.contatos_coordenacao
FOR SELECT
USING (is_admin() OR public.has_full_leads_access());
