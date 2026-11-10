import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { exportStyledExcel } from "@/lib/exportExcelStyled";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Search, Phone, MapPin, MessageCircle, UserPlus, Loader2, Download, Pencil, Trash2, MessageSquare, RotateCcw, Save, CheckCircle2, XCircle, HelpCircle, Copy, StickyNote } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EditLeadDialog, EditLeadType } from "@/components/EditLeadDialog";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// Shared status (sent / confirm / obs) is in useLeadStatus hook.
import { useLeadStatus, phoneKey, loadObsMap, type ConfirmStatus } from "@/hooks/useLeadStatus";
import { LeadStatusControls, LeadObsBadge } from "@/components/LeadStatusControls";
import ImportLeadsDialog from "@/components/ImportLeadsDialog";
import { useCanSendWhatsApp, useUserPermissions } from "@/hooks/useUserPermissions";

type LeadType = "lideranca" | "eleitor" | "logistica";

interface Lead {
  id: string;
  tipo: LeadType;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  cidade: string | null;
  bairro: string | null;
  origem: string | null;
  origem_id: string | null;
  captador_user_id?: string | null;
  captador_nome?: string | null;
  lider_nome?: string | null;
  coordenador_nome?: string | null;
  dobrada_parceiro?: string | null;
  data: string;
  raw?: any;
}

const DEFAULT_WA_TEMPLATE = `Olá, tudo bem? 😊

Somos da equipe do Felipe Carmona e {dobrada}.

Seu contato foi encaminhado pela nossa liderança {captador}, que registrou em nosso sistema seu apoio ao nosso projeto.

Gostaríamos apenas de confirmar: podemos contar com seu apoio nessa caminhada?

1️⃣ SIM
2️⃣ NÃO`;

const WA_TEMPLATE_STORAGE_KEY = "leads:wa-template:v3";

