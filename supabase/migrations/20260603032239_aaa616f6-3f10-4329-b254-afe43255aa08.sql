-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;

CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_record_id text;
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_details jsonb;
  v_key text;
BEGIN
  IF v_user IS NOT NULL THEN
    SELECT nome INTO v_name FROM public.profiles WHERE user_id = v_user LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new := to_jsonb(NEW);
    v_record_id := v_new->>'id';
    v_details := jsonb_build_object('new', v_new);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := v_new->>'id';
    -- só campos que mudaram
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF (v_new->v_key) IS DISTINCT FROM (v_old->v_key)
         AND v_key NOT IN ('updated_at','created_at') THEN
        v_changed := v_changed || jsonb_build_object(
          v_key,
          jsonb_build_object('de', v_old->v_key, 'para', v_new->v_key)
        );
      END IF;
    END LOOP;
    IF v_changed = '{}'::jsonb THEN
      RETURN NEW; -- nada relevante mudou
    END IF;
    v_details := jsonb_build_object('alteracoes', v_changed);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_record_id := v_old->>'id';
    v_details := jsonb_build_object('removido', v_old);
  END IF;

  INSERT INTO public.audit_log (user_id, executor_name, action, table_name, record_id, details)
  VALUES (v_user, COALESCE(v_name, 'Sistema'), v_action, TG_TABLE_NAME, v_record_id, v_details);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- nunca falhar a operação original por erro de auditoria
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'liderancas','cidades','dobradinhas','projecao_votos','estrutura_campanha',
    'agenda_campanha','visitas_campanha','eleitores_captados','equipe_membros',
    'profiles','user_roles','user_permissions','coordenador_cidades',
    'contatos_coordenacao','financial_transactions','payment_schedule','reimbursements',
    'materials','movements','logistics_profiles','app_settings',
    'social_competitors','integration_secrets','licencas','campanhas',
    'system_api_credentials','user_location_consent','whatsapp_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn()',
      t, t
    );
  END LOOP;
END $$;
