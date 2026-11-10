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
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, X, Users, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useDobradinhas } from "@/hooks/useDobradinhas";
import DobradinhaFormDialog from "@/components/DobradinhaFormDialog";
import { CaptacaoLinkPanel } from "@/components/CaptacaoLinkPanel";
import { CadastroCaboLinkPanel } from "@/components/CadastroCaboLinkPanel";
import { useEleitoresCaptados } from "@/hooks/useEleitoresCaptados";

const schema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
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
  lideranca?: Tables<"liderancas"> | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  existingCidadesBaseIds?: string[];
  initialData?: Partial<Tables<"liderancas">> | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Marks that this create is a promotion from an existing contact. Source will be deleted before insert to bypass phone-unique trigger. */
  promoteSource?: { origem: "eleitor_captado" | "lideranca" | "cabo_eleitoral"; id: string };
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
              name="cidade_base_id"
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

  function remove(id: string) {
    onChange(value.filter(v => v !== id));
  }

  function addZona(cidadeId: string) {
    const zona = (zonaInputs[cidadeId] || "").trim();
    if (!zona) return;
    const current = zonasPorCidade[cidadeId] || [];
    if (!current.includes(zona)) {
      onZonasChange(cidadeId, [...current, zona]);
    }
    setZonaInputs(prev => ({ ...prev, [cidadeId]: "" }));
  }

  function removeZona(cidadeId: string, zona: string) {
    const current = zonasPorCidade[cidadeId] || [];
    onZonasChange(cidadeId, current.filter(z => z !== zona));
  }

  const totalVotos = value.reduce((sum, id) => sum + (votosPorCidade[id] || 0), 0);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar cidade..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-9"
      />
      <div className="max-h-[45dvh] min-h-40 overflow-y-auto rounded-md border p-2 [-webkit-overflow-scrolling:touch]">
        {filtered.map(c => (
          <label key={c.id} className="flex min-h-9 items-center gap-2 rounded px-1 py-1 text-sm cursor-pointer hover:bg-accent">
            <input
              type="checkbox"
              checked={value.includes(c.id)}
              onChange={() => toggle(c.id)}
              className="shrink-0 rounded border-input"
            />
            <span className="min-w-0 flex-1 break-words">{c.nome}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhuma cidade encontrada.</p>}
      </div>
      {value.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Votos por cidade selecionada</span>
            <Badge variant="default" className="text-xs">
              Total: {totalVotos.toLocaleString('pt-BR')} votos
            </Badge>
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
                  <Input
                    type="number"
                    min={0}
                    placeholder="Votos"
                    value={votosPorCidade[id] || ""}
                    onChange={e => onVotosChange(id, parseInt(e.target.value) || 0)}
                    className="h-7 w-28 text-xs"
                  />
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
                    <Input
                      placeholder="Nº zona"
                      value={zonaInputs[id] || ""}
                      onChange={e => setZonaInputs(prev => ({ ...prev, [id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addZona(id); } }}
                      className="h-6 w-24 text-[11px]"
                    />
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
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Digite o nome do bairro e pressione Enter"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addBairro(); } }}
          className="h-9"
        />
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

export default function LiderancaFormDialog({ lideranca, trigger, onSuccess, existingCidadesBaseIds = [], initialData, open: controlledOpen, onOpenChange, promoteSource }: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback((o: boolean) => {
    if (controlledOpen !== undefined) onOpenChange?.(o);
    else setUncontrolledOpen(o);
  }, [controlledOpen, onOpenChange]);
  const [saving, setSaving] = useState(false);
  const { data: cidades = [] } = useCidadesOptions();
  const { data: coordenadores = [] } = useCoordenadores();
  const { data: dobradinhas = [] } = useDobradinhas();
  const { data: allLiderancas = [] } = useLiderancas();
  const { data: eleitoresCaptados = [] } = useEleitoresCaptados(lideranca?.id);
  const captadosCount = eleitoresCaptados.length;
  const queryClient = useQueryClient();
  const isEdit = !!lideranca?.id;
  const [dobSearch, setDobSearch] = useState("");
  const [duplicatePhoneWarning, setDuplicatePhoneWarning] = useState<string | null>(null);
  const [duplicateNameWarning, setDuplicateNameWarning] = useState<string | null>(null);

  const checkDuplicatePhone = useCallback((phone: string) => {
    if (!phone || phone.trim().length < 8) {
      setDuplicatePhoneWarning(null);
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      setDuplicatePhoneWarning(null);
      return;
    }
    const match = allLiderancas.find(l => {
      if (isEdit && l.id === lideranca?.id) return false;
      const ld = (l.telefone || "").replace(/\D/g, "");
      return ld.length >= 8 && ld === digits;
    });
    if (match) {
      setDuplicatePhoneWarning(`Telefone já cadastrado na liderança "${match.nome}"`);
    } else {
      setDuplicatePhoneWarning(null);
    }
  }, [allLiderancas, isEdit, lideranca?.id]);

  const checkDuplicateName = useCallback((name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length < 3) {
      setDuplicateNameWarning(null);
      return;
    }
    const match = allLiderancas.find(l => {
      if (isEdit && l.id === lideranca?.id) return false;
      return l.nome.trim().toLowerCase() === trimmed;
    });
    if (match) {
      setDuplicateNameWarning(`Nome já cadastrado: "${match.nome}"`);
    } else {
      setDuplicateNameWarning(null);
    }
  }, [allLiderancas, isEdit, lideranca?.id]);

  // Per-city votes state
  const [votosPorCidade, setVotosPorCidade] = useState<Record<string, number>>(() => {
    const raw = (lideranca as any)?.votos_por_cidade;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, number>;
    return {};
  });

  // Per-city zones state
  const [zonasPorCidade, setZonasPorCidade] = useState<Record<string, string[]>>(() => {
    const raw = (lideranca as any)?.zonas_por_cidade;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string[]>;
    return {};
  });

  function handleVotosChange(cidadeId: string, votos: number) {
    setVotosPorCidade(prev => ({ ...prev, [cidadeId]: votos }));
  }

  function handleZonasChange(cidadeId: string, zonas: string[]) {
    setZonasPorCidade(prev => ({ ...prev, [cidadeId]: zonas }));
  }

  // Group dobradinhas by candidato+cargo (one entry per unique candidate)
  // Each "group" represents a candidate; selection means: vincular a esta liderança
  const candidateGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      candidato: string;
      cargo: string;
      totalVotos: number;
      vinculadasOutrasLid: number;
      jaVinculadaAEstaLid: string | null; // id of record linked to current lideranca
    }>();
    dobradinhas.forEach(d => {
      const key = `${d.candidato_parceiro.trim().toLowerCase()}::${(d.cargo_parceiro || "").trim().toLowerCase()}`;
      const existing = map.get(key);
      const isThisLid = lideranca && d.lideranca_id === lideranca.id;
      if (existing) {
        existing.totalVotos += d.votos_estimados || 0;
        if (d.lideranca_id && !isThisLid) existing.vinculadasOutrasLid++;
        if (isThisLid) existing.jaVinculadaAEstaLid = d.id;
      } else {
        map.set(key, {
          key,
          candidato: d.candidato_parceiro,
          cargo: d.cargo_parceiro || "",
          totalVotos: d.votos_estimados || 0,
          vinculadasOutrasLid: d.lideranca_id && !isThisLid ? 1 : 0,
          jaVinculadaAEstaLid: isThisLid ? d.id : null,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.candidato.localeCompare(b.candidato));
  }, [dobradinhas, lideranca]);

  // Set of selected candidate keys
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const initial = new Set<string>();
    candidateGroups.forEach(g => {
      if (g.jaVinculadaAEstaLid) initial.add(g.key);
    });
    setSelectedCandidateKeys(initial);
    setDobSearch("");
  }, [open, lideranca?.id, candidateGroups]);

  const filteredCandidateGroups = useMemo(() => {
    const s = dobSearch.trim().toLowerCase();
    if (!s) return candidateGroups;
    return candidateGroups.filter(g =>
      g.candidato.toLowerCase().includes(s) || g.cargo.toLowerCase().includes(s)
    );
  }, [candidateGroups, dobSearch]);

  const totalVotosDob = useMemo(() => {
    return candidateGroups
      .filter(g => selectedCandidateKeys.has(g.key))
      .reduce((s, g) => s + g.totalVotos, 0);
  }, [candidateGroups, selectedCandidateKeys]);

  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: lideranca?.nome || "",
      telefone: lideranca?.telefone || "",
      whatsapp: lideranca?.whatsapp || "",
      cidade_base_id: lideranca?.cidade_base_id || "",
      bairros: (lideranca as any)?.bairros || [],
      coordenador_user_id: (lideranca as any)?.coordenador_user_id || "",
      cidades_representadas: (lideranca?.cidades_representadas as string[]) || [],
      forca_politica: (lideranca?.forca_politica as FormValues["forca_politica"]) || "media",
      status: (lideranca?.status as FormValues["status"]) || "potencial",
      votos_estimados: (lideranca as any)?.votos_estimados || 0,
      historico_politico: lideranca?.historico_politico || "",
      observacoes: lideranca?.observacoes || "",
    },
  });

  // Reset form + per-city state whenever the dialog opens.
  // Refetches the row fresh from the DB to guarantee the latest values are shown
  // (avoids stale React Query cache hiding cidades/zonas after a recent save).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const hydrate = (source: any) => {
      if (cancelled || !source) return;
      const represented = new Set<string>(
        ((source?.cidades_representadas as string[] | null) || []).filter(Boolean)
      );
      if (source?.cidade_base_id) represented.add(source.cidade_base_id);

      form.reset({
        nome: source?.nome || "",
        telefone: source?.telefone || "",
        whatsapp: source?.whatsapp || "",
        cidade_base_id: source?.cidade_base_id || "",
        bairros: (source?.bairros as string[]) || [],
        coordenador_user_id: source?.coordenador_user_id || "",
        cidades_representadas: Array.from(represented),
        forca_politica: (source?.forca_politica as FormValues["forca_politica"]) || "media",
        status: (source?.status as FormValues["status"]) || "potencial",
        votos_estimados: source?.votos_estimados || 0,
        historico_politico: source?.historico_politico || "",
        observacoes: source?.observacoes || "",
      });
      // Manter apenas votos/zonas das cidades atualmente representadas
      const vpcRaw = source?.votos_por_cidade;
      const vpc: Record<string, number> = {};
      if (vpcRaw && typeof vpcRaw === "object" && !Array.isArray(vpcRaw)) {
        for (const cid of represented) {
          if (cid in vpcRaw) vpc[cid] = (vpcRaw as any)[cid];
        }
      }
      setVotosPorCidade(vpc);
      const zpcRaw = source?.zonas_por_cidade;
      const zpc: Record<string, string[]> = {};
      if (zpcRaw && typeof zpcRaw === "object" && !Array.isArray(zpcRaw)) {
        for (const cid of represented) {
          if (cid in zpcRaw) zpc[cid] = (zpcRaw as any)[cid];
        }
      }
      setZonasPorCidade(zpc);
      setDuplicateNameWarning(null);
      setDuplicatePhoneWarning(null);
    };

    // Immediate hydrate with prop so dialog never flashes empty
    hydrate(lideranca ?? initialData);


    // Refetch canonical row to override stale cache
    if (lideranca?.id) {
      supabase
        .from("liderancas")
        .select("*")
        .eq("id", lideranca.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) hydrate(data);
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lideranca?.id]);

  async function onSubmit(values: FormValues, keepOpen = false) {
    setSaving(true);
    try {
      // Calculate total votos from per-city inputs.
      // Mantém votos/zonas APENAS das cidades atualmente representadas —
      // se o usuário removeu uma cidade, seus votos são descartados.
      const cidadesRep = Array.from(new Set([values.cidade_base_id, ...values.cidades_representadas].filter(Boolean)));
      const cidadesRepSet = new Set(cidadesRep);
      const cleanVotosPorCidade: Record<string, number> = {};
      const cleanZonasPorCidade: Record<string, string[]> = {};
      cidadesRep.forEach(cid => {
        cleanVotosPorCidade[cid] = votosPorCidade[cid] || 0;
        cleanZonasPorCidade[cid] = zonasPorCidade[cid] || [];
      });
      const totalVotos = Object.values(cleanVotosPorCidade).reduce((s, v) => s + (v || 0), 0);

      const payload = {
        nome: values.nome,
        telefone: values.telefone || null,
        whatsapp: values.whatsapp || null,
        cidade_base_id: values.cidade_base_id,
        bairros: values.bairros.length > 0 ? values.bairros : [],
        coordenador_user_id: values.coordenador_user_id || null,
        cidades_representadas: cidadesRep,
        forca_politica: values.forca_politica as "baixa" | "media" | "alta",
        status: values.status as "ativa" | "potencial" | "em_negociacao",
        votos_estimados: totalVotos,
        votos_por_cidade: cleanVotosPorCidade,
        zonas_por_cidade: cleanZonasPorCidade,
        historico_politico: values.historico_politico || null,
        observacoes: values.observacoes || null,
        promoted_from_origem: promoteSource?.origem || null,
        promoted_from_id: promoteSource?.id || null,
      };

      let liderancaId = lideranca?.id;

      if (isEdit && lideranca) {
        const { error } = await supabase.from("liderancas").update(payload as any).eq("id", lideranca.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("liderancas").insert(payload as any).select("id").single();
        if (error) throw error;
        liderancaId = data.id;
      }

      // Update dobradinha links by candidate group
      if (liderancaId) {
        const previouslyLinked = candidateGroups.filter(g => g.jaVinculadaAEstaLid).map(g => g.key);

        // Unlink: previously linked groups not in current selection
        const toUnlinkKeys = previouslyLinked.filter(k => !selectedCandidateKeys.has(k));
        for (const key of toUnlinkKeys) {
          const group = candidateGroups.find(g => g.key === key);
          if (group?.jaVinculadaAEstaLid) {
            await supabase.from("dobradinhas").update({ lideranca_id: null } as any).eq("id", group.jaVinculadaAEstaLid);
          }
        }

        // Link: newly selected groups — create a NEW record per lideranca (don't steal)
        const toLinkKeys = Array.from(selectedCandidateKeys).filter(k => !previouslyLinked.includes(k));
        for (const key of toLinkKeys) {
          const group = candidateGroups.find(g => g.key === key);
          if (!group) continue;
          await supabase.from("dobradinhas").insert({
            candidato_parceiro: group.candidato,
            cargo_parceiro: group.cargo || null,
            lideranca_id: liderancaId,
            cidade_id: values.cidade_base_id || null,
            votos_estimados: 0,
          } as any);
        }
      }

      toast.success(isEdit ? "Liderança atualizada com sucesso!" : "Liderança cadastrada com sucesso!");
      
      if (!keepOpen) {
        setOpen(false);
        form.reset();
      }
      
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["liderancas"] });
        queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
        queryClient.invalidateQueries({ queryKey: ["eleitores_captados"] });
        queryClient.invalidateQueries({ queryKey: ["cabos_eleitorais"] });
        onSuccess?.();
      }, 150);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("já cadastrado no sistema") || err?.code === "23505") {
        toast.error(msg.replace(/.*Telefone /, "Telefone ").replace(/.*WhatsApp /, "WhatsApp ") || "Telefone já cadastrado no sistema.");
      } else {
        toast.error(msg || "Erro ao salvar liderança");
      }
    } finally {
      setSaving(false);
    }
  }

  const coordOptions = [
    { value: "", label: "Nenhum" },
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
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Liderança
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Liderança" : "Nova Liderança"}</DialogTitle>
        </DialogHeader>
        {isEdit && lideranca && (
          <>
            <CaptacaoLinkPanel
              token={(lideranca as unknown as { token_publico?: string | null }).token_publico ?? null}
              liderancaNome={lideranca.nome}
              totalCaptados={captadosCount}
            />
            <CadastroCaboLinkPanel
              liderancaId={lideranca.id}
              token={(lideranca as unknown as { token_publico?: string | null }).token_publico ?? null}
              liderancaNome={lideranca.nome}
              initialEnabled={Boolean((lideranca as unknown as { permite_cadastro_cabos?: boolean }).permite_cadastro_cabos)}
            />
          </>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => onSubmit(values, false))} className="w-full space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nome da liderança"
                    {...field}
                    onChange={e => { field.onChange(e); checkDuplicateName(e.target.value); }}
                    onBlur={e => { field.onBlur(); checkDuplicateName(e.target.value); }}
                  />
                </FormControl>
                {duplicateNameWarning && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {duplicateNameWarning}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (DDD + número) *</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="(11) 99999-9999"
                      required
                      {...field}
                      onChange={e => { field.onChange(e); checkDuplicatePhone(e.target.value); }}
                      onBlur={e => { field.onBlur(); checkDuplicatePhone(e.target.value); }}
                    />
                  </FormControl>
                  {duplicatePhoneWarning && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {duplicatePhoneWarning}
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

            <FormField control={form.control} name="cidade_base_id" render={({ field }) => {
              const cidadeJaTemLideranca = field.value && existingCidadesBaseIds.includes(field.value) && (!isEdit || lideranca?.cidade_base_id !== field.value);
              return (
                <FormItem>
                  <FormLabel>Cidade Base *</FormLabel>
                  <FormControl>
                    <CidadeBaseSelectList
                      value={field.value}
                      onChange={field.onChange}
                      cidades={cidades}
                    />
                  </FormControl>
                  {cidadeJaTemLideranca && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                      ⚠️ Esta cidade já possui uma liderança cadastrada. Considere usar outra cidade.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }} />

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
                    options={coordOptions.filter(o => o.value !== "")}
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
                  <FormControl>
                    <NativeSelect
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      options={forcaOptions}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <FormControl>
                    <NativeSelect
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      options={statusOptions}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )} />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Dobradinhas Vinculadas</span>
                {selectedCandidateKeys.size > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedCandidateKeys.size} candidato(s) · {totalVotosDob.toLocaleString('pt-BR')} votos
                  </Badge>
                )}
                <DobradinhaFormDialog
                  defaultCidadeId={form.watch("cidade_base_id")}
                  defaultLiderancaId={lideranca?.id}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
                  }}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="ml-auto h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Nova Dobradinha
                    </Button>
                  }
                />
              </div>
              <Input
                placeholder="Buscar candidato..."
                value={dobSearch}
                onChange={e => setDobSearch(e.target.value)}
                className="h-7 text-xs"
              />
              {filteredCandidateGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum candidato cadastrado. Use "Nova Dobradinha" para adicionar.</p>
              ) : (
                <div className="max-h-[45dvh] min-h-40 overflow-y-auto rounded-md border p-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {filteredCandidateGroups.map(g => {
                    const isSelected = selectedCandidateKeys.has(g.key);
                    return (
                      <label
                        key={g.key}
                        className="flex min-h-10 items-start gap-2 rounded px-1 py-1.5 text-sm cursor-pointer hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedCandidateKeys(prev => {
                              const next = new Set(prev);
                              if (next.has(g.key)) next.delete(g.key);
                              else next.add(g.key);
                              return next;
                            });
                          }}
                          className="mt-0.5 shrink-0 rounded border-input"
                        />
                        <span className="min-w-0 flex-1 break-words">
                          {g.candidato}
                          {g.cargo && <span className="text-muted-foreground ml-1">({g.cargo})</span>}
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted-foreground">
                          {g.vinculadasOutrasLid > 0 && `${g.vinculadasOutrasLid} outras lid. · `}
                          {g.totalVotos.toLocaleString('pt-BR')} votos totais
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

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
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => form.handleSubmit((values) => onSubmit(values, true))()}
              >
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
    </Dialog>
  );
}
