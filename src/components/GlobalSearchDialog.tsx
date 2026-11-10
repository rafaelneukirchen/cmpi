import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, User, Users, Contact, PhoneCall, UserCog, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  id: string;
  nome: string;
  telefone?: string | null;
  detalhe?: string | null;
  origem: string;
  rota?: string;
  icon: React.ComponentType<{ className?: string }>;
  cor: string;
};

const normalize = (s: string) => s.replace(/\D/g, "");

export function GlobalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  const doSearch = async () => {
    const term = q.trim();
    if (term.length < 2) return;
    setLoading(true);
    setSearched(true);
    const tel = normalize(term);
    const isPhone = tel.length >= 4;
    const nameLike = `%${term}%`;
    const phoneLike = isPhone ? `%${tel}%` : null;

    try {
      const [lid, capt, leads, contatos, profs, rkCap, rkCoord] = await Promise.all([
        supabase
          .from("liderancas")
          .select("id, nome, telefone, whatsapp, bairro, cidades(nome)")
          .or(
            isPhone
              ? `nome.ilike.${nameLike},telefone.ilike.${phoneLike},whatsapp.ilike.${phoneLike}`
              : `nome.ilike.${nameLike}`
          )
          .limit(20),
        supabase
          .from("eleitores_captados")
          .select("id, nome_completo, telefone, bairro, cidade_nome")
          .or(
            isPhone
              ? `nome_completo.ilike.${nameLike},telefone.ilike.${phoneLike}`
              : `nome_completo.ilike.${nameLike}`
          )
          .limit(20),
        supabase
          .from("leads_centralizados")
          .select("id, nome_completo, telefone, cidade_nome, captador_nome")
          .or(
            isPhone
              ? `nome_completo.ilike.${nameLike},telefone.ilike.${phoneLike}`
              : `nome_completo.ilike.${nameLike}`
          )
          .limit(20),
        supabase
          .from("contatos_coordenacao")
          .select("id, nome, telefone, cargo, cidade_nome")
          .or(
            isPhone
              ? `nome.ilike.${nameLike},telefone.ilike.${phoneLike}`
              : `nome.ilike.${nameLike}`
          )
          .limit(20),
        supabase
          .from("profiles")
          .select("user_id, nome, email")
          .or(`nome.ilike.${nameLike},email.ilike.${nameLike}`)
          .limit(20),
        supabase.rpc("get_captados_ranking" as never),
        supabase.rpc("get_captados_ranking_coordenacao" as never),
      ]) as any;

      const r: Result[] = [];

      (lid.data || []).forEach((x: any) =>
        r.push({
          id: x.id,
          nome: x.nome,
          telefone: x.telefone || x.whatsapp,
          detalhe: [x.cidades?.nome, x.bairro].filter(Boolean).join(" • "),
          origem: "Liderança",
          rota: "/liderancas",
          icon: Users,
          cor: "bg-blue-500/10 text-blue-600 border-blue-500/30",
        })
      );
      (capt.data || []).forEach((x: any) =>
        r.push({
          id: x.id,
          nome: x.nome_completo,
          telefone: x.telefone,
          detalhe: [x.cidade_nome, x.bairro].filter(Boolean).join(" • "),
          origem: "Apoiador Captado",
          rota: "/eleitores-captados",
          icon: Contact,
          cor: "bg-green-500/10 text-green-600 border-green-500/30",
        })
      );
      (leads.data || []).forEach((x: any) =>
        r.push({
          id: x.id,
          nome: x.nome_completo,
          telefone: x.telefone,
          detalhe: [x.cidade_nome, x.captador_nome && `por ${x.captador_nome}`].filter(Boolean).join(" • "),
          origem: "Lead Centralizado",
          rota: "/leads-centralizados",
          icon: MapPin,
          cor: "bg-purple-500/10 text-purple-600 border-purple-500/30",
        })
      );
      (contatos.data || []).forEach((x: any) =>
        r.push({
          id: x.id,
          nome: x.nome,
          telefone: x.telefone,
          detalhe: [x.cargo, x.cidade_nome].filter(Boolean).join(" • "),
          origem: "Contato Coordenação",
          rota: "/contato-coordenacao",
          icon: PhoneCall,
          cor: "bg-amber-500/10 text-amber-600 border-amber-500/30",
        })
      );
      (profs.data || []).forEach((x: any) =>
        r.push({
          id: x.user_id,
          nome: x.nome || x.email,
          telefone: null,
          detalhe: x.email,
          origem: "Usuário do Sistema",
          rota: "/usuarios",
          icon: UserCog,
          cor: "bg-rose-500/10 text-rose-600 border-rose-500/30",
        })
      );

      // Coordenadores e captadores via RPC (driblando RLS de profiles)
      const termLower = term.toLowerCase();
      const seenUserIds = new Set(r.filter(x => x.origem === "Usuário do Sistema").map(x => x.id));

      ((rkCoord?.data as any[]) || [])
        .filter((x: any) => x.nome?.toLowerCase().includes(termLower) && !seenUserIds.has(x.user_id))
        .slice(0, 20)
        .forEach((x: any) => {
          seenUserIds.add(x.user_id);
          r.push({
            id: x.user_id,
            nome: x.nome,
            telefone: null,
            detalhe: `Coordenador • ${x.total || 0} captação(ões) na equipe`,
            origem: "Coordenador",
            rota: "/usuarios",
            icon: UserCog,
            cor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
          });
        });

      ((rkCap?.data as any[]) || [])
        .filter((x: any) => x.nome?.toLowerCase().includes(termLower) && !seenUserIds.has(x.user_id))
        .slice(0, 20)
        .forEach((x: any) => {
          seenUserIds.add(x.user_id);
          r.push({
            id: x.user_id,
            nome: x.nome,
            telefone: null,
            detalhe: `Captador • ${x.total || 0} apoiador(es) cadastrado(s)`,
            origem: "Captador",
            rota: "/eleitores-captados",
            icon: User,
            cor: "bg-teal-500/10 text-teal-600 border-teal-500/30",
          });
        });

      setResults(r);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, Result[]> = {};
    results.forEach((r) => {
      g[r.origem] = g[r.origem] || [];
      g[r.origem].push(r);
    });
    return g;
  }, [results]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQ(""); setResults([]); setSearched(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Busca Geral</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" /> Busca Geral
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Buscar por nome ou telefone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
          />
          <Button onClick={doSearch} disabled={loading || q.trim().length < 2}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Procura em Lideranças, Apoiadores Captados, Leads, Contatos da Coordenação, Coordenadores, Captadores e Usuários.
        </p>

        <div className="flex-1 overflow-y-auto space-y-4 mt-2">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && searched && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum cadastro encontrado para "{q}".
            </p>
          )}
          {!loading && Object.entries(grouped).map(([origem, items]) => (
            <div key={origem}>
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                {origem} ({items.length})
              </div>
              <div className="space-y-2">
                {items.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={`${origem}-${r.id}`}
                      type="button"
                      onClick={() => { if (r.rota) { navigate(r.rota); setOpen(false); } }}
                      className="w-full text-left flex items-start gap-3 rounded-md border p-3 hover:bg-accent transition-colors"
                    >
                      <div className={`rounded-md border p-2 ${r.cor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{r.nome}</span>
                          <Badge variant="outline" className="text-[10px]">{r.origem}</Badge>
                        </div>
                        {r.telefone && (
                          <div className="text-xs text-muted-foreground">📞 {r.telefone}</div>
                        )}
                        {r.detalhe && (
                          <div className="text-xs text-muted-foreground truncate">{r.detalhe}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
