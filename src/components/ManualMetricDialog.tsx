import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Edit3 } from "lucide-react";
import { useManualMetricInsert, type SocialProfile } from "@/hooks/useRadarSocial";

interface Props {
  profile: SocialProfile;
  trigger?: React.ReactNode;
}

export default function ManualMetricDialog({ profile, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [seguidores, setSeguidores] = useState(String(profile.latest_metrics?.seguidores || ""));
  const [totalPosts, setTotalPosts] = useState(String(profile.latest_metrics?.total_posts || ""));
  const [engajamento, setEngajamento] = useState(String(profile.latest_metrics?.engajamento || ""));
  const insertMut = useManualMetricInsert();

  const handleSubmit = async () => {
    const seg = parseInt(seguidores) || 0;
    if (seg === 0) {
      toast.error("Informe pelo menos o número de seguidores");
      return;
    }
    try {
      await insertMut.mutateAsync({
        profile_id: profile.id,
        seguidores: seg,
        total_posts: parseInt(totalPosts) || 0,
        engajamento: parseFloat(engajamento) || 0,
      });
      toast.success("Métricas registradas com sucesso!");
      setOpen(false);
    } catch {
      toast.error("Erro ao salvar métricas");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <Edit3 className="h-4 w-4 mr-1" /> Registrar Dados
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Métricas — @{profile.username}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Insira os dados que você observou no perfil do Instagram. Acesse o perfil, anote os números e registre aqui.
        </p>
        {profile.url_perfil || profile.plataforma === "instagram" ? (
          <a
            href={profile.url_perfil || `https://www.instagram.com/${profile.username}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            → Abrir perfil no Instagram para consultar dados
          </a>
        ) : null}
        <div className="space-y-4 mt-2">
          <div>
            <Label>Seguidores *</Label>
            <Input
              type="number"
              value={seguidores}
              onChange={(e) => setSeguidores(e.target.value)}
              placeholder="Ex: 125000"
            />
          </div>
          <div>
            <Label>Total de Posts</Label>
            <Input
              type="number"
              value={totalPosts}
              onChange={(e) => setTotalPosts(e.target.value)}
              placeholder="Ex: 340"
            />
          </div>
          <div>
            <Label>Taxa de Engajamento (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={engajamento}
              onChange={(e) => setEngajamento(e.target.value)}
              placeholder="Ex: 3.5"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Dica: (curtidas + comentários) ÷ seguidores × 100
            </p>
          </div>
          <Button onClick={handleSubmit} disabled={insertMut.isPending} className="w-full">
            {insertMut.isPending ? "Salvando..." : "Salvar Métricas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
