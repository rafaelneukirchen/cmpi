-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS eleitores_captados_select ON public.eleitores_captados;

CREATE POLICY eleitores_captados_select
ON public.eleitores_captados
FOR SELECT
TO authenticated
USING (
  is_admin()
  OR captado_por_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.equipe_membros em
    WHERE em.coordenador_user_id = auth.uid()
      AND em.user_id = eleitores_captados.captado_por_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.liderancas l
    WHERE l.id = eleitores_captados.lideranca_id
      AND (
        l.coordenador_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.coordenador_cidades cc
          WHERE cc.user_id = auth.uid()
            AND (cc.cidade_id = l.cidade_base_id OR cc.cidade_id = ANY (l.cidades_representadas))
        )
      )
  )
);
