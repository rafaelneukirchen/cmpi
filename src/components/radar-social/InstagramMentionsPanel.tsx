import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AtSign,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type MentionPost = {
  id: string;
  caption: string;
  permalink: string;
  mediaUrl: string;
  thumbnailUrl: string;
  mediaType: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
};

type Mentioner = {
  username: string;
  count: number;
  lastMention: string;
  posts: MentionPost[];
};

type MentionsPayload = {
  success: boolean;
  myUsername?: string;
  windowDays?: number;
  totalMentions?: number;
  uniqueMentioners?: number;
  topMentioners?: Mentioner[];
  recentMentions?: Array<MentionPost & { username: string }>;
  error?: string;
  permissionMissing?: boolean;
  requiredScope?: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

function avatarFor(username: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    username
  )}&background=random&size=64`;
}

export function InstagramMentionsPanel() {
  const [data, setData] = useState<MentionsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("instagram-mentions");
      if (error) throw error;
      setData(res as MentionsPayload);
      if (!(res as MentionsPayload).success && !(res as MentionsPayload).permissionMissing) {
        toast.error((res as MentionsPayload).error || "Erro ao buscar menções");
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao buscar menções");
      setData({ success: false, error: err?.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMentioner =
    selected && data?.topMentioners?.find((m) => m.username === selected);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AtSign className="h-5 w-5 text-primary" /> Menções ao seu @
          </h2>
          <p className="text-xs text-muted-foreground">
            Posts em que outras contas marcaram{" "}
            <span className="font-mono">@{data?.myUsername || "você"}</span> nos últimos{" "}
            {data?.windowDays || 30} dias.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Permission missing */}
      {data && !data.success && data.permissionMissing && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Permissão necessária</AlertTitle>
          <AlertDescription>
            Para listar quem mencionou seu @, o token do Instagram precisa do escopo{" "}
            <code className="font-mono text-xs">
              {data.requiredScope || "instagram_manage_comments"}
            </code>
            . Reconecte o Instagram em <strong>Configurações → Integrações</strong> autorizando
            essa permissão.
          </AlertDescription>
        </Alert>
      )}

      {/* Generic error */}
      {data && !data.success && !data.permissionMissing && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar as menções</AlertTitle>
          <AlertDescription>{data.error || "Erro desconhecido."}</AlertDescription>
        </Alert>
      )}

      {/* Stats + lists */}
      {data?.success && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{data.totalMentions ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Menções recebidas</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{data.uniqueMentioners ?? 0}</div>
                  <div className="text-xs text-muted-foreground">@ únicos mencionando</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <AtSign className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-sm font-semibold truncate">
                    @{data.myUsername || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Janela: {data.windowDays ?? 30} dias
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {(data.topMentioners?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma menção encontrada nos últimos {data.windowDays ?? 30} dias.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              {/* Lista de mencionantes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top mencionantes</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[460px]">
                    <ul className="divide-y">
                      {data.topMentioners!.map((m) => (
                        <li key={m.username}>
                          <button
                            type="button"
                            onClick={() => setSelected(m.username)}
                            className={`w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-3 ${
                              selected === m.username ? "bg-muted" : ""
                            }`}
                          >
                            <img
                              src={avatarFor(m.username)}
                              alt={m.username}
                              className="h-9 w-9 rounded-full shrink-0"
                              loading="lazy"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">@{m.username}</div>
                              <div className="text-[11px] text-muted-foreground">
                                Última: {formatDate(m.lastMention)}
                              </div>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {m.count}
                            </Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Detalhe do @ selecionado */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {selectedMentioner ? (
                      <>
                        <img
                          src={avatarFor(selectedMentioner.username)}
                          alt={selectedMentioner.username}
                          className="h-6 w-6 rounded-full"
                        />
                        Posts de @{selectedMentioner.username} marcando você
                      </>
                    ) : (
                      "Selecione um @ à esquerda"
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedMentioner ? (
                    <div className="text-sm text-muted-foreground py-12 text-center">
                      Clique em um @ na lista para ver as publicações em que ele(a) mencionou
                      você.
                    </div>
                  ) : (
                    <ScrollArea className="h-[420px] pr-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedMentioner.posts.map((p) => {
                          const img = p.thumbnailUrl || p.mediaUrl;
                          return (
                            <a
                              key={p.id}
                              href={p.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                            >
                              {img ? (
                                <img
                                  src={img}
                                  alt={p.caption}
                                  className="w-full aspect-square object-cover bg-muted"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                  Sem prévia
                                </div>
                              )}
                              <div className="p-2.5">
                                <p className="text-xs line-clamp-2 mb-2 min-h-[2rem]">
                                  {p.caption || (
                                    <span className="text-muted-foreground italic">
                                      (sem legenda)
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-0.5">
                                      <Heart className="h-3 w-3" /> {p.likeCount}
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                      <MessageCircle className="h-3 w-3" /> {p.commentsCount}
                                    </span>
                                  </div>
                                  <span className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ExternalLink className="h-3 w-3" /> Abrir
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  {formatDate(p.timestamp)}
                                </div>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
