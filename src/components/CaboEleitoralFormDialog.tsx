import { useEffect, useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useLiderancas } from "@/hooks/useSupabaseData";
import { useCidadesOptions } from "@/hooks/useCidadesOptions";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useCabosEleitorais, type CaboEleitoral } from "@/hooks/useCabosEleitorais";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, X, AlertTriangle, ArrowUpCircle, Users } from "lucide-react";
import PromoverContatoDialog, { type ContatoMatch } from "@/components/PromoverContatoDialog";
import DobradinhaFormDialog from "@/components/DobradinhaFormDialog";
import { useDobradinhas } from "@/hooks/useDobradinhas";

const schema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
  lider_id: z.string().uuid("Selecione o Líder responsável"),
  telefone: z.string().trim().min(1, "Telefone é obrigatório").max(20)
    .refine(v => v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 11, "Informe DDD + número (ex: (11) 99999-9999)"),
  whatsapp: z.string().max(20).optional().or(z.literal("")),
  cidade_base_id: z.string().uuid("Selecione uma cidade base"),
  bairros: z.array(z.string().max(200)).default([]),
  coordenador_user_id: z.string().optional().or(z.literal("")),
  cidades_representadas: z.array(z.string().uuid()).default([]),
  forca_politica: z.enum(["baixa", "media", "alta"]),
  status: z.enum(["ativa", "potencial", "em_negociacao"]),
  votos_estimados: z.coerce.number().int().min(0).default(0),
  historico_politico: z.string().max(2000).optional().or(z.literal("")),
  observacoes: z.string().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  cabo?: CaboEleitoral | null;
  liderIdDefault?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

