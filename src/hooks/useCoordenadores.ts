import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Coordenador {
  user_id: string;
  nome: string;
  email: string;
  cidades_ids: string[];
  cor: string | null;
}

export function useCoordenadores() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["coordenadores", session?.user?.id],
    enabled: !loading && !!session,
    queryFn: async () => {
      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome, email, cor");

      // Get coordinator roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["coordenador_estadual", "coordenador_regional"]);

      // Get coordinator cities
      const { data: coordCidades } = await supabase.from("coordenador_cidades").select("user_id, cidade_id");

      const coordUserIds = new Set((roles || []).map(r => r.user_id));

      const coordenadores: Coordenador[] = (profiles || [])
        .filter(p => coordUserIds.has(p.user_id))
        .map(p => ({
          user_id: p.user_id,
          nome: p.nome,
          email: p.email,
          cor: (p as any).cor || null,
          cidades_ids: (coordCidades || []).filter(cc => cc.user_id === p.user_id).map(cc => cc.cidade_id),
        }));

      return coordenadores;
    },
  });
}
