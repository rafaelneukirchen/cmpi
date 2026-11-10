import { useState, useEffect, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Vote, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type AuthView = "login" | "signup" | "forgot";

const Auth = forwardRef<HTMLDivElement>(function Auth(_props, _ref) {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (view === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      } else if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Email enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });
        setView("login");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const title = view === "login" ? "Entrar no sistema" : view === "signup" ? "Criar conta" : "Recuperar senha";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return null;
  }

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
          <p className="text-sm text-muted-foreground">Plataforma de Planejamento Estratégico</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-center">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              {view !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
              )}
              <Button type="submit" className="w-full electoral-gradient text-white border-0" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {view === "login" ? "Entrar" : view === "signup" ? "Criar conta" : "Enviar email de recuperação"}
              </Button>
            </form>
            <div className="mt-4 text-center space-y-2">
              {view === "login" && (
                <>
                  <button className="text-sm text-primary hover:underline block w-full" onClick={() => setView("forgot")}>
                    Esqueceu sua senha?
                  </button>
                  <button className="text-sm text-primary hover:underline block w-full" onClick={() => setView("signup")}>
                    Não tem conta? Criar agora
                  </button>
                </>
              )}
              {view === "signup" && (
                <button className="text-sm text-primary hover:underline" onClick={() => setView("login")}>
                  Já tem conta? Entrar
                </button>
              )}
              {view === "forgot" && (
                <button className="text-sm text-primary hover:underline inline-flex items-center gap-1" onClick={() => setView("login")}>
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default Auth;
