import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SocialProfile = {
  id: string;
  nome: string;
  username: string;
  plataforma: string;
  url_perfil: string | null;
  foto_url: string | null;
  categoria: string | null;
  score: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  latest_metrics?: SocialMetric | null;
};

export type SocialMetric = {
  id: string;
  profile_id: string;
  seguidores: number;
  total_posts: number;
  engajamento: number;
  crescimento: number;
  data_coleta: string;
};

export type SocialEngager = {
  id: string;
  profile_id: string;
  username: string;
  total_comentarios: number;
  frequencia_interacao: string | null;
  ultima_interacao: string | null;
};

export type ApiCredential = {
  id: string;
  plataforma: string;
  access_token: string;
  refresh_token: string | null;
  expiracao_token: string | null;
  status: string;
};

export function useSocialProfiles() {
  return useQuery({
    queryKey: ["social-profiles"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("social_discovery_profiles" as any)
        .select("*")
        .eq("ativo", true)
        .order("score", { ascending: false });
      if (error) throw error;

      // Fetch latest metric for each profile
      const profilesWithMetrics = await Promise.all(
        (profiles as any[]).map(async (p: any) => {
          const { data: metrics } = await supabase
            .from("social_metrics" as any)
            .select("*")
            .eq("profile_id", p.id)
            .order("data_coleta", { ascending: false })
            .limit(1);
          return {
            ...p,
            latest_metrics: metrics && metrics.length > 0 ? metrics[0] : null,
          } as SocialProfile;
        })
      );

      return profilesWithMetrics;
    },
  });
}

export function useSocialProfileDetail(profileId: string | null) {
  return useQuery({
    queryKey: ["social-profile-detail", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("social_discovery_profiles" as any)
        .select("*")
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return data as unknown as SocialProfile;
    },
    enabled: !!profileId,
  });
}

export function useSocialMetricsHistory(profileId: string | null) {
  return useQuery({
    queryKey: ["social-metrics-history", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("social_metrics" as any)
        .select("*")
        .eq("profile_id", profileId)
        .order("data_coleta", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SocialMetric[];
    },
    enabled: !!profileId,
  });
}

export function useSocialEngagers(profileId: string | null) {
  return useQuery({
    queryKey: ["social-engagers", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("social_engagers" as any)
        .select("*")
        .eq("profile_id", profileId)
        .order("total_comentarios", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SocialEngager[];
    },
    enabled: !!profileId,
  });
}

export function useAddSocialProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: {
      nome: string;
      username: string;
      plataforma: string;
      url_perfil?: string;
      foto_url?: string;
      categoria?: string;
    }) => {
      const { data, error } = await supabase
        .from("social_discovery_profiles" as any)
        .insert(profile)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-profiles"] }),
  });
}

export function useDeleteSocialProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_discovery_profiles" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-profiles"] }),
  });
}

export function useCollectSocialData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileIds?: string[]) => {
      const { data, error } = await supabase.functions.invoke("collect-social-data", {
        body: profileIds ? { profile_ids: profileIds } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-profiles"] });
      qc.invalidateQueries({ queryKey: ["social-metrics-history"] });
    },
  });
}

export function useApiCredentials() {
  return useQuery({
    queryKey: ["api-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_api_credentials" as any)
        .select("*")
        .order("plataforma");
      if (error) throw error;
      return (data || []) as unknown as ApiCredential[];
    },
  });
}

export function useUpsertApiCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cred: {
      plataforma: string;
      access_token: string;
      refresh_token?: string;
      expiracao_token?: string;
      status?: string;
    }) => {
      const { data: existing } = await supabase
        .from("system_api_credentials" as any)
        .select("id")
        .eq("plataforma", cred.plataforma)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_api_credentials" as any)
          .update(cred)
          .eq("plataforma", cred.plataforma);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_api_credentials" as any)
          .insert(cred);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-credentials"] }),
  });
}

export function useDeleteApiCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plataforma: string) => {
      const { error } = await supabase
        .from("system_api_credentials" as any)
        .delete()
        .eq("plataforma", plataforma);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-credentials"] }),
  });
}

export function useManualMetricInsert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (metric: {
      profile_id: string;
      seguidores: number;
      total_posts: number;
      engajamento: number;
    }) => {
      // Get previous metric for growth calc
      const { data: prev } = await supabase
        .from("social_metrics" as any)
        .select("seguidores")
        .eq("profile_id", metric.profile_id)
        .order("data_coleta", { ascending: false })
        .limit(1);

      let crescimento = 0;
      if ((prev as any)?.[0]?.seguidores && metric.seguidores > 0) {
        crescimento = ((metric.seguidores - (prev as any)[0].seguidores) / (prev as any)[0].seguidores) * 100;
      }

      const { error } = await supabase
        .from("social_metrics" as any)
        .insert({
          profile_id: metric.profile_id,
          seguidores: metric.seguidores,
          total_posts: metric.total_posts,
          engajamento: metric.engajamento,
          crescimento: Math.round(crescimento * 10) / 10,
        });
      if (error) throw error;

      // Update score
      const score =
        (metric.seguidores > 0 ? Math.log10(metric.seguidores) * 40 : 0) +
        metric.engajamento * 30 +
        Math.max(0, crescimento) * 30;

      await supabase
        .from("social_discovery_profiles" as any)
        .update({ score: Math.round(score * 10) / 10 })
        .eq("id", metric.profile_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-profiles"] });
      qc.invalidateQueries({ queryKey: ["social-metrics-history"] });
    },
  });
}

export const PLATAFORMAS = [
  { key: "instagram", label: "Instagram", icon: "📸", color: "#E1306C" },
  { key: "facebook", label: "Facebook", icon: "📘", color: "#1877F2" },
  { key: "youtube", label: "YouTube", icon: "▶️", color: "#FF0000" },
  { key: "twitter", label: "X (Twitter)", icon: "🐦", color: "#1DA1F2" },
  { key: "tiktok", label: "TikTok", icon: "🎵", color: "#000000" },
] as const;
