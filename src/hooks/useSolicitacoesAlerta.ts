import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/**
 * Alerta em tempo real de novas solicitações de material.
 * Visível apenas para administradores.
 */
export function useSolicitacoesAlerta() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const { data: permissions = [] } = useUserPermissions();
  const isAdmin = userRole === "admin" || permissions.includes("log_solicitacoes_gestao");

  const { data: pendentes = 0 } = useQuery({
    queryKey: ["material-requests-pendentes"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("material_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["Pedido", "Pendente"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase
      .channel("material-requests-alerta")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "material_requests" },
        (payload) => {
          const r: any = payload.new;
          toast.success(`Novo pedido #${r?.numero_pedido ?? ""}`, {
            description: `${r?.coordenador_nome || "Coordenação"} solicitou ${r?.quantidade_solicitada ?? ""} x ${
              r?.material_nome || "material"
            } para ${r?.cidade_destino || "-"}`,
            duration: 10000,
          });
          queryClient.invalidateQueries({ queryKey: ["material-requests"] });
          queryClient.invalidateQueries({ queryKey: ["material-requests-pendentes"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "material_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["material-requests"] });
          queryClient.invalidateQueries({ queryKey: ["material-requests-pendentes"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, queryClient]);

  return { pendentes, isAdmin };
}
