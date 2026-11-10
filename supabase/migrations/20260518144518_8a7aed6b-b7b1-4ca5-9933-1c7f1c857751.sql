-- Exportação sem dados: somente estrutura e lógica.
DROP TRIGGER IF EXISTS trg_profiles_set_token ON public.profiles;

CREATE TRIGGER trg_profiles_set_token
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profile_token();
