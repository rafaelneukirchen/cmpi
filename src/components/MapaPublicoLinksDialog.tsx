import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Trash2, Plus, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Link {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export default function MapaPublicoLinksDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["public_map_links"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_map_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Link[];
    },
  });

  const baseUrl = `${window.location.origin}/mapa-publico`;

  const handleCreate = async () => {
    setCreating(true);
    const payload: any = {
      label: label.trim() || null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      created_by: session?.user?.id ?? null,
    };
    const { error } = await supabase.from("public_map_links").insert(payload);
    setCreating(false);
    if (error) {
      toast.error("Erro ao criar link: " + error.message);
      return;
    }
    toast.success("Link público criado");
    setLabel("");
    setExpiresAt("");
    qc.invalidateQueries({ queryKey: ["public_map_links"] });
  };

  const toggleActive = async (l: Link) => {
    const { error } = await supabase
      .from("public_map_links")
      .update({ active: !l.active })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["public_map_links"] });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este link? Quem tem o endereço perderá o acesso.")) return;
    const { error } = await supabase.from("public_map_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Link removido");
    qc.invalidateQueries({ queryKey: ["public_map_links"] });
  };

  const copy = (token: string) => {
    const url = `${baseUrl}/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Links públicos do mapa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-md p-4 bg-muted/30 space-y-3">
            <h3 className="font-semibold text-sm">Criar novo link</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Rótulo (opcional)</Label>
                <Input
                  placeholder="Ex: Apresentação investidor"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Expira em (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} size="sm">
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Gerar link
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Links existentes</h3>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum link criado ainda.</p>
            ) : (
              links.map((l) => {
                const expired = l.expires_at && new Date(l.expires_at) < new Date();
                const url = `${baseUrl}/${l.token}`;
                return (
                  <div key={l.id} className="border rounded-md p-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{l.label || "Sem rótulo"}</div>
                        <div className="text-xs text-muted-foreground truncate">{url}</div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {expired ? (
                            <Badge variant="destructive">Expirado</Badge>
                          ) : l.active ? (
                            <Badge variant="default">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Desativado</Badge>
                          )}
                          {l.expires_at && (
                            <Badge variant="outline" className="text-xs">
                              até {new Date(l.expires_at).toLocaleString("pt-BR")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch checked={l.active} onCheckedChange={() => toggleActive(l)} />
                        <Button variant="ghost" size="icon" onClick={() => copy(l.token)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <a href={url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(l.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
