import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, Users, Copy } from "lucide-react";
import { toast } from "sonner";
import { REGIONS } from "@/types/campaign";

interface CoordInfo {
  nome: string;
  cidade_nome: string | null;
  tipo: "lideranca" | "usuario";
}

export default function CadastroEquipe() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [coord, setCoord] = useState<CoordInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [regiao, setRegiao] = useState("");

  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    document.title = "Cadastro de Equipe — Coordenação";
    (async () => {
      // Se já estiver logado, vai direto para o app
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        navigate("/");
        return;
      }
      const { data, error } = await supabase.rpc("get_captador_publico" as never, { p_token: token } as never);
      const rows = data as unknown as CoordInfo[] | null;
      if (error || !rows || rows.length === 0 || rows[0].tipo !== "usuario") {
        setError("Link inválido ou expirado. Solicite um novo ao coordenador.");
      } else {
        setCoord(rows[0]);
      }
      setLoading(false);
    })();
  }, [token, navigate]);

  function formatPhone(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = telefone.replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Telefone precisa ter 11 dígitos (DDD + número).");
      return;
    }
    if (!nome.trim() || !regiao) {
      toast.error("Preencha todos os campos.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-equipe-membro", {
        body: { token, nome: nome.trim(), telefone: digits, regiao },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Erro ao cadastrar.");
        return;
      }
      // Já cadastrado anteriormente → login automático e segue para o app
      if (data.already_registered) {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signErr) {
          // Fallback: mostra credenciais para entrar manualmente
          setCredentials({ email: data.email, password: data.password });
          toast.message("Você já tem cadastro. Use os dados de acesso abaixo.");
          return;
        }
        toast.success("Bem-vindo(a) de volta!");
        navigate("/");
        return;
      }
      setCredentials({ email: data.email, password: data.password });
      toast.success("Cadastro realizado!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro inesperado.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function loginAndGo() {
    if (!credentials) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível fazer login: " + error.message);
      return;
    }
    toast.success("Bem-vindo(a)! Ative o GPS na próxima tela.");
    navigate("/");
  }

  function copyText(t: string) {
    navigator.clipboard.writeText(t);
    toast.success("Copiado!");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Link inválido</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (credentials) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Cadastro concluído!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Guarde seus dados de acesso. Você vai precisar para entrar pelo celular e ativar o rastreamento da equipe.
            </p>
            <div className="space-y-2 p-3 rounded-md border bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-mono font-semibold break-all">{credentials.email}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyText(credentials.email)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Senha</div>
                  <div className="font-mono font-semibold">{credentials.password}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyText(credentials.password)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={loginAndGo} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Entrar e ativar GPS
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Cadastro de Equipe
          </CardTitle>
          {coord && (
            <p className="text-sm text-muted-foreground">
              Coordenação: <span className="font-medium text-foreground">{coord.nome}</span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone (com DDD) *</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                placeholder="(11) 91234-5678"
                inputMode="tel"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">11 dígitos (DDD + celular).</p>
            </div>
            <div>
              <Label htmlFor="regiao">Região de atuação *</Label>
              <NativeSelect
                id="regiao"
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                required
                options={[
                  { value: "", label: "Selecione..." },
                  ...REGIONS.map((r) => ({ value: r, label: r })),
                ]}
              />
            </div>
            <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs space-y-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">📍 Rastreamento por GPS</p>
              <p className="text-amber-800 dark:text-amber-300">
                Ao concluir o cadastro, será solicitado o aceite do rastreamento por GPS para que o coordenador acompanhe a equipe em tempo real.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Concluir cadastro
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
