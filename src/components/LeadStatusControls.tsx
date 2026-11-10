import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, HelpCircle, StickyNote, Save, Trash2 } from "lucide-react";
import { useLeadStatus, phoneKey, type ConfirmStatus } from "@/hooks/useLeadStatus";
import { useCanSendWhatsApp } from "@/hooks/useUserPermissions";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Props {
  phone: string | null;
  nome: string;
  compact?: boolean;
}

export function LeadStatusControls({ phone, nome, compact }: Props) {
  const { confirmMap, obsMap, cycleConfirm, setObs } = useLeadStatus();
  const canManage = useCanSendWhatsApp();
  const k = phoneKey(phone);
  const status = k ? confirmMap[k] : undefined;
  const obs = k ? obsMap[k] : "";
  const [obsOpen, setObsOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const handleCycle = async () => {
    if (!k) { toast.error("Contato sem telefone"); return; }
    const next = await cycleConfirm(phone);
    toast.success(
      next === "confirmado" ? "Marcado como confirmado" :
      next === "nao_confirmado" ? "Marcado como não confirmado" :
      "Status removido"
    );
  };


  const openObs = () => {
    if (!k) { toast.error("Contato sem telefone"); return; }
    setDraft(obs || "");
    setObsOpen(true);
  };

  const saveObs = () => {
    setObs(phone, draft);
    setObsOpen(false);
    toast.success(draft.trim() ? "Observação salva" : "Observação removida");
  };

  const Icon = status === "confirmado" ? CheckCircle2 : status === "nao_confirmado" ? XCircle : HelpCircle;
  const label = status === "confirmado" ? "Confirmado" : status === "nao_confirmado" ? "Não confirmado" : "Sem resposta";
  const cls = status === "confirmado"
    ? "text-green-700 border-green-300 bg-green-50 hover:bg-green-100"
    : status === "nao_confirmado"
    ? "text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
    : "text-muted-foreground";

  if (!canManage) {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] gap-1 ${
          status === "confirmado"
            ? "text-green-700 border-green-300 bg-green-50"
            : status === "nao_confirmado"
            ? "text-red-700 border-red-300 bg-red-50"
            : "opacity-60"
        }`}
        title="Somente usuários autorizados podem alterar o status ou anotar observações"
      >
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  }

  return (
    <>
      <Button

        size="sm"
        variant="outline"
        className={`gap-1.5 h-8 ${cls}`}
        title="Clique para alternar: Sem resposta → Confirmado → Não confirmado"
        onClick={handleCycle}
      >
        <Icon className="h-3.5 w-3.5" />
        {!compact && <span className="hidden sm:inline">{label}</span>}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`gap-1.5 h-8 ${obs ? "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100" : "text-muted-foreground"}`}
        title={obs ? `Observação: ${obs}` : "Adicionar observação"}
        onClick={openObs}
      >
        <StickyNote className="h-3.5 w-3.5" />
        {!compact && <span className="hidden sm:inline">{obs ? "Obs." : "Nota"}</span>}
      </Button>

      <Dialog open={obsOpen} onOpenChange={setObsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Observação · {nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              rows={5}
              placeholder="Anote aqui o que conversou, próximo passo, dúvidas, etc."
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground text-right">{draft.length}/1000</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {obs && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive gap-1.5 mr-auto"
                onClick={() => { setObs(phone, ""); setObsOpen(false); toast.success("Observação removida"); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setObsOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveObs} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LeadObsBadge({ phone }: { phone: string | null }) {
  const { obsMap, obsAuthorMap, obsAuthorNames } = useLeadStatus();
  const k = phoneKey(phone);
  const obs = k ? obsMap[k] : "";
  const autorId = k ? obsAuthorMap[k] : undefined;
  const autor = autorId ? obsAuthorNames[autorId] : undefined;
  if (!obs) return null;
  return (
    <p className="text-xs text-amber-700 mt-1 italic border-l-2 border-amber-400 pl-2 bg-amber-50/50 rounded-r">
      <StickyNote className="inline h-3 w-3 mr-1" />{obs}
      {autor && <span className="not-italic font-medium ml-1">— por {autor}</span>}
    </p>
  );
}

