import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Users, ArrowUpCircle } from "lucide-react";
import LiderancaFormDialog from "@/components/LiderancaFormDialog";

export interface ContatoMatch {
  origem: "eleitor_captado" | "lideranca" | "cabo_eleitoral";
  id?: string | null;
  nome: string;
  telefone?: string | null;
  whatsapp?: string | null;
  bairro?: string | null;
  cidade_id?: string | null;
  cidade_nome?: string | null;
  observacoes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: ContatoMatch | null;
  /** Called when user chooses to promote to Cabo — parent should pre-fill its cabo form and keep it open. */
  onPromoteToCabo: (match: ContatoMatch) => void;
  /** Called when the user finished creating a Líder (so the parent cabo dialog can close). */
  onLiderCreated?: () => void;
}

const origemLabel: Record<ContatoMatch["origem"], string> = {
  eleitor_captado: "Eleitor Captado",
  lideranca: "Liderança",
  cabo_eleitoral: "Cabo Eleitoral",
};

export default function PromoverContatoDialog({ open, onOpenChange, match, onPromoteToCabo, onLiderCreated }: Props) {
  const [liderOpen, setLiderOpen] = useState(false);

  if (!match) return null;

  const initialLideranca = {
    nome: match.nome,
    telefone: match.telefone || null,
    whatsapp: match.whatsapp || match.telefone || null,
    cidade_base_id: match.cidade_id || null,
    bairros: match.bairro ? [match.bairro] : [],
    observacoes: match.observacoes || null,
  } as any;

  return (
    <>
      <Dialog open={open && !liderOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-primary" />
              Contato já existe no sistema
            </DialogTitle>
            <DialogDescription>
              Encontramos este contato em outro cadastro. Escolha como deseja promovê-lo.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground truncate">{match.nome}</span>
              <Badge variant="secondary" className="shrink-0">{origemLabel[match.origem]}</Badge>
            </div>
            {match.telefone && <p className="text-xs text-muted-foreground">📱 {match.telefone}</p>}
            {(match.cidade_nome || match.bairro) && (
              <p className="text-xs text-muted-foreground">
                📍 {[match.bairro, match.cidade_nome].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              onClick={() => {
                onPromoteToCabo(match);
                onOpenChange(false);
              }}
            >
              <UserPlus className="h-4 w-4 mr-2 shrink-0" />
              <div className="text-left">
                <div className="font-medium text-sm">Promover a Cabo</div>
                <div className="text-[11px] text-muted-foreground">Preenche o formulário atual</div>
              </div>
            </Button>
            <Button
              className="justify-start h-auto py-3"
              onClick={() => setLiderOpen(true)}
            >
              <Users className="h-4 w-4 mr-2 shrink-0" />
              <div className="text-left">
                <div className="font-medium text-sm">Promover a Líder</div>
                <div className="text-[11px] opacity-90">Abre cadastro de liderança</div>
              </div>
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>

      <LiderancaFormDialog
        initialData={initialLideranca}
        promoteSource={match.id ? { origem: match.origem, id: match.id } : undefined}
        open={liderOpen}
        onOpenChange={(o) => {
          setLiderOpen(o);
          if (!o) {
            onOpenChange(false);
          }
        }}
        onSuccess={() => {
          setLiderOpen(false);
          onOpenChange(false);
          onLiderCreated?.();
        }}
      />
    </>
  );
}