function CidadeBaseSelectList({ value, onChange, cidades }: {
  value: string;
  onChange: (val: string) => void;
  cidades: { id: string; nome: string }[];
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const s = search.trim().toLocaleLowerCase("pt-BR");
    if (!s) return cidades;
    return cidades.filter(c => c.nome.toLocaleLowerCase("pt-BR").includes(s));
  }, [cidades, search]);
  const selected = cidades.find(c => c.id === value);
  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar cidade base..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-10 text-base sm:text-sm"
      />
      {selected && (
        <Badge variant="secondary" className="max-w-full gap-1 pr-1">
          <span className="min-w-0 truncate">{selected.nome}</span>
          <button type="button" onClick={() => onChange("")} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      <div className="max-h-[35dvh] min-h-32 overflow-y-auto rounded-md border p-2 [-webkit-overflow-scrolling:touch]">
        {filtered.map(c => (
          <label key={c.id} className="flex min-h-9 items-center gap-2 rounded px-1 py-1 text-sm cursor-pointer hover:bg-accent">
            <input
              type="radio"
              name="cabo_cidade_base_id"
              checked={value === c.id}
              onChange={() => onChange(c.id)}
              className="shrink-0 border-input"
            />
            <span className="min-w-0 flex-1 break-words">{c.nome}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhuma cidade encontrada.</p>}
      </div>
    </div>
  );
}

function CidadesMultiSelectWithVotes({ value, onChange, cidades, votosPorCidade, onVotosChange, zonasPorCidade, onZonasChange }: {
  value: string[];
  onChange: (val: string[]) => void;
  cidades: { id: string; nome: string }[];
  votosPorCidade: Record<string, number>;
  onVotosChange: (cidadeId: string, votos: number) => void;
  zonasPorCidade: Record<string, string[]>;
  onZonasChange: (cidadeId: string, zonas: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [zonaInputs, setZonaInputs] = useState<Record<string, string>>({});
  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const filtered = useMemo(() => {
    if (!search) return cidades;
    const s = search.toLowerCase();
    return cidades.filter(c => c.nome.toLowerCase().includes(s));
  }, [cidades, search]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  }
  function remove(id: string) { onChange(value.filter(v => v !== id)); }
  function addZona(cidadeId: string) {
    const zona = (zonaInputs[cidadeId] || "").trim();
    if (!zona) return;
    const current = zonasPorCidade[cidadeId] || [];
    if (!current.includes(zona)) onZonasChange(cidadeId, [...current, zona]);
    setZonaInputs(prev => ({ ...prev, [cidadeId]: "" }));
  }
  function removeZona(cidadeId: string, zona: string) {
    onZonasChange(cidadeId, (zonasPorCidade[cidadeId] || []).filter(z => z !== zona));
  }
  const totalVotos = value.reduce((sum, id) => sum + (votosPorCidade[id] || 0), 0);
  return (
    <div className="space-y-2">
      <Input placeholder="Buscar cidade..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
      <div className="max-h-[45dvh] min-h-40 overflow-y-auto rounded-md border p-2 [-webkit-overflow-scrolling:touch]">
        {filtered.map(c => (
          <label key={c.id} className="flex min-h-9 items-center gap-2 rounded px-1 py-1 text-sm cursor-pointer hover:bg-accent">
            <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} className="shrink-0 rounded border-input" />
            <span className="min-w-0 flex-1 break-words">{c.nome}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhuma cidade encontrada.</p>}
      </div>
      {value.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Votos por cidade selecionada</span>
            <Badge variant="default" className="text-xs">Total: {totalVotos.toLocaleString('pt-BR')} votos</Badge>
          </div>
          {value.map(id => {
            const c = cidadeMap.get(id);
            const zonas = zonasPorCidade[id] || [];
            return c ? (
              <div key={id} className="space-y-1.5 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1 pr-1 shrink-0">
                    {c.nome}
                    <button type="button" onClick={() => remove(id)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                  <Input type="number" min={0} placeholder="Votos" value={votosPorCidade[id] || ""} onChange={e => onVotosChange(id, parseInt(e.target.value) || 0)} className="h-7 w-28 text-xs" />
                </div>
                <div className="pl-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Zonas Eleitorais</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {zonas.map(z => (
                      <Badge key={z} variant="outline" className="text-[10px] gap-0.5 pr-0.5 h-5">
                        Zona {z}
                        <button type="button" onClick={() => removeZona(id, z)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Input placeholder="Nº zona" value={zonaInputs[id] || ""} onChange={e => setZonaInputs(prev => ({ ...prev, [id]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addZona(id); } }} className="h-6 w-24 text-[11px]" />
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => addZona(id)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function BairrosTagInput({ value, onChange }: { value: string[]; onChange: (val: string[]) => void }) {
  const [input, setInput] = useState("");
  function addBairro() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInput("");
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder="Digite o nome do bairro e pressione Enter" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addBairro(); } }} className="h-9" />
        <Button type="button" variant="outline" size="sm" onClick={addBairro} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((b, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {b}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CaboEleitoralFormDialog({ cabo, liderIdDefault, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: cidades = [] } = useCidadesOptions();
  const { data: coordenadores = [] } = useCoordenadores();
  const { data: liderancas = [] } = useLiderancas();
  const { data: allCabos = [] } = useCabosEleitorais();
  const queryClient = useQueryClient();
  const { data: allDobradinhas = [] } = useDobradinhas();
  const isEdit = !!cabo;

  const [duplicatePhoneWarning, setDuplicatePhoneWarning] = useState<string | null>(null);
  const [duplicateNameWarning, setDuplicateNameWarning] = useState<string | null>(null);
  const [contatoMatch, setContatoMatch] = useState<ContatoMatch | null>(null);
  const [promoverOpen, setPromoverOpen] = useState(false);
  const [promoteSource, setPromoteSource] = useState<{ origem: ContatoMatch["origem"]; id: string } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      lider_id: liderIdDefault || "",
      telefone: "",
      whatsapp: "",
      cidade_base_id: "",
      bairros: [],
      coordenador_user_id: "",
      cidades_representadas: [],
      forca_politica: "media",
      status: "potencial",
      votos_estimados: 0,
      historico_politico: "",
      observacoes: "",
    },
  });

  // Busca contato existente em eleitores_captados / liderancas por telefone ou nome
  const searchExistingContact = useCallback(async (phone: string, name: string) => {
    const digits = (phone || "").replace(/\D/g, "");
    const trimmedName = (name || "").trim();
    if (digits.length < 10 && trimmedName.length < 4) return;

    // 1) Liderança
    if (digits.length >= 10) {
      const lidByPhone = liderancas.find(l => {
        const d1 = (l.telefone || "").replace(/\D/g, "");
        const d2 = (l.whatsapp || "").replace(/\D/g, "");
        return d1 === digits || d2 === digits;
      });
      if (lidByPhone) {
        setContatoMatch({
          origem: "lideranca",
          id: lidByPhone.id,
          nome: lidByPhone.nome,
          telefone: lidByPhone.telefone,
          whatsapp: lidByPhone.whatsapp,
          cidade_id: lidByPhone.cidade_base_id,
          bairro: (lidByPhone as any).bairros?.[0] || (lidByPhone as any).bairro || null,
          observacoes: lidByPhone.observacoes,
        });
        return;
      }
    }
    if (trimmedName.length >= 4) {
      const lidByName = liderancas.find(l => l.nome.trim().toLowerCase() === trimmedName.toLowerCase());
      if (lidByName) {
        setContatoMatch({
          origem: "lideranca",
          id: lidByName.id,
          nome: lidByName.nome,
          telefone: lidByName.telefone,
          whatsapp: lidByName.whatsapp,
          cidade_id: lidByName.cidade_base_id,
          bairro: (lidByName as any).bairros?.[0] || (lidByName as any).bairro || null,
          observacoes: lidByName.observacoes,
        });
        return;
      }
    }

    // 2) Eleitor captado (busca no banco)
    try {
      let query = supabase.from("eleitores_captados").select("id,nome_completo,telefone,bairro,cidade_id,cidade_nome,observacoes").limit(1);
      if (digits.length >= 10) {
        // Tenta pelo telefone exato normalizado
        const { data } = await supabase.rpc("normalize_phone" as never, { p: phone } as never);
        void data;
        const { data: rows } = await query.eq("telefone", phone);
        if (rows && rows.length > 0) {
          const c = rows[0] as any;
          setContatoMatch({
            origem: "eleitor_captado",
            id: c.id,
            nome: c.nome_completo,
            telefone: c.telefone,
            bairro: c.bairro,
            cidade_id: c.cidade_id,
            cidade_nome: c.cidade_nome,
            observacoes: c.observacoes,
          });
          return;
        }
      }
      if (trimmedName.length >= 4) {
        const { data: rows } = await supabase
          .from("eleitores_captados")
          .select("id,nome_completo,telefone,bairro,cidade_id,cidade_nome,observacoes")
          .ilike("nome_completo", trimmedName)
          .limit(1);
        if (rows && rows.length > 0) {
          const c = rows[0] as any;
          setContatoMatch({
            origem: "eleitor_captado",
            id: c.id,
            nome: c.nome_completo,
            telefone: c.telefone,
            bairro: c.bairro,
            cidade_id: c.cidade_id,
            cidade_nome: c.cidade_nome,
            observacoes: c.observacoes,
          });
          return;
        }
      }
    } catch (e) {
      // silencioso
    }
    setContatoMatch(null);
  }, [liderancas]);

  function applyMatchToCaboForm(m: ContatoMatch) {
    if (m.nome) form.setValue("nome", m.nome);
    if (m.telefone) form.setValue("telefone", m.telefone);
    if (m.whatsapp) form.setValue("whatsapp", m.whatsapp);
    if (m.cidade_id && !form.getValues("cidade_base_id")) form.setValue("cidade_base_id", m.cidade_id);
    if (m.bairro) {
      const current = form.getValues("bairros") || [];
      if (!current.includes(m.bairro)) form.setValue("bairros", [...current, m.bairro]);
    }
    if (m.observacoes && !form.getValues("observacoes")) form.setValue("observacoes", m.observacoes);
    if (m.id) setPromoteSource({ origem: m.origem, id: m.id });
    toast.success("Dados do contato copiados. Complete os campos restantes.");
  }

  const checkDuplicatePhone = useCallback((phone: string) => {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length < 8) { setDuplicatePhoneWarning(null); return; }
    const match = allCabos.find(c => {
      if (isEdit && c.id === cabo?.id) return false;
      const d = (c.telefone || "").replace(/\D/g, "");
      return d.length >= 8 && d === digits;
    });
    setDuplicatePhoneWarning(match ? `Telefone já cadastrado no cabo "${match.nome}"` : null);
    if (!isEdit && digits.length >= 10) searchExistingContact(phone, form.getValues("nome"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCabos, isEdit, cabo?.id, searchExistingContact]);

  const checkDuplicateName = useCallback((name: string) => {
    const trimmed = (name || "").trim().toLowerCase();
    if (trimmed.length < 3) { setDuplicateNameWarning(null); return; }
    const match = allCabos.find(c => {
      if (isEdit && c.id === cabo?.id) return false;
      return c.nome.trim().toLowerCase() === trimmed;
    });
    setDuplicateNameWarning(match ? `Nome já cadastrado: "${match.nome}"` : null);
    if (!isEdit && trimmed.length >= 4) searchExistingContact(form.getValues("telefone"), name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCabos, isEdit, cabo?.id, searchExistingContact]);

  const [votosPorCidade, setVotosPorCidade] = useState<Record<string, number>>({});
  const [zonasPorCidade, setZonasPorCidade] = useState<Record<string, string[]>>({});

  function handleVotosChange(cidadeId: string, votos: number) {
    setVotosPorCidade(prev => ({ ...prev, [cidadeId]: votos }));
  }
  function handleZonasChange(cidadeId: string, zonas: string[]) {
    setZonasPorCidade(prev => ({ ...prev, [cidadeId]: zonas }));
  }


  // Hydrate on open — always refetch canonical row from DB
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const hydrate = (source: any) => {
      if (cancelled || !source) return;
      const represented = new Set<string>([
        ...(((source?.cidades_representadas as string[] | null) || []).filter(Boolean)),
        ...Object.keys(source?.votos_por_cidade || {}),
        ...Object.keys(source?.zonas_por_cidade || {}),
      ]);
      if (source?.cidade_base_id) represented.add(source.cidade_base_id);

      form.reset({
        nome: source?.nome || "",
        lider_id: source?.lider_id || liderIdDefault || "",
        telefone: source?.telefone || "",
        whatsapp: source?.whatsapp || "",
        cidade_base_id: source?.cidade_base_id || "",
        bairros: (source?.bairros as string[]) || (source?.bairro ? [source.bairro] : []),
        coordenador_user_id: source?.coordenador_user_id || "",
        cidades_representadas: Array.from(represented),
        forca_politica: (source?.forca_politica as FormValues["forca_politica"]) || "media",
        status: (source?.status as FormValues["status"]) || "potencial",
        votos_estimados: source?.votos_estimados || 0,
        historico_politico: source?.historico_politico || "",
        observacoes: source?.observacoes || "",
      });
      const vpc = source?.votos_por_cidade;
      setVotosPorCidade(vpc && typeof vpc === "object" && !Array.isArray(vpc) ? { ...vpc } : {});
      const zpc = source?.zonas_por_cidade;
      setZonasPorCidade(zpc && typeof zpc === "object" && !Array.isArray(zpc) ? { ...zpc } : {});
      setDuplicateNameWarning(null);
      setDuplicatePhoneWarning(null);
    };

    if (cabo) {
      hydrate(cabo);
      if (cabo.id) {
        supabase.from("cabos_eleitorais").select("*").eq("id", cabo.id).maybeSingle()
          .then(({ data }) => { if (data) hydrate(data); });
      }
    } else {
      form.reset({
        nome: "",
        lider_id: liderIdDefault || "",
        telefone: "",
        whatsapp: "",
        cidade_base_id: "",
        bairros: [],
        coordenador_user_id: "",
        cidades_representadas: [],
        forca_politica: "media",
        status: "potencial",
        votos_estimados: 0,
        historico_politico: "",
        observacoes: "",
      });
      setVotosPorCidade({});
      setZonasPorCidade({});
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cabo?.id]);

  // Auto-fill cidade base a partir do Líder escolhido (se estiver vazia)
  const selectedLider = form.watch("lider_id");
  useEffect(() => {
    if (!selectedLider) return;
    const l = liderancas.find(x => x.id === selectedLider);
    if (l?.cidade_base_id && !form.getValues("cidade_base_id")) {
      form.setValue("cidade_base_id", l.cidade_base_id);
    }
    if (l?.coordenador_user_id && !form.getValues("coordenador_user_id")) {
      form.setValue("coordenador_user_id", l.coordenador_user_id);
    }
  }, [selectedLider, liderancas]);

  async function onSubmit(values: FormValues, keepOpen = false) {
    setSaving(true);
    try {
      const cidadesRep = Array.from(new Set([values.cidade_base_id, ...values.cidades_representadas].filter(Boolean)));
      const cleanVotos: Record<string, number> = { ...votosPorCidade };
      const cleanZonas: Record<string, string[]> = { ...zonasPorCidade };
      cidadesRep.forEach(cid => {
        if (!(cid in cleanVotos)) cleanVotos[cid] = 0;
        if (!(cid in cleanZonas)) cleanZonas[cid] = [];
      });
      const totalVotos = Object.values(cleanVotos).reduce((s, v) => s + (v || 0), 0);

      const payload: any = {
        nome: values.nome.trim(),
        lider_id: values.lider_id,
        telefone: values.telefone || null,
        whatsapp: values.whatsapp || null,
        cidade_base_id: values.cidade_base_id,
        bairro: values.bairros[0] || null, // mantém coluna legada
        bairros: values.bairros,
        coordenador_user_id: values.coordenador_user_id || null,
        cidades_representadas: cidadesRep,
        forca_politica: values.forca_politica,
        status: values.status,
        votos_estimados: totalVotos,
        votos_por_cidade: cleanVotos,
        zonas_por_cidade: cleanZonas,
        historico_politico: values.historico_politico || null,
        observacoes: values.observacoes || null,
        promoted_from_origem: promoteSource?.origem || null,
        promoted_from_id: promoteSource?.id || null,
      };

      if (isEdit && cabo) {
        const { error } = await supabase.from("cabos_eleitorais").update(payload).eq("id", cabo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cabos_eleitorais").insert(payload);
        if (error) throw error;
      }

      toast.success(isEdit ? "Cabo Eleitoral atualizado!" : "Cabo Eleitoral cadastrado!");
      setPromoteSource(null);
      if (!keepOpen) {
        setOpen(false);
        form.reset();
      }
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["cabos_eleitorais"] });
        queryClient.invalidateQueries({ queryKey: ["liderancas"] });
        queryClient.invalidateQueries({ queryKey: ["eleitores_captados"] });
        queryClient.invalidateQueries({ queryKey: ["coordenadores_regionais"] });
        onSuccess?.();
      }, 150);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("já cadastrado no sistema") || err?.code === "23505") {
        toast.error(msg || "Telefone já cadastrado no sistema.");
      } else {
        toast.error(msg || "Erro ao salvar Cabo Eleitoral");
      }
    } finally {
      setSaving(false);
    }
  }

  const liderOptions = useMemo(
    () => liderancas.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(l => ({ value: l.id, label: l.nome })),
    [liderancas]
  );

  const coordOptions = [
    ...coordenadores.map(c => ({
      value: c.user_id,
      label: `${c.nome}${c.cidades_ids.length > 0 ? ` (${c.cidades_ids.length} cidade(s))` : ""}`,
    })),
  ];

  const forcaOptions = [
    { value: "baixa", label: "Baixa" },
    { value: "media", label: "Média" },
    { value: "alta", label: "Alta" },
  ];
  const statusOptions = [
    { value: "potencial", label: "Potencial" },
    { value: "em_negociacao", label: "Em Negociação" },
    { value: "ativa", label: "Ativa" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />Cadastrar Cabo Eleitoral</Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Cabo Eleitoral" : "Novo Cabo Eleitoral"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit(v, false))} className="w-full space-y-4">
            <FormField control={form.control} name="lider_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Líder responsável *</FormLabel>
                <FormControl>
                  <SearchSelect
                    value={field.value}
                    onChange={v => field.onChange(v)}
                    options={liderOptions}
                    placeholder="Selecione o Líder…"
                    searchPlaceholder="Buscar líder..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nome do cabo eleitoral"
                    {...field}
                    onChange={e => { field.onChange(e); checkDuplicateName(e.target.value); }}
                    onBlur={e => { field.onBlur(); checkDuplicateName(e.target.value); }}
                  />
                </FormControl>
                {duplicateNameWarning && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{duplicateNameWarning}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            {contatoMatch && !isEdit && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 flex items-start gap-2">
                <ArrowUpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Contato já existe no sistema</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contatoMatch.nome}
                    {contatoMatch.telefone && ` · ${contatoMatch.telefone}`}
                    {" · "}
                    <span className="font-medium">
                      {contatoMatch.origem === "lideranca" ? "Liderança" : contatoMatch.origem === "eleitor_captado" ? "Eleitor Captado" : "Cabo"}
                    </span>
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => setPromoverOpen(true)}>
                  Promover
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (DDD + número) *</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" placeholder="(11) 99999-9999" required {...field}
                      onChange={e => { field.onChange(e); checkDuplicatePhone(e.target.value); }}
                      onBlur={e => { field.onBlur(); checkDuplicatePhone(e.target.value); }} />
                  </FormControl>
                  {duplicatePhoneWarning && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{duplicatePhoneWarning}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="whatsapp" render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl><Input placeholder="(11) 99999-9999" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="cidade_base_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade Base *</FormLabel>
                <FormControl>
                  <CidadeBaseSelectList value={field.value} onChange={field.onChange} cidades={cidades} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="bairros" render={({ field }) => (
              <FormItem>
                <FormLabel>Bairros</FormLabel>
                <FormControl>
                  <BairrosTagInput value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="coordenador_user_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Coordenador Vinculado</FormLabel>
                <FormControl>
                  <SearchSelect
                    value={field.value || ""}
                    onChange={(v) => field.onChange(v)}
                    options={coordOptions}
                    placeholder="Selecione o coordenador..."
                    searchPlaceholder="Buscar coordenador..."
                    allowClear
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="cidades_representadas" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidades Representadas (com votos por cidade)</FormLabel>
                <FormControl>
                  <CidadesMultiSelectWithVotes
                    value={field.value}
                    onChange={field.onChange}
                    cidades={cidades}
                    votosPorCidade={votosPorCidade}
                    onVotosChange={handleVotosChange}
                    zonasPorCidade={zonasPorCidade}
                    onZonasChange={handleZonasChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="forca_politica" render={({ field }) => (
                <FormItem>
                  <FormLabel>Força Política *</FormLabel>
                  <FormControl><NativeSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} options={forcaOptions} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <FormControl><NativeSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} options={statusOptions} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {isEdit && cabo?.id && (() => {
              const linkedToCabo = allDobradinhas.filter((d: any) => d.cabo_id === cabo.id);
              const linkedIds = new Set(linkedToCabo.map(d => d.id));
              // distinct existing dobradas by candidato name (that aren't already linked to this cabo)
              const seen = new Set<string>();
              const existingOptions = allDobradinhas
                .filter(d => !linkedIds.has(d.id))
                .filter(d => {
                  const k = d.candidato_parceiro.trim().toLowerCase();
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                })
                .map(d => ({ value: d.id, label: d.candidato_parceiro + (d.cargo_parceiro ? ` — ${d.cargo_parceiro}` : "") }));

              const handleLinkExisting = async (dobradinhaId: string) => {
                if (!dobradinhaId) return;
                const src = allDobradinhas.find(d => d.id === dobradinhaId);
                if (!src) return;
                const cidadeId = form.watch("cidade_base_id") || src.cidade_id || null;
                const { error } = await supabase.from("dobradinhas").insert({
                  cidade_id: cidadeId,
                  cabo_id: cabo.id,
                  lideranca_id: null,
                  candidato_parceiro: src.candidato_parceiro,
                  cargo_parceiro: src.cargo_parceiro,
                  votos_estimados: src.votos_estimados || 0,
                  observacoes: src.observacoes,
                });
                if (error) { toast.error(error.message); return; }
                toast.success("Dobrada vinculada ao Cabo!");
                queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
              };

              const handleUnlink = async (id: string) => {
                const { error } = await supabase.from("dobradinhas").delete().eq("id", id);
                if (error) { toast.error(error.message); return; }
                toast.success("Vínculo removido!");
                queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
              };

              return (
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Dobradas Vinculadas</span>
                    <DobradinhaFormDialog
                      defaultCaboId={cabo.id}
                      defaultCidadeId={form.watch("cidade_base_id")}
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: ["dobradinhas"] })}
                      trigger={
                        <Button type="button" variant="outline" size="sm" className="ml-auto h-7 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Nova Dobrada
                        </Button>
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Escolher dobrada já cadastrada</label>
                    <SearchSelect
                      value=""
                      onChange={handleLinkExisting}
                      options={existingOptions}
                      placeholder={existingOptions.length ? "Selecione para vincular..." : "Nenhuma dobrada disponível"}
                      searchPlaceholder="Buscar dobrada..."
                    />
                  </div>

                  {linkedToCabo.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {linkedToCabo.map(d => (
                        <Badge key={d.id} variant="secondary" className="gap-1 text-xs">
                          {d.candidato_parceiro}
                          <button
                            type="button"
                            onClick={() => handleUnlink(d.id)}
                            className="ml-1 hover:text-destructive"
                            aria-label="Remover vínculo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Cadastre ou vincule candidatos parceiros a este Cabo Eleitoral.
                  </p>
                </div>
              );
            })()}


            <FormField control={form.control} name="historico_politico" render={({ field }) => (
              <FormItem>
                <FormLabel>Histórico Político</FormLabel>
                <FormControl><Textarea placeholder="Histórico e trajetória política..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea placeholder="Observações adicionais..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex flex-col gap-2 border-t bg-background pt-3 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => form.handleSubmit((v) => onSubmit(v, true))()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar e Continuar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {isEdit ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      <PromoverContatoDialog
        open={promoverOpen}
        onOpenChange={setPromoverOpen}
        match={contatoMatch}
        onPromoteToCabo={(m) => { applyMatchToCaboForm(m); setContatoMatch(null); }}
        onLiderCreated={() => { setContatoMatch(null); setOpen(false); }}
      />
    </Dialog>
  );
}
