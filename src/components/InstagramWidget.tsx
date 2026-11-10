import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Instagram, Users, Grid3X3, ExternalLink } from "lucide-react";

interface IgProfile {
  user_id: string;
  username: string;
  name: string;
  profile_picture_url: string;
  followers_count: number;
  media_count: number;
}

interface IgPost {
  id: string;
  caption: string | null;
  media_type: string;
  media_url: string;
  permalink: string;
  timestamp: string;
}

export function InstagramWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["instagram-profile"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-profile");
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data as { profile: IgProfile; posts: IgPost[] };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <Instagram className="h-4 w-4" />
            <span>Erro ao carregar Instagram: {(error as Error).message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { profile, posts } = data;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-500" />
          Instagram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile Info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border-2 border-pink-500/30">
            <AvatarImage src={profile.profile_picture_url} alt={profile.name} />
            <AvatarFallback className="bg-pink-500/10 text-pink-600 font-bold">
              {profile.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{profile.name}</p>
            <a
              href={`https://instagram.com/${profile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-pink-500 transition-colors flex items-center gap-1"
            >
              @{profile.username}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <Users className="h-3 w-3" />
              <span className="text-[10px] uppercase tracking-wider font-medium">Seguidores</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {profile.followers_count?.toLocaleString("pt-BR") || "0"}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <Grid3X3 className="h-3 w-3" />
              <span className="text-[10px] uppercase tracking-wider font-medium">Posts</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {profile.media_count?.toLocaleString("pt-BR") || "0"}
            </p>
          </div>
        </div>

        {/* Posts Grid */}
        {posts.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.slice(0, 6).map((post) => (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square rounded-lg overflow-hidden group bg-muted"
              >
                {post.media_type === "VIDEO" ? (
                  <video
                    src={post.media_url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={post.media_url}
                    alt={post.caption?.substring(0, 50) || "Post"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
