import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSolicitacoesAlerta } from "@/hooks/useSolicitacoesAlerta";

export function SolicitacoesAlertBell() {
  const { pendentes, isAdmin } = useSolicitacoesAlerta();
  const navigate = useNavigate();

  if (!isAdmin) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      title="Solicitações de material pendentes"
      onClick={() => navigate("/log-solicitacoes")}
    >
      <Bell className="h-4 w-4" />
      {pendentes > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {pendentes > 99 ? "99+" : pendentes}
        </span>
      )}
    </Button>
  );
}