function buildWhatsAppMessage(template: string, leadNome: string, captadorNome: string | null, dobradaNome: string | null): string {
  const lider = captadorNome && captadorNome.trim() ? captadorNome.trim() : "nossa equipe";
  const primeiroNome = (leadNome || "").trim().split(/\s+/)[0] || "";
  const dobrada = dobradaNome && dobradaNome.trim() ? dobradaNome.trim() : "";
  let out = template
    .replace(/\{captador\}/gi, lider)
    .replace(/\{nome\}/gi, leadNome || "")
    .replace(/\{primeiro_nome\}/gi, primeiroNome)
    .replace(/\{dobrada\}/gi, dobrada);

  // Garante separador " e " entre o nome principal/captador e a dobrada quando ambos existem.
  // Isso corrige templates antigos ou personalizados que ficaram sem "e" entre os nomes.
  if (dobrada) {
    const escDobrada = dobrada.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escLider = lider.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Entre "Felipe Carmona" e a dobrada
    out = out.replace(
      new RegExp(`(Felipe Carmona)\\s*(?!\\s*(?:e|/)\\s+)(${escDobrada})`, "gi"),
      "$1 e $2"
    );
    // Entre o captador genérico e a dobrada
    out = out.replace(
      new RegExp(`(${escLider})\\s*(?!\\s*(?:e|/)\\s+)(${escDobrada})`, "gi"),
      "$1 e $2"
    );
  }

  // Limpa artefatos quando não há dobrada: remove " e " ou " / " sobrando após substituição vazia.
  if (!dobrada) {
    out = out.replace(/ (?:e|\/)\s*(?=[\s,.\n])/g, "").replace(/ (?:e|\/)\s*$/gm, "");
  }
  return out;
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function waLink(phone: string | null, msg: string): string | null {
  const digits = onlyDigits(phone);
  if (!digits || digits.length < 10) return null;
  // Brazilian numbers: prefix 55 if missing
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  // Usamos api.whatsapp.com/send (canal oficial), que é mais tolerante
  // que wa.me quando o WhatsApp Web já está aberto em outra aba.
  return `https://api.whatsapp.com/send?phone=${full}&text=${encodeURIComponent(msg)}`;
}

function waPhoneOnly(phone: string | null): string | null {
  const digits = onlyDigits(phone);
  if (!digits || digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://api.whatsapp.com/send?phone=${full}`;
}

function tipoLabel(t: LeadType): string {
  return t === "lideranca" ? "Liderança" : t === "eleitor" ? "Apoiador Captado" : "Equipe/Logística";
}

function tipoBadge(t: LeadType): "default" | "secondary" | "outline" {
  return t === "lideranca" ? "default" : t === "eleitor" ? "secondary" : "outline";
}

export default function Leads() {
  const { userRole, isSuperAdmin, session } = useAuth();
  const { data: permissions = [] } = useUserPermissions();
  // Acesso total (ver e filtrar todos os leads) = admin ou permissão explícita "leads_full"
  const hasFullAccess = permissions.includes("leads_full");
  const isAdmin = userRole === "admin" || hasFullAccess;
  const canSendWhatsApp = useCanSendWhatsApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ tipo: EditLeadType; id: string; nome: string; telefone: string } | null>(null);
  const [revertTarget, setRevertTarget] = useState<{ id: string; nome: string } | null>(null);
  const [reverting, setReverting] = useState(false);

  // Responsável padrão da captação própria: Felipe Carmona
  const CAPTACAO_PROPRIA_USER_ID = "abd8f3d1-51be-4060-b04f-2c2dd6288bb1";

  const handleReverterCaptacao = async () => {
    const uid = session?.user?.id;
    if (!revertTarget || !uid) return;
    setReverting(true);
    try {
      const { error } = await supabase
        .from("eleitores_captados" as never)
        .update({ captado_por_user_id: CAPTACAO_PROPRIA_USER_ID, tipo_captador: "usuario", lideranca_id: null } as never)
        .eq("id", revertTarget.id);
      if (error) throw error;
      toast.success(`${revertTarget.nome} agora está sob captação de Felipe Carmona`);
      setRevertTarget(null);
      qc.invalidateQueries({ queryKey: ["leads-eleitores"] });
      qc.invalidateQueries({ queryKey: ["eleitores-captados"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reverter captação");
    } finally {
      setReverting(false);
    }
  };

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"todos" | LeadType>("todos");
  const [cidadeFilter, setCidadeFilter] = useState("todas");
  const [captadorFilter, setCaptadorFilter] = useState("todos");
  const [coordenadorFilter, setCoordenadorFilter] = useState("todos");
  const [liderancaFilter, setLiderancaFilter] = useState("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [waTemplate, setWaTemplate] = useState<string>(DEFAULT_WA_TEMPLATE);
  const [waDraft, setWaDraft] = useState<string>(DEFAULT_WA_TEMPLATE);
  const [waOpen, setWaOpen] = useState(false);
  const { sentMap, confirmMap, obsMap, obsAuthorMap, statusAuthorMap, obsAuthorNames, markSent } = useLeadStatus();
  const [obsAutorFilter, setObsAutorFilter] = useState("todos");
  const [statusAutorFilter, setStatusAutorFilter] = useState("todos");
  const [confirmFilter, setConfirmFilter] = useState<"todos" | "confirmado" | "nao_confirmado" | "sem_resposta">("todos");
  const [contatoFilter, setContatoFilter] = useState<"todos" | "contatados" | "nao_contatados">("todos");
  const [confirmResend, setConfirmResend] = useState<{ url: string; phone: string; nome: string; data: string } | null>(null);

  function handleWaClick(e: React.MouseEvent, url: string, phone: string | null, nome: string) {
    const key = phoneKey(phone);
    const already = key ? sentMap[key] : null;
    if (already) {
      e.preventDefault();
      setConfirmResend({ url, phone: key, nome, data: already });
      return;
    }
    markSent(phone || "");
  }



  useEffect(() => {
    try {
      const stored = localStorage.getItem(WA_TEMPLATE_STORAGE_KEY);
      if (stored && stored.trim()) {
        setWaTemplate(stored);
        setWaDraft(stored);
      }
    } catch {}
  }, []);

  function saveTemplate() {
    try {
      localStorage.setItem(WA_TEMPLATE_STORAGE_KEY, waDraft);
      setWaTemplate(waDraft);
      toast.success("Mensagem salva");
    } catch {
      toast.error("Não foi possível salvar a mensagem");
    }
  }
  function resetTemplate() {
    setWaDraft(DEFAULT_WA_TEMPLATE);
    setWaTemplate(DEFAULT_WA_TEMPLATE);
    try { localStorage.removeItem(WA_TEMPLATE_STORAGE_KEY); } catch {}
    toast.success("Mensagem padrão restaurada");
  }

  const { data: liderancas = [], isLoading: ll } = useQuery({
    queryKey: ["leads-liderancas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("liderancas").select("id,nome,telefone,whatsapp,cidade_base_id,created_at,bairros,coordenador_user_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: dobradinhas = [] } = useQuery({
    queryKey: ["leads-dobradinhas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dobradinhas").select("lideranca_id,cabo_id,coordenador_user_id,candidato_parceiro");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: cabos = [] } = useQuery({
    queryKey: ["leads-cabos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cabos_eleitorais").select("id,lider_id,coordenador_user_id");
      if (error) throw error;
      return data || [];
    },
  });

  // Fonte única de verdade de atribuição (mesma usada em Apoiadores Captados)
  const { data: hierarquia = [] } = useQuery({
    queryKey: ["leads-captados-hierarchy"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_captados_hierarchy" as never);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: eleitores = [], isLoading: le } = useQuery({
    queryKey: ["leads-eleitores"],
    queryFn: async () => {
      // Pagina para contornar o limite padrão de 1000 linhas do PostgREST
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      // loop até buscar tudo
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("eleitores_captados" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const chunk = (data || []) as any[];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const { data: equipe = [], isLoading: lp } = useQuery({
    queryKey: ["leads-logistics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_profiles")
        .select("id,full_name,phone,city,neighborhood,management,status,created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: cidades = [] } = useQuery({
    queryKey: ["leads-cidades-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cidades").select("id,nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profilesAll = [] } = useQuery({
    queryKey: ["leads-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,nome,lideranca_vinculada_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: equipeMembros = [] } = useQuery({
    queryKey: ["leads-equipe-membros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipe_membros")
        .select("user_id,coordenador_user_id,nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: coordRoles = [] } = useQuery({
    queryKey: ["leads-coord-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["coordenador_estadual", "coordenador_regional"]);
      if (error) throw error;
      return data || [];
    },
  });

  const cidadeMap = useMemo(() => new Map(cidades.map((c: any) => [c.id, c.nome])), [cidades]);
  const liderancaMap = useMemo(() => new Map(liderancas.map((l: any) => [l.id, l.nome])), [liderancas]);
  // Fallback name resolution: profiles first, then equipe_membros nome (users without a profile row).
  const profilesMap = useMemo(() => {
    const m = new Map<string, string>();
    equipeMembros.forEach((em: any) => {
      if (em.user_id && em.nome) m.set(em.user_id, em.nome);
    });
    profilesAll.forEach((p: any) => {
      if (p.user_id && p.nome) m.set(p.user_id, p.nome);
    });
    return m;
  }, [profilesAll, equipeMembros]);
  // Map captador user_id -> coordenador_user_id (quando o captador foi cadastrado via link de coordenação)
  const captadorCoordMap = useMemo(
    () => new Map(equipeMembros.map((em: any) => [em.user_id, em.coordenador_user_id])),
    [equipeMembros]
  );

  // Dobrada (candidato_parceiro) associada a cada liderança
  const liderancaDobradaMap = useMemo(() => {
    const m = new Map<string, string>();
    (dobradinhas as any[]).forEach((d) => {
      if (d.lideranca_id && d.candidato_parceiro && !m.has(d.lideranca_id)) {
        m.set(d.lideranca_id, d.candidato_parceiro);
      }
    });
    return m;
  }, [dobradinhas]);

  // Dobrada associada a um coordenador (user_id) diretamente cadastrada
  const coordDobradaMap = useMemo(() => {
    const m = new Map<string, string>();
    (dobradinhas as any[]).forEach((d) => {
      if (d.coordenador_user_id && d.candidato_parceiro && !m.has(d.coordenador_user_id)) {
        m.set(d.coordenador_user_id, d.candidato_parceiro);
      }
    });
    return m;
  }, [dobradinhas]);

  // Dobrada associada a um cabo eleitoral (cabo_id)
  const caboDobradaMap = useMemo(() => {
    const m = new Map<string, string>();
    (dobradinhas as any[]).forEach((d) => {
      if (d.cabo_id && d.candidato_parceiro && !m.has(d.cabo_id)) {
        m.set(d.cabo_id, d.candidato_parceiro);
      }
    });
    return m;
  }, [dobradinhas]);

  // Mapa liderança -> dobrada via cabo eleitoral vinculado a essa liderança
  const liderancaCaboDobradaMap = useMemo(() => {
    const m = new Map<string, string>();
    (cabos as any[]).forEach((c) => {
      if (!c.lider_id) return;
      const parceiro = caboDobradaMap.get(c.id);
      if (parceiro && !m.has(c.lider_id)) m.set(c.lider_id, parceiro);
    });
    return m;
  }, [cabos, caboDobradaMap]);

  // Mapa liderança -> coordenador vinculado (para fallback de dobrada)
  const liderancaCoordMap = useMemo(() => {
    const m = new Map<string, string>();
    (liderancas as any[]).forEach((l) => {
      if (l.coordenador_user_id) m.set(l.id, l.coordenador_user_id);
    });
    return m;
  }, [liderancas]);

  // Mapa usuário -> liderança vinculada (perfil)
  const userLiderancaMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesAll as any[]).forEach((p) => {
      if (p.user_id && p.lideranca_vinculada_id) m.set(p.user_id, p.lideranca_vinculada_id);
    });
    return m;
  }, [profilesAll]);



  // Dobrada associada a cada usuário: via liderança que ele coordena, ou liderança cujo nome bate com o perfil
  const userDobradaMap = useMemo(() => {
    const m = new Map<string, string>();
    const norm = (s: string) => (s || "").toLowerCase().trim();
    const profileNameById = new Map<string, string>();
    profilesMap.forEach((v, k) => profileNameById.set(k, v));
    (liderancas as any[]).forEach((l) => {
      const parceiro = liderancaDobradaMap.get(l.id);
      if (!parceiro) return;
      // Coordenador vinculado à liderança
      if (l.coordenador_user_id && !m.has(l.coordenador_user_id)) {
        m.set(l.coordenador_user_id, parceiro);
      }
      // Usuário com mesmo nome da liderança
      const ln = norm(l.nome);
      if (ln) {
        profileNameById.forEach((pn, uid) => {
          if (!m.has(uid) && norm(pn) === ln) m.set(uid, parceiro);
        });
      }
    });
    return m;
  }, [dobradinhas, liderancas, liderancaDobradaMap, profilesMap]);

  const hierMap = useMemo(() => {
    const m = new Map<string, { lider_id: string | null; coord_id: string | null }>();
    (hierarquia as any[]).forEach((h) => {
      if (h.captado_id) m.set(h.captado_id, { lider_id: h.lider_id ?? null, coord_id: h.coord_id ?? null });
    });
    return m;
  }, [hierarquia]);

  const allCoordIds = useMemo(() => {
    const set = new Set<string>();
    coordRoles.forEach((r: any) => r.user_id && set.add(r.user_id));
    equipeMembros.forEach((em: any) => em.coordenador_user_id && set.add(em.coordenador_user_id));
    return set;
  }, [coordRoles, equipeMembros]);

  const allLeads: Lead[] = useMemo(() => {
    const list: Lead[] = [];

    // Non-admins only see their own captured eleitores (RLS handles the filtering)
    if (isAdmin) {
      liderancas.forEach((l: any) => {
        list.push({
        id: `lid-${l.id}`,
        tipo: "lideranca",
        nome: l.nome,
        telefone: l.telefone,
        whatsapp: l.whatsapp,
        cidade: cidadeMap.get(l.cidade_base_id) || null,
        bairro: (l.bairros && l.bairros.length > 0) ? l.bairros.join(", ") : null,
        origem: "Cadastro de Liderança",
        origem_id: l.id,
        lider_nome: l.nome,
        coordenador_nome: l.coordenador_user_id ? profilesMap.get(l.coordenador_user_id) || null : null,
        data: l.created_at,
      });
    });
    } // end isAdmin liderancas

    eleitores.forEach((e: any) => {
      const captadorNome =
        e.tipo_captador === "usuario" && e.captado_por_user_id
          ? profilesMap.get(e.captado_por_user_id) || null
          : e.lideranca_id
          ? liderancaMap.get(e.lideranca_id) || null
          : null;
      // Atribuição oficial (mesma lógica de Apoiadores Captados), com fallback local
      const hier = hierMap.get(e.id);
      const liderId =
        hier?.lider_id ||
        e.lideranca_id ||
        (e.captado_por_user_id ? userLiderancaMap.get(e.captado_por_user_id) || null : null);
      const liderNome = liderId ? liderancaMap.get(liderId) || null : null;
      const coordUserId =
        hier?.coord_id ||
        (e.tipo_captador === "usuario" && e.captado_por_user_id
          ? captadorCoordMap.get(e.captado_por_user_id) || null
          : null) || (liderId ? liderancaCoordMap.get(liderId) || null : null);
      const coordNome = coordUserId ? profilesMap.get(coordUserId) || null : null;
      const nomeFinal = captadorNome || "Captador removido";
      let origem: string;
      if (e.tipo_captador === "usuario" && e.captado_por_user_id) {
        origem = coordNome && coordNome !== nomeFinal
          ? `Captador: ${nomeFinal} (Coord. ${coordNome})`
          : `Captador: ${nomeFinal}`;
      } else if (e.lideranca_id) {
        origem = `Liderança: ${nomeFinal}`;
      } else {
        origem = "Captação em campo";
      }

      // Fallback em cascata para descobrir a dobrada do responsável pela captação
      let dobradaParceiro: string | null = null;
      if (e.tipo_captador === "usuario" && e.captado_por_user_id) {
        dobradaParceiro =
          userDobradaMap.get(e.captado_por_user_id) ||
          coordDobradaMap.get(e.captado_por_user_id) ||
          (coordUserId ? userDobradaMap.get(coordUserId) || coordDobradaMap.get(coordUserId) : null) ||
          null;
      } else if (e.lideranca_id) {
        const lidCoord = liderancaCoordMap.get(e.lideranca_id);
        dobradaParceiro =
          liderancaDobradaMap.get(e.lideranca_id) ||
          liderancaCaboDobradaMap.get(e.lideranca_id) ||
          (lidCoord ? coordDobradaMap.get(lidCoord) : null) ||
          null;
      }

      list.push({
        id: `ele-${e.id}`,
        tipo: "eleitor",
        nome: e.nome_completo,
        telefone: e.telefone,
        whatsapp: e.telefone,
        cidade: e.cidade_nome || cidadeMap.get(e.cidade_id) || null,
        bairro: e.bairro,
        origem,
        origem_id: e.lideranca_id || e.captado_por_user_id || null,
        captador_user_id: e.captado_por_user_id || null,
        captador_nome: captadorNome,
        lider_nome: liderNome,
        coordenador_nome: coordNome,
        dobrada_parceiro: dobradaParceiro,
        data: e.created_at,
      });
    });

    if (isAdmin) {
      equipe.forEach((p: any) => {
        list.push({
          id: `log-${p.id}`,
          tipo: "logistica",
          nome: p.full_name,
          telefone: p.phone,
          whatsapp: p.phone,
          cidade: p.city,
          bairro: p.neighborhood,
          origem: p.management ? `Coord. ${p.management}` : "Equipe",
          origem_id: p.id,
          data: p.created_at,
        });
      });
    }

    return list.sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [liderancas, eleitores, equipe, cidadeMap, liderancaMap, profilesMap, captadorCoordMap, liderancaDobradaMap, userDobradaMap, coordDobradaMap, liderancaCaboDobradaMap, liderancaCoordMap, hierMap, userLiderancaMap, isAdmin]);

  const cidadesOptions = useMemo(() => {
    const set = new Set<string>();
    allLeads.forEach((l) => l.cidade && set.add(l.cidade));
    return ["todas", ...Array.from(set).sort()];
  }, [allLeads]);

  const captadoresOptions = useMemo(() => {
    const set = new Map<string, string>();
    eleitores.forEach((e: any) => {
      if (e.tipo_captador === "usuario" && e.captado_por_user_id) {
        set.set(e.captado_por_user_id, profilesMap.get(e.captado_por_user_id) || "Usuário");
      }
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [eleitores, profilesMap]);

  const coordenadoresOptions = useMemo(() => {
    const set = new Map<string, string>();
    allCoordIds.forEach((id) => {
      set.set(id, profilesMap.get(id) || "Coordenador");
    });
    // also include any coordinator inferred from captures (defensive)
    eleitores.forEach((e: any) => {
      if (e.tipo_captador === "usuario" && e.captado_por_user_id) {
        const coordId = captadorCoordMap.get(e.captado_por_user_id);
        if (coordId && !set.has(coordId)) set.set(coordId, profilesMap.get(coordId) || "Coordenador");
      }
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allCoordIds, eleitores, profilesMap, captadorCoordMap]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allLeads.filter((l) => {
      if (tipoFilter !== "todos" && l.tipo !== tipoFilter) return false;
      if (cidadeFilter !== "todas" && l.cidade !== cidadeFilter) return false;
      if (captadorFilter !== "todos") {
        if (l.tipo !== "eleitor") return false;
        if (l.captador_user_id !== captadorFilter) return false;
      }
      if (coordenadorFilter !== "todos") {
        if (l.tipo !== "eleitor") return false;
        const cap = l.captador_user_id;
        if (!cap) return false;
        const coord = captadorCoordMap.get(cap) || null;
        // match if captador is in coord's team OR captador IS the coord
        if (coord !== coordenadorFilter && cap !== coordenadorFilter) return false;
      }
      if (liderancaFilter !== "todos") {
        if (l.tipo !== "eleitor") return false;
        // origem_id for eleitor is either lideranca_id or captado_por_user_id — match liderança id
        const eleRaw = eleitores.find((e: any) => `ele-${e.id}` === l.id);
        if (!eleRaw || eleRaw.lideranca_id !== liderancaFilter) return false;
      }
      if (confirmFilter !== "todos") {
        const st = confirmMap[phoneKey(l.telefone)];
        if (confirmFilter === "sem_resposta" && st) return false;
        if (confirmFilter === "confirmado" && st !== "confirmado") return false;
        if (confirmFilter === "nao_confirmado" && st !== "nao_confirmado") return false;
      }
      if (contatoFilter !== "todos") {
        const sent = !!sentMap[phoneKey(l.telefone)];
        if (contatoFilter === "contatados" && !sent) return false;
        if (contatoFilter === "nao_contatados" && sent) return false;
      }
      if (obsAutorFilter !== "todos") {
        const k = phoneKey(l.telefone);
        const temObs = !!obsMap[k];
        const autor = obsAuthorMap[k];
        if (obsAutorFilter === "com_obs") {
          if (!temObs) return false;
        } else if (obsAutorFilter === "sem_obs") {
          if (temObs) return false;
        } else if (autor !== obsAutorFilter || !temObs) {
          return false;
        }
      }
      if (statusAutorFilter !== "todos") {
        const k = phoneKey(l.telefone);
        if (statusAuthorMap[k] !== statusAutorFilter || !confirmMap[k]) return false;
      }
      if (!s) return true;
      return (
        l.nome.toLowerCase().includes(s) ||
        (l.telefone || "").toLowerCase().includes(s) ||
        (l.cidade || "").toLowerCase().includes(s) ||
        (l.bairro || "").toLowerCase().includes(s)
      );
    });
  }, [allLeads, search, tipoFilter, cidadeFilter, captadorFilter, coordenadorFilter, liderancaFilter, eleitores, captadorCoordMap, confirmFilter, confirmMap, contatoFilter, sentMap, obsAutorFilter, obsMap, obsAuthorMap, statusAutorFilter, statusAuthorMap]);

  // Operadores que fizeram anotações (para filtro dos administradores)
  const obsAutoresOptions = useMemo(() => {
    const set = new Map<string, string>();
    Object.entries(obsAuthorMap).forEach(([k, uid]) => {
      if (!obsMap[k] || !uid) return;
      set.set(uid, obsAuthorNames[uid] || profilesMap.get(uid) || "Operador");
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [obsAuthorMap, obsAuthorNames, obsMap, profilesMap]);


  // Operadores que alteraram o status de confirmação (para filtro dos administradores)
  const statusAutoresOptions = useMemo(() => {
    const set = new Map<string, string>();
    Object.entries(statusAuthorMap).forEach(([k, uid]) => {
      if (!confirmMap[k] || !uid) return;
      set.set(uid, obsAuthorNames[uid] || profilesMap.get(uid) || "Operador");
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [statusAuthorMap, confirmMap, obsAuthorNames, profilesMap]);

  const counts = useMemo(
    () => ({
      lideranca: allLeads.filter((l) => l.tipo === "lideranca").length,
      eleitor: allLeads.filter((l) => l.tipo === "eleitor").length,
    }),
    [allLeads]
  );

  const isLoading = ll || le || lp;

  async function handleExport() {
    // Quantidade de apoiadores captados por captador (dentro do filtro atual)
    const qtdPorCaptador = new Map<string, number>();
    filtered.forEach((l) => {
      if (l.tipo !== "eleitor") return;
      const key = (l.captador_nome || l.lider_nome || "Sem captador").trim().toLowerCase();
      qtdPorCaptador.set(key, (qtdPorCaptador.get(key) || 0) + 1);
    });

    const columns = [
      { header: "Tipo", width: 18 },
      { header: "Nome", width: 32 },
      { header: "Telefone", width: 18 },
      { header: "Cidade", width: 22 },
      { header: "Bairro", width: 22 },
      { header: "Captador", width: 26 },
      { header: "Líder", width: 26 },
      { header: "Coordenador", width: 26 },
      { header: "Qtd. Apoiadores do Captador", width: 16 },
      { header: "Data", width: 14 },
      { header: "WhatsApp Enviado", width: 20 },
      { header: "Status Confirmação", width: 20 },
      { header: "Status alterado por", width: 26 },
      { header: "Observação", width: 34 },
      { header: "Anotação feita por", width: 26 },
    ];
    const rows = filtered.map((l) => {
      const k = phoneKey(l.telefone);
      const sentAt = sentMap[k];
      const st = confirmMap[k];
      const obs = obsMap[k] || "";
      const captador = l.captador_nome || (l.tipo === "eleitor" ? "Sem captador" : "");
      const qtdKey = (l.captador_nome || l.lider_nome || "Sem captador").trim().toLowerCase();
      return [
        tipoLabel(l.tipo),
        l.nome,
        l.telefone || "",
        l.cidade || "",
        l.bairro || "",
        captador,
        l.lider_nome || "",
        l.coordenador_nome || "",
        l.tipo === "eleitor" ? String(qtdPorCaptador.get(qtdKey) || 0) : "",
        new Date(l.data).toLocaleDateString("pt-BR"),
        sentAt ? new Date(sentAt).toLocaleString("pt-BR") : "Não enviado",
        st === "confirmado" ? "Confirmado" : st === "nao_confirmado" ? "Não confirmado" : "Sem resposta",
        st ? (obsAuthorNames[statusAuthorMap[k]] || profilesMap.get(statusAuthorMap[k]) || "") : "",
        obs,
        obs ? (obsAuthorNames[obsAuthorMap[k]] || "") : "",
      ];
    });

    await exportStyledExcel(
      `leads-contatos-${new Date().toISOString().slice(0, 10)}.xlsx`,
      "Leads e Contatos",
      columns,
      rows,
      `Relatório de Leads e Contatos — ${new Date().toLocaleDateString("pt-BR")} (${rows.length} registros)`,
    );
  }

  const filteredEleitorIds = useMemo(
    () => filtered.filter((l) => l.tipo === "eleitor").map((l) => l.id.replace(/^ele-/, "")),
    [filtered]
  );
  const allSelected = filteredEleitorIds.length > 0 && filteredEleitorIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredEleitorIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredEleitorIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function bulkDeleteIds(ids: string[]) {
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      // Supabase IN limit: chunk to be safe
      const chunkSize = 200;
      let totalDeleted = 0;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { error } = await supabase.from("eleitores_captados" as never).delete().in("id", chunk);
        if (error) throw error;
        totalDeleted += chunk.length;
      }
      toast.success(`${totalDeleted} apoiador(es) excluído(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["leads-eleitores"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir em lote");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function deleteCaptadorCompletely(userId: string) {
    setDeletingUser(true);
    try {
      // 1) Apaga todos os apoiadores captados por este usuário
      const { error: e1 } = await supabase
        .from("eleitores_captados" as never)
        .delete()
        .eq("captado_por_user_id", userId);
      if (e1) throw e1;

      // 2) Apaga o usuário via edge function (apenas Super Admin no backend)
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw new Error(error.message || "Erro ao excluir usuário");
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário e todos os apoiadores captados foram excluídos");
      setCaptadorFilter("todos");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["leads-eleitores"] });
      qc.invalidateQueries({ queryKey: ["leads-profiles"] });
      qc.invalidateQueries({ queryKey: ["leads-equipe-membros"] });
      qc.invalidateQueries({ queryKey: ["users-management"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir usuário");
    } finally {
      setDeletingUser(false);
    }
  }


  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads & Contatos</h1>
          <p className="text-sm text-muted-foreground">
            Central unificada de todos os contatos do sistema — pronta para WhatsApp e exportação.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportLeadsDialog />
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-2" disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Baixar Leads ({filtered.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox icon={UserPlus} label="Lideranças" value={counts.lideranca} variant="primary" />
        <StatBox icon={MapPin} label="Apoiadores Captados" value={counts.eleitor} variant="accent" />
      </div>

      {canSendWhatsApp && (
      <Card>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setWaOpen((v) => !v)}>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Mensagem pré-programada do WhatsApp
            </span>
            <span className="text-xs font-normal text-muted-foreground">{waOpen ? "Fechar" : "Editar"}</span>
          </CardTitle>
        </CardHeader>
        {waOpen && (
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Use os marcadores <code className="px-1 rounded bg-muted">{"{nome}"}</code>,{" "}
              <code className="px-1 rounded bg-muted">{"{primeiro_nome}"}</code>,{" "}
              <code className="px-1 rounded bg-muted">{"{captador}"}</code> e{" "}
              <code className="px-1 rounded bg-muted">{"{dobrada}"}</code> — eles serão substituídos automaticamente em cada envio (a dobrada é o candidato parceiro vinculado à liderança/coordenador do captador).
            </p>
            <Textarea
              value={waDraft}
              onChange={(e) => setWaDraft(e.target.value)}
              rows={9}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={saveTemplate} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar mensagem
              </Button>
              <Button size="sm" variant="outline" onClick={resetTemplate} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
              </Button>
              {waDraft !== waTemplate && (
                <span className="text-xs text-amber-600">Alterações não salvas</span>
              )}
            </div>
          </CardContent>
        )}
      </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <SearchSelect
              value={tipoFilter}
              onChange={(v) => setTipoFilter((v || "todos") as typeof tipoFilter)}
              placeholder="Tipo"
              searchPlaceholder="Buscar tipo..."
              options={[
                { value: "todos", label: "Todos os tipos" },
                { value: "lideranca", label: "Lideranças" },
                { value: "eleitor", label: "Apoiadores Captados" },
                { value: "logistica", label: "Equipe / Logística" },
              ]}
            />
            <SearchSelect
              value={cidadeFilter}
              onChange={(v) => setCidadeFilter(v || "todas")}
              placeholder="Cidade"
              searchPlaceholder="Buscar cidade..."
              options={cidadesOptions.map((c) => ({ value: c, label: c === "todas" ? "Todas as cidades" : c }))}
            />
            <SearchSelect
              value={coordenadorFilter}
              onChange={(v) => setCoordenadorFilter(v || "todos")}
              placeholder="Coordenador"
              searchPlaceholder="Buscar coordenador..."
              options={[
                { value: "todos", label: "Todos os coordenadores" },
                ...coordenadoresOptions.map(([id, nome]) => ({ value: id, label: nome })),
              ]}
            />
            <SearchSelect
              value={captadorFilter}
              onChange={(v) => setCaptadorFilter(v || "todos")}
              placeholder="Captador"
              searchPlaceholder="Buscar captador..."
              options={[
                { value: "todos", label: "Todos os captadores" },
                ...captadoresOptions.map(([id, nome]) => ({ value: id, label: nome })),
              ]}
            />
            <SearchSelect
              value={liderancaFilter}
              onChange={(v) => setLiderancaFilter(v || "todos")}
              placeholder="Liderança"
              searchPlaceholder="Buscar liderança..."
              options={[
                { value: "todos", label: "Todas as lideranças" },
                ...liderancas
                  .map((l: any) => ({ value: l.id, label: l.nome }))
                  .sort((a, b) => a.label.localeCompare(b.label)),
              ]}
            />
            <SearchSelect
              value={confirmFilter}
              onChange={(v) => setConfirmFilter((v || "todos") as typeof confirmFilter)}
              placeholder="Confirmação"
              searchPlaceholder="Buscar..."
              options={[
                { value: "todos", label: "Todas confirmações" },
                { value: "confirmado", label: "✅ Confirmados" },
                { value: "nao_confirmado", label: "❌ Não confirmados" },
                { value: "sem_resposta", label: "⏳ Sem resposta" },
              ]}
            />
            <SearchSelect
              value={contatoFilter}
              onChange={(v) => setContatoFilter((v || "todos") as typeof contatoFilter)}
              placeholder="Contato"
              searchPlaceholder="Buscar..."
              options={[
                { value: "todos", label: "Todos (contato)" },
                { value: "contatados", label: "💬 Já contatados" },
                { value: "nao_contatados", label: "🕐 Ainda não contatados" },
              ]}
            />
            {isAdmin && (
              <SearchSelect
                value={obsAutorFilter}
                onChange={(v) => setObsAutorFilter(v || "todos")}
                placeholder="Anotação por"
                searchPlaceholder="Buscar operador..."
                options={[
                  { value: "todos", label: "Todas as anotações" },
                  { value: "com_obs", label: "📝 Com anotação" },
                  { value: "sem_obs", label: "⬜ Sem anotação" },
                  ...obsAutoresOptions.map(([id, nome]) => ({ value: id, label: `📝 ${nome}` })),
                ]}
              />
            )}
            {isAdmin && (
              <SearchSelect
                value={statusAutorFilter}
                onChange={(v) => setStatusAutorFilter(v || "todos")}
                placeholder="Confirmação por"
                searchPlaceholder="Buscar operador..."
                options={[
                  { value: "todos", label: "Todas as confirmações" },
                  ...statusAutoresOptions.map(([id, nome]) => ({ value: id, label: `✔️ ${nome}` })),
                ]}
              />
            )}

          </div>
          <p className="text-xs text-muted-foreground">
            {filtered.length} contato{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            {captadorFilter !== "todos" && " · filtrando apoiadores captados pelo usuário selecionado"}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="por-origem">Por Origem</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4 space-y-3">
          {isAdmin && filteredEleitorIds.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="p-3 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={toggleSelectAll} disabled={bulkDeleting}>
                    {allSelected ? "Desmarcar todos" : `Selecionar todos apoiadores (${filteredEleitorIds.length})`}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.size > 0 && (
                    <DeleteConfirmDialog
                      title={`Excluir ${selected.size} apoiador(es)?`}
                      description="Esta ação não pode ser desfeita. Os apoiadores selecionados serão removidos permanentemente."
                      onConfirm={() => bulkDeleteIds(Array.from(selected))}
                      trigger={
                        <Button size="sm" variant="destructive" className="gap-1.5" disabled={bulkDeleting}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir selecionados ({selected.size})
                        </Button>
                      }
                    />
                  )}
                  {captadorFilter !== "todos" && (
                    <DeleteConfirmDialog
                      title="Excluir todos do captador?"
                      description={`Tem certeza que deseja excluir TODOS os ${filteredEleitorIds.length} apoiadores captados por este usuário (considerando os filtros atuais)? Esta ação não pode ser desfeita.`}
                      onConfirm={() => bulkDeleteIds(filteredEleitorIds)}
                      trigger={
                        <Button size="sm" variant="destructive" className="gap-1.5" disabled={bulkDeleting}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir todos do captador ({filteredEleitorIds.length})
                        </Button>
                      }
                    />
                  )}
                  {isSuperAdmin && captadorFilter !== "todos" && (
                    <DeleteConfirmDialog
                      title="Excluir USUÁRIO e todos os apoiadores?"
                      description="Esta ação remove permanentemente a conta deste captador (login, perfil e vínculo de equipe) e TODOS os apoiadores que ele captou. Apenas o Super Admin pode executar. Não pode ser desfeita."
                      onConfirm={() => deleteCaptadorCompletely(captadorFilter)}
                      trigger={
                        <Button size="sm" variant="destructive" className="gap-1.5 border border-destructive-foreground/20" disabled={deletingUser}>
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingUser ? "Excluindo..." : "Excluir USUÁRIO + apoiadores"}
                        </Button>
                      }
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum contato encontrado com os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {filtered.slice(0, 200).map((lead) => {
                const wa = waLink(lead.telefone, buildWhatsAppMessage(waTemplate, lead.nome, lead.captador_nome ?? null, lead.dobrada_parceiro ?? null));
                return (
                  <Card key={lead.id} className="hover:bg-accent/30 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isAdmin && lead.tipo === "eleitor" && (
                          <Checkbox
                            checked={selected.has(lead.id.replace(/^ele-/, ""))}
                            onCheckedChange={() => toggleSelect(lead.id.replace(/^ele-/, ""))}
                            aria-label="Selecionar"
                          />
                        )}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {lead.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{lead.nome}</span>
                            <Badge variant={tipoBadge(lead.tipo)} className="text-[10px]">
                              {tipoLabel(lead.tipo)}
                            </Badge>
                            {(() => {
                              const st = confirmMap[phoneKey(lead.telefone)];
                              const sentAt = sentMap[phoneKey(lead.telefone)];
                              const stAutorId = statusAuthorMap[phoneKey(lead.telefone)];
                              const stAutor = stAutorId ? (obsAuthorNames[stAutorId] || profilesMap.get(stAutorId)) : null;
                              const suf = stAutor ? ` · por ${stAutor}` : "";
                              if (st === "confirmado") return <Badge title={stAutor ? `Confirmado por ${stAutor}` : undefined} className="text-[10px] bg-green-100 text-green-800 border-green-300 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-0.5" />Confirmado{isAdmin ? suf : ""}</Badge>;
                              if (st === "nao_confirmado") return <Badge title={stAutor ? `Não confirmado por ${stAutor}` : undefined} className="text-[10px] bg-red-100 text-red-800 border-red-300 hover:bg-red-100"><XCircle className="h-3 w-3 mr-0.5" />Não confirmado{isAdmin ? suf : ""}</Badge>;
                              if (sentAt) return <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100"><HelpCircle className="h-3 w-3 mr-0.5" />Sem resposta</Badge>;
                              return <Badge variant="outline" className="text-[10px] text-muted-foreground"><HelpCircle className="h-3 w-3 mr-0.5" />Não contatado</Badge>;
                            })()}
                            {obsMap[phoneKey(lead.telefone)] && (() => {
                              const autorId = obsAuthorMap[phoneKey(lead.telefone)];
                              const autor = autorId ? obsAuthorNames[autorId] : null;
                              return (
                                <Badge
                                  className="text-[10px] bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-100"
                                  title={obsMap[phoneKey(lead.telefone)]}
                                >
                                  <StickyNote className="h-3 w-3 mr-0.5" />
                                  {autor ? `Anotação de ${autor}` : "Com observação"}
                                </Badge>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            {lead.telefone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {lead.telefone}
                              </span>
                            )}
                            {(lead.cidade || lead.bairro) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {[lead.bairro, lead.cidade].filter(Boolean).join(" · ")}
                              </span>
                            )}
                            {lead.origem && <span className="opacity-75">↳ {lead.origem}</span>}
                          </div>
                          <LeadObsBadge phone={lead.telefone} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <LeadStatusControls phone={lead.telefone} nome={lead.nome} />
                        {!canSendWhatsApp ? (
                          lead.telefone ? (
                            <Badge variant="outline" className="text-[10px] opacity-60">
                              Envio bloqueado
                            </Badge>
                          ) : null
                        ) : wa ? (
                          (() => {
                            const sentAt = sentMap[phoneKey(lead.telefone)];
                            const msg = buildWhatsAppMessage(waTemplate, lead.nome, lead.captador_nome ?? null, lead.dobrada_parceiro ?? null);
                            const waSemTexto = waPhoneOnly(lead.telefone);
                            return (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1.5 h-8"
                                  title="Copiar mensagem e abrir contato (mais seguro em desktop)"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(msg);
                                      toast.success("Mensagem copiada — cole no WhatsApp");
                                      markSent(lead.telefone || "");
                                      if (waSemTexto) window.open(waSemTexto, "_blank", "noopener,noreferrer");
                                    } catch {
                                      toast.error("Não foi possível copiar a mensagem");
                                    }
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copiar
                                </Button>
                                <Button
                                  asChild
                                  size="sm"
                                  variant={sentAt ? "secondary" : "outline"}
                                  className="gap-1.5 h-8"
                                  title={sentAt ? `Mensagem já enviada em ${new Date(sentAt).toLocaleString("pt-BR")}` : "Enviar WhatsApp com mensagem pré-preenchida"}
                                >
                                  <a
                                    href={wa}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => handleWaClick(e, wa, lead.telefone, lead.nome)}
                                  >
                                    {sentAt ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <MessageCircle className="h-3.5 w-3.5 text-primary" />
                                    )}
                                    {sentAt ? "Enviado" : "WhatsApp"}
                                  </a>
                                </Button>
                              </>
                            );
                          })()
                        ) : lead.telefone ? (
                          <Badge variant="outline" className="text-[10px] opacity-60">
                            Telefone inválido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] opacity-60">
                            Sem telefone
                          </Badge>
                        )}
                        {lead.tipo === "eleitor" && (isAdmin || hasFullAccess) && lead.captador_user_id !== session?.user?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            title="Retirar do captador/liderança/coordenador e passar para captação própria"
                            onClick={() => setRevertTarget({ id: lead.id.replace(/^ele-/, ""), nome: lead.nome })}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Captação própria
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Editar"
                          onClick={() => {
                            const rid = lead.id.replace(/^(lid|ele|log)-/, "");
                            setEditing({ tipo: lead.tipo, id: rid, nome: lead.nome, telefone: lead.telefone || "" });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <DeleteConfirmDialog
                            title="Excluir contato"
                            description={`Tem certeza que deseja excluir "${lead.nome}"? Esta ação não pode ser desfeita.`}
                            onConfirm={async () => {
                              const rid = lead.id.replace(/^(lid|ele|log)-/, "");
                              const table = lead.tipo === "lideranca" ? "liderancas" : lead.tipo === "eleitor" ? "eleitores_captados" : "logistics_profiles";
                              const { error } = await supabase.from(table as never).delete().eq("id", rid);
                              if (error) { toast.error(error.message); return; }
                              toast.success("Contato excluído");
                              qc.invalidateQueries({ queryKey: ["leads-liderancas"] });
                              qc.invalidateQueries({ queryKey: ["leads-eleitores"] });
                              qc.invalidateQueries({ queryKey: ["leads-logistics"] });
                            }}
                            trigger={
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filtered.length > 200 && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  Mostrando os 200 primeiros. Refine os filtros ou exporte para ver todos.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="por-origem" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Apoiadores captados — agrupado por origem</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingPorOrigem
                eleitores={eleitores}
                liderancaMap={liderancaMap}
                profilesMap={profilesMap}
                captadorCoordMap={captadorCoordMap}
                hierMap={hierMap}
                isSuperAdmin={isSuperAdmin}
                onDeleteCaptador={deleteCaptadorCompletely}
                deletingUser={deletingUser}
              />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <AlertDialog open={!!confirmResend} onOpenChange={(v) => !v && setConfirmResend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-amber-500" />
              Mensagem já enviada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você já enviou a mensagem programada para <strong>{confirmResend?.nome}</strong>
              {confirmResend?.data && (
                <> em <strong>{new Date(confirmResend.data).toLocaleString("pt-BR")}</strong></>
              )}
              . Deseja enviar novamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmResend) {
                  markSent(confirmResend.phone);
                  window.open(confirmResend.url, "_blank", "noopener,noreferrer");
                  setConfirmResend(null);
                }
              }}
            >
              Enviar novamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && (
        <EditLeadDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          tipo={editing.tipo}
          recordId={editing.id}
          initialNome={editing.nome}
          initialTelefone={editing.telefone}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["leads-liderancas"] });
            qc.invalidateQueries({ queryKey: ["leads-eleitores"] });
            qc.invalidateQueries({ queryKey: ["leads-logistics"] });
          }}
        />
      )}

      <AlertDialog open={!!revertTarget} onOpenChange={(v) => !v && setRevertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter para captação própria</AlertDialogTitle>
            <AlertDialogDescription>
              {revertTarget?.nome} deixará de ser contabilizado para o captador, liderança e coordenador atuais e passará a contar como captação sua.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(ev) => { ev.preventDefault(); handleReverterCaptacao(); }} disabled={reverting}>
              {reverting ? "Revertendo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: any;
  label: string;
  value: number;
  variant?: "default" | "primary" | "accent";
}) {
  const bg =
    variant === "primary"
      ? "bg-primary/10 border-primary/20"
      : variant === "accent"
      ? "bg-accent/30 border-accent/40"
      : "bg-card border-border";
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function RankingPorOrigem({
  eleitores,
  liderancaMap,
  profilesMap,
  captadorCoordMap,
  hierMap,
  isSuperAdmin,
  onDeleteCaptador,
  deletingUser,
}: {
  eleitores: any[];
  liderancaMap: Map<string, string>;
  profilesMap: Map<string, string>;
  captadorCoordMap: Map<string, string | null>;
  hierMap: Map<string, { lider_id: string | null; coord_id: string | null }>;
  isSuperAdmin?: boolean;
  onDeleteCaptador?: (userId: string) => void | Promise<void>;
  deletingUser?: boolean;
}) {
  const [modo, setModo] = useState<"captadores" | "coordenadores">("captadores");

  // Fonte da verdade para "Coordenadores (equipe somada)": mesma RPC usada em Apoiadores Captados
  const { data: coordRanking = [], isLoading: loadingCoord } = useQuery({
    queryKey: ["leads-ranking-coordenacao"],
    enabled: modo === "coordenadores",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_captados_ranking_coordenacao" as never);
      if (error) throw error;
      return (data ?? []) as unknown as { user_id: string; nome: string; total: number }[];
    },
  });

  const ranking = useMemo(() => {
    if (modo === "coordenadores") {
      return coordRanking
        .map((r) => ({
          nome: r.nome || "Coordenação",
          tipo: "coordenador" as const,
          count: Number(r.total) || 0,
          userId: r.user_id,
        }))
        .sort((a, b) => b.count - a.count);
    }

    const map = new Map<string, { nome: string; tipo: "lideranca" | "usuario" | "coordenador"; count: number; userId?: string }>();
    eleitores.forEach((e) => {
      let key: string;
      let nome: string;
      let tipo: "lideranca" | "usuario" | "coordenador";
      let userId: string | undefined;

      if (e.tipo_captador === "usuario" && e.captado_por_user_id) {
        key = `u-${e.captado_por_user_id}`;
        nome = profilesMap.get(e.captado_por_user_id) || "Captador removido";
        tipo = "usuario";
        userId = e.captado_por_user_id;
      } else if (e.lideranca_id) {
        key = `l-${e.lideranca_id}`;
        nome = liderancaMap.get(e.lideranca_id) || "Liderança removida";
        tipo = "lideranca";
      } else {
        return;
      }
      const ex = map.get(key);
      if (ex) ex.count++;
      else map.set(key, { nome, tipo, count: 1, userId });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [eleitores, liderancaMap, profilesMap, modo, coordRanking]);

  if (modo === "captadores" && eleitores.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Nenhum apoiador captado ainda.</p>;
  }

  const max = ranking[0]?.count || 1;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={modo === "captadores" ? "default" : "outline"}
          onClick={() => setModo("captadores")}
        >
          Captadores (individual)
        </Button>
        <Button
          size="sm"
          variant={modo === "coordenadores" ? "default" : "outline"}
          onClick={() => setModo("coordenadores")}
        >
          Coordenadores (equipe somada)
        </Button>
      </div>

      {modo === "coordenadores" && (
        <p className="text-[11px] text-muted-foreground">
          Totais idênticos aos de "Apoiadores Captados" (coordenador + liderança + cabos + captadores da equipe, sem duplicidade).
        </p>
      )}

      {modo === "coordenadores" && loadingCoord ? (
        <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
      ) : ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum apoiador captado ainda.</p>
      ) : (
      <div className="space-y-2">

        {ranking.map((r, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="font-medium truncate">{r.nome}</span>
                <Badge
                  variant={r.tipo === "lideranca" ? "default" : r.tipo === "coordenador" ? "outline" : "secondary"}
                  className="text-[10px]"
                >
                  {r.tipo === "lideranca" ? "Liderança" : r.tipo === "coordenador" ? "Coordenador + equipe" : "Usuário"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-bold text-sm">{r.count}</span>
                {isSuperAdmin && r.tipo === "usuario" && r.userId && onDeleteCaptador && (
                  <DeleteConfirmDialog
                    title={`Excluir captador "${r.nome}"?`}
                    description={`Esta ação remove permanentemente a conta deste captador (login, perfil e vínculo de equipe) e TODOS os ${r.count} apoiador(es) que ele captou. Apenas o Super Admin pode executar. Não pode ser desfeita.`}
                    onConfirm={() => onDeleteCaptador(r.userId!)}
                    loading={deletingUser}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Excluir captador e seus apoiadores"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      )}

    </div>
  );
}

