import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns the city IDs assigned to the current user via coordenador_cidades.
 * For admin users, returns null (meaning no filter — see all).
 * For other users, returns the array of city IDs they're assigned to.
 */
export function useUserCidades() {
  const { user, userRole, loading, roleLoading } = useAuth();

  return useQuery({
    queryKey: ["user-cidades", user?.id, userRole],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      if (userRole === "admin") return null; // null = no filter

      const { data, error } = await supabase
        .from("coordenador_cidades")
        .select("cidade_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return (data || []).map(d => d.cidade_id);
    },
    enabled: !loading && !roleLoading && !!user?.id,
  });
}
