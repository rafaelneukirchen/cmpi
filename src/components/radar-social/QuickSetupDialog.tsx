import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Info, Plus } from "lucide-react";
import { PLATAFORMAS, useAddSocialProfile } from "@/hooks/useRadarSocial";
import {
  detectPlatformFromInput,
  extractUsernameFromInput,
  normalizeDraftProfile,
  type DraftSocialProfile,
} from "./profile-utils";

export function QuickSetupDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DraftSocialProfile[]>(() =>
    Array.from({ length: 6 }, () => ({ nome: "", username: "", url: "", plataforma: "instagram" }))
  );
  const addMut = useAddSocialProfile();

  const updateRow = (index: number, field: keyof DraftSocialProfile, value: string) => {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        if (field === "url") {
          const detectedPlatform = detectPlatformFromInput(value);
          const detectedUsername = extractUsernameFromInput(value);

          return {
            ...row,
            url: value,
            plataforma: detectedPlatform || row.plataforma,
            username: row.username || detectedUsername,
          };
        }

        return { ...row, [field]: value };
      })
    );
  };

  const resetRows = () => {
    setRows(Array.from({ length: 6 }, () => ({ nome: "", username: "", url: "", plataforma: "instagram" })));
  };

  const handleSubmit = async () => {
    const filledRows = rows.filter((row) => row.nome.trim() || row.username.trim() || row.url.trim());

    if (filledRows.length === 0) {
      toast.error("Preencha pelo menos um perfil");
      return;
    }

    try {
      const normalizedRows = filledRows.map((row, index) => {
        const normalized = normalizeDraftProfile(row);
        if (!normalized.nome || !normalized.username) {
          throw new Error(`Preencha nome e @usuário ou URL no perfil ${index + 1}`);
        }
        return normalized;
      });

      for (const row of normalizedRows) {
        await addMut.mutateAsync({
          nome: row.nome,
          username: row.username,
          plataforma: row.plataforma,
          url_perfil: row.url || undefined,
        });
      }

      toast.success(`${normalizedRows.length} perfil(is) adicionados. Agora você já pode registrar métricas manualmente.`);
      resetRows();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar perfis");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Cadastro rápido (6 perfis)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>Cadastro rápido dos 6 perfis iniciais</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Modo simples</AlertTitle>
            <AlertDescription>
              Cadastre nome, @ e URL. Se a rede bloquear a leitura automática, abra o perfil e registre seguidores, posts e engajamento manualmente.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((row, index) => (
              <div key={index} className="space-y-3 rounded-lg border bg-card p-3">
                <div className="text-xs font-medium text-muted-foreground">Perfil {index + 1}</div>

                <div>
                  <Label>Nome</Label>
                  <Input
                    value={row.nome}
                    onChange={(e) => updateRow(index, "nome", e.target.value)}
                    placeholder="Ex: Tarcísio de Freitas"
                  />
                </div>

                <div>
                  <Label>@usuário</Label>
                  <Input
                    value={row.username}
                    onChange={(e) => updateRow(index, "username", e.target.value)}
                    placeholder="@usuario"
                  />
                </div>

                <div>
                  <Label>URL do perfil</Label>
                  <Input
                    value={row.url}
                    onChange={(e) => updateRow(index, "url", e.target.value)}
                    placeholder="https://www.instagram.com/..."
                  />
                </div>

                <div>
                  <Label>Plataforma</Label>
                  <NativeSelect
                    value={row.plataforma}
                    onChange={(e) => updateRow(index, "plataforma", e.target.value)}
                    options={PLATAFORMAS.map((platform) => ({
                      value: platform.key,
                      label: `${platform.icon} ${platform.label}`,
                    }))}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleSubmit} disabled={addMut.isPending} className="w-full">
            {addMut.isPending ? "Salvando perfis..." : "Salvar perfis iniciais"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}