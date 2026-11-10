-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.cabos_eleitorais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lider_id uuid NOT NULL REFERENCES public.liderancas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  whatsapp text,
  bairro text,
  cidade_base_id uuid REFERENCES public.cidades(id) ON DELETE SET NULL,
  votos_estimados integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cabos_eleitorais_lider ON public.cabos_eleitorais(lider_id);

CREATE INDEX idx_cabos_eleitorais_cidade ON public.cabos_eleitorais(cidade_base_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabos_eleitorais TO authenticated;

GRANT ALL ON public.cabos_eleitorais TO service_role;

ALTER TABLE public.cabos_eleitorais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabos_admin_all" ON public.cabos_eleitorais
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "cabos_select_by_cidade" ON public.cabos_eleitorais
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (cidade_base_id IS NOT NULL AND public.user_can_access_cidade(cidade_base_id))
    OR EXISTS (
      SELECT 1 FROM public.liderancas l
      WHERE l.id = cabos_eleitorais.lider_id
        AND (l.cidade_base_id IS NULL OR public.user_can_access_cidade(l.cidade_base_id))
    )
  );

CREATE POLICY "cabos_insert_by_cidade" ON public.cabos_eleitorais
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR (
      public.can_write() AND EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = cabos_eleitorais.lider_id
          AND (l.cidade_base_id IS NULL OR public.user_can_access_cidade(l.cidade_base_id))
      )
    )
  );

CREATE POLICY "cabos_update_by_cidade" ON public.cabos_eleitorais
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR (
      public.can_write() AND EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = cabos_eleitorais.lider_id
          AND (l.cidade_base_id IS NULL OR public.user_can_access_cidade(l.cidade_base_id))
      )
    )
  )
  WITH CHECK (
    public.is_admin() OR (
      public.can_write() AND EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = cabos_eleitorais.lider_id
          AND (l.cidade_base_id IS NULL OR public.user_can_access_cidade(l.cidade_base_id))
      )
    )
  );

CREATE POLICY "cabos_delete_by_cidade" ON public.cabos_eleitorais
  FOR DELETE TO authenticated
  USING (
    public.is_admin() OR (
      public.can_write() AND EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = cabos_eleitorais.lider_id
          AND (l.cidade_base_id IS NULL OR public.user_can_access_cidade(l.cidade_base_id))
      )
    )
  );

CREATE TRIGGER trg_cabos_updated_at
BEFORE UPDATE ON public.cabos_eleitorais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cabos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.cabos_eleitorais
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE OR REPLACE FUNCTION public.check_cabo_phone_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
  v_wa text;
BEGIN
  v_tel := public.normalize_phone(NEW.telefone);
  v_wa := public.normalize_phone(NEW.whatsapp);

  IF v_tel IS NOT NULL AND length(v_tel) >= 10 THEN
    IF EXISTS (
      SELECT 1 FROM public.cabos_eleitorais
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (public.normalize_phone(telefone) = v_tel OR public.normalize_phone(whatsapp) = v_tel)
    ) OR EXISTS (
      SELECT 1 FROM public.liderancas
      WHERE public.normalize_phone(telefone) = v_tel OR public.normalize_phone(whatsapp) = v_tel
    ) OR EXISTS (
      SELECT 1 FROM public.eleitores_captados
      WHERE public.normalize_phone(telefone) = v_tel
    ) THEN
      RAISE EXCEPTION 'Telefone % já cadastrado no sistema.', NEW.telefone USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_wa IS NOT NULL AND length(v_wa) >= 10 AND v_wa <> COALESCE(v_tel,'') THEN
    IF EXISTS (
      SELECT 1 FROM public.cabos_eleitorais
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (public.normalize_phone(telefone) = v_wa OR public.normalize_phone(whatsapp) = v_wa)
    ) OR EXISTS (
      SELECT 1 FROM public.liderancas
      WHERE public.normalize_phone(telefone) = v_wa OR public.normalize_phone(whatsapp) = v_wa
    ) OR EXISTS (
      SELECT 1 FROM public.eleitores_captados
      WHERE public.normalize_phone(telefone) = v_wa
    ) THEN
      RAISE EXCEPTION 'WhatsApp % já cadastrado no sistema.', NEW.whatsapp USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cabos_phone_unique
BEFORE INSERT OR UPDATE ON public.cabos_eleitorais
FOR EACH ROW EXECUTE FUNCTION public.check_cabo_phone_unique();

CREATE OR REPLACE FUNCTION public.get_coordenadores_regionais()
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  cor text,
  total_cidades bigint,
  total_lideres bigint,
  total_cabos bigint,
  total_votos_estimados bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ur.user_id,
    COALESCE(p.nome, 'Coordenador') AS nome,
    p.email,
    p.cor,
    (SELECT COUNT(*) FROM public.coordenador_cidades cc WHERE cc.user_id = ur.user_id) AS total_cidades,
    (SELECT COUNT(*) FROM public.liderancas l WHERE l.coordenador_user_id = ur.user_id) AS total_lideres,
    (SELECT COUNT(*) FROM public.cabos_eleitorais ce
       JOIN public.liderancas l ON l.id = ce.lider_id
       WHERE l.coordenador_user_id = ur.user_id) AS total_cabos,
    (SELECT COALESCE(SUM(l.votos_estimados),0)
       FROM public.liderancas l WHERE l.coordenador_user_id = ur.user_id)
    + (SELECT COALESCE(SUM(ce.votos_estimados),0)
       FROM public.cabos_eleitorais ce
       JOIN public.liderancas l ON l.id = ce.lider_id
       WHERE l.coordenador_user_id = ur.user_id) AS total_votos_estimados
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'coordenador_regional'
  ORDER BY nome;
$$;
