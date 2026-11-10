import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Vote, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const forced = searchParams.get("forced") === "1";

  useEffect(() => {
    // listener mantido apenas para garantir o estado da sessão em fluxo de recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        toast({
          title: "Sessão expirada",
          description: "Entre novamente com a senha padrão e crie a nova senha em seguida.",
          variant: "destructive",
        });
        try { await supabase.auth.signOut({ scope: "local" }); } catch {}
        navigate("/auth", { replace: true });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        // Senha fraca / vazada (HIBP)
        if (
          msg.includes("weak") ||
          msg.includes("pwned") ||
          msg.includes("known to be") ||
          msg.includes("easy to guess") ||
          msg.includes("compromised")
        ) {
          toast({
            title: "Senha muito fraca",
            description:
              "Essa senha é muito comum e já apareceu em vazamentos. Escolha uma senha com pelo menos 8 caracteres, misturando letras maiúsculas, minúsculas, números e símbolos (ex.: Minh@Senha2026).",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        // Nova senha igual à atual
        if (msg.includes("should be different") || msg.includes("same as the old") || msg.includes("same_password")) {
          toast({
            title: "Senha inválida",
            description: "A nova senha precisa ser diferente da senha atual.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        // Sessão inválida/expirada: pedir login novamente
        if (msg.includes("session") || (error as any).status === 403 || (error as any).status === 401) {
          toast({
            title: "Sessão expirada",
            description: "Faça login novamente com a senha padrão para redefinir sua senha.",
            variant: "destructive",
          });
          try { await supabase.auth.signOut({ scope: "local" }); } catch {}
          navigate("/auth", { replace: true });
          return;
        }
        throw error;
      }

      // Limpa a marca de "precisa trocar senha" se houver usuário logado
      try {
        await supabase
          .from("profiles")
          .update({ must_change_password: false } as any)
          .eq("user_id", userData.user.id);
      } catch {}

      setSuccess(true);
      // Desloga e força novo login com a nova senha (evita cache de sessão antiga)
      setTimeout(async () => {
        try { await supabase.auth.signOut({ scope: "local" }); } catch {}
        navigate("/auth", { replace: true });
      }, 1500);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl electoral-gradient shadow-lg">
              <Vote className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Inteligência Eleitoral</h1>
          <p className="text-sm text-muted-foreground">
            {forced ? "Defina sua nova senha de acesso" : "Redefinição de senha"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-center">
              {success ? "Senha atualizada!" : forced ? "Crie uma nova senha" : "Nova senha"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-sm text-muted-foreground">Sua senha foi alterada com sucesso. Faça login novamente com a nova senha...</p>
              </div>
            ) : (
              <>
                {forced && (
                  <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>
                      Sua senha foi redefinida pelo administrador. Para continuar, crie uma nova senha pessoal.
                    </p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova senha</Label>
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                    <p className="text-xs text-muted-foreground">
                      Use pelo menos 8 caracteres com letras maiúsculas, minúsculas, números e símbolos. Evite senhas comuns como "123456" ou "senha123".
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} />
                  </div>
                  <Button type="submit" className="w-full electoral-gradient text-white border-0" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Redefinir senha
                  </Button>
                  {forced && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
                    >
                      Sair
                    </Button>
                  )}
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
