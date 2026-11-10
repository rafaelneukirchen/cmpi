import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings, useUpdateAppSetting } from "@/hooks/useAppSettings";
import { useUserPermissions, hasModuleAccess, ROUTE_MODULE_MAP } from "@/hooks/useUserPermissions";
import { Loader2, ShieldAlert, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { LocationConsentDialog } from "@/components/LocationConsentDialog";
import { GpsStatusGuard } from "@/components/GpsStatusGuard";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { SolicitacoesAlertBell } from "@/components/logistics/SolicitacoesAlertBell";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const { user, loading, userRole } = useAuth();
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateAppSetting();
  const { data: permissions = [], isLoading: permLoading } = useUserPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Ativa o rastreamento em background quando o usuário tem consentimento ativo
  useLocationTracking();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  // Force password change if flagged by admin reset
  const [mustChangePw, setMustChangePw] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) { setMustChangePw(null); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active) setMustChangePw(!!(data as any)?.must_change_password);
    })();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (mustChangePw && location.pathname !== "/reset-password") {
      navigate("/reset-password?forced=1", { replace: true });
    }
  }, [mustChangePw, location.pathname, navigate]);

  // Redirect to first permitted route if current route is denied
  useEffect(() => {
    if (permLoading || !user || userRole === "admin") return;
    const currentModule = ROUTE_MODULE_MAP[location.pathname];
    if (!currentModule) return;
    if (hasModuleAccess(userRole, permissions, currentModule)) return;

    // Find first permitted route
    const firstAllowed = Object.entries(ROUTE_MODULE_MAP).find(
      ([, mod]) => hasModuleAccess(userRole, permissions, mod)
    );
    if (firstAllowed) {
      navigate(firstAllowed[0], { replace: true });
    }
  }, [permLoading, user, userRole, permissions, location.pathname, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const maintenance = settings?.maintenance_mode === "true";
  if (maintenance && userRole && userRole !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <Wrench className="h-16 w-16 text-primary" />
        <h1 className="text-2xl font-bold">Sistema em atualização</h1>
        <p className="text-muted-foreground max-w-md">
          O sistema está passando por atualização. Tente novamente em alguns instantes.
        </p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sair</Button>
      </div>
    );
  }

  const moduleKey = ROUTE_MODULE_MAP[location.pathname];
  const hasAccess = !moduleKey || permLoading || hasModuleAccess(userRole, permissions, moduleKey);

  const bgUrl = settings?.app_background;
  const embed = new URLSearchParams(location.search).get("embed") === "1";

  if (embed) {
    return (
      <div className="min-h-screen w-full bg-background">
        <main className="p-4 md:p-6">
          {hasAccess ? (
            <Outlet />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <ShieldAlert className="h-16 w-16 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          {bgUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10 pointer-events-none"
              style={{ backgroundImage: `url(${bgUrl})` }}
            />
          )}
          <header className="h-14 flex items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 shrink-0 relative z-10">
            <SidebarTrigger />
            <div className="flex-1" />
            {userRole === "admin" && (
              <label className="flex items-center gap-2 text-xs" title="Bloqueia o acesso de todos, exceto administradores">
                <Wrench className={`h-4 w-4 ${maintenance ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="hidden sm:inline">{maintenance ? "Em atualização" : "Modo atualização"}</span>
                <Switch
                  checked={maintenance}
                  disabled={updateSetting.isPending}
                  onCheckedChange={(v) => updateSetting.mutate({ key: "maintenance_mode", value: v ? "true" : "false" })}
                />
              </label>
            )}
            <GlobalSearchDialog />
            <SolicitacoesAlertBell />
            {settings?.app_logo && (
              <img src={settings.app_logo} alt="Logo" className="h-12 md:h-14 object-contain" />
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Estado:</span>
              <span className="text-xs font-semibold">São Paulo - SP</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 relative z-10">
            {hasAccess ? (
              <Outlet />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <ShieldAlert className="h-16 w-16 text-muted-foreground/50" />
                <h2 className="text-xl font-semibold">Acesso Restrito</h2>
                <p className="text-muted-foreground max-w-md">
                  Você não tem permissão para acessar este módulo. Entre em contato com o administrador para solicitar acesso.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
      <LocationConsentDialog />
      <GpsStatusGuard />
    </SidebarProvider>
  );
}
