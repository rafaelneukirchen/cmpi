-- Exportação sem dados: somente estrutura e lógica.
DROP TRIGGER IF EXISTS trg_audit_material_requests ON public.material_requests;

CREATE TRIGGER trg_audit_material_requests AFTER INSERT OR UPDATE OR DELETE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_planejamento_logistico ON public.planejamento_logistico;

CREATE TRIGGER trg_audit_planejamento_logistico AFTER INSERT OR UPDATE OR DELETE ON public.planejamento_logistico FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_public_map_links ON public.public_map_links;

CREATE TRIGGER trg_audit_public_map_links AFTER INSERT OR UPDATE OR DELETE ON public.public_map_links FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_lead_contact_status ON public.lead_contact_status;

CREATE TRIGGER trg_audit_lead_contact_status AFTER INSERT OR UPDATE OR DELETE ON public.lead_contact_status FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_acoes_midias ON public.acoes_midias;

CREATE TRIGGER trg_audit_acoes_midias AFTER INSERT OR UPDATE OR DELETE ON public.acoes_midias FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_social_discovery_profiles ON public.social_discovery_profiles;

CREATE TRIGGER trg_audit_social_discovery_profiles AFTER INSERT OR UPDATE OR DELETE ON public.social_discovery_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_whatsapp_instances ON public.whatsapp_instances;

CREATE TRIGGER trg_audit_whatsapp_instances AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
