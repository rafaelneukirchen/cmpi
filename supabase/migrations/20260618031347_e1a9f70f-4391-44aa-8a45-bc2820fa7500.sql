-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_row jsonb;
  v_lid uuid;
  v_capt uuid;
BEGIN
  IF v_user IS NOT NULL THEN
    SELECT nome INTO v_name FROM public.profiles WHERE user_id = v_user LIMIT 1;
  END IF;

  -- Fallback: when no auth user (public capture / webhook), try to infer
  -- the actor from row context so the audit never shows just "Sistema".
  IF v_name IS NULL OR v_user IS NULL THEN
    v_row := COALESCE(to_jsonb(NEW), to_jsonb(OLD));
    IF v_row ? 'captado_por_user_id' AND (v_row->>'captado_por_user_id') IS NOT NULL THEN
      BEGIN
        v_capt := (v_row->>'captado_por_user_id')::uuid;
        SELECT nome INTO v_name FROM public.profiles WHERE user_id = v_capt LIMIT 1;
        IF v_name IS NOT NULL THEN
          v_name := v_name || ' (captação pública)';
          IF v_user IS NULL THEN v_user := v_capt; END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF v_name IS NULL AND v_row ? 'lideranca_id' AND (v_row->>'lideranca_id') IS NOT NULL THEN
      BEGIN
        v_lid := (v_row->>'lideranca_id')::uuid;
        SELECT nome INTO v_name FROM public.liderancas WHERE id = v_lid LIMIT 1;
        IF v_name IS NOT NULL THEN
          v_name := v_name || ' (liderança - link público)';
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
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
      RETURN NEW;
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
  RETURN COALESCE(NEW, OLD);
END;
$function$;
