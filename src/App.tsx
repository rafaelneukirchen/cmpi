import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isTransientError } from "@/lib/retry";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DashboardUnificado from "./pages/DashboardUnificado";
import MapaEleitoral from "./pages/MapaEleitoral";
import Cidades from "./pages/Cidades";
import Liderancas from "./pages/Liderancas";
import Projecoes from "./pages/Projecoes";
import Estrutura from "./pages/Estrutura";
import Agenda from "./pages/Agenda";
import Visitas from "./pages/Visitas";
import Relatorios from "./pages/Relatorios";
import RelatorioCidadesRepresentadas from "./pages/RelatorioCidadesRepresentadas";
import RelatorioMetaCaptacao from "./pages/RelatorioMetaCaptacao";
import RelatorioPlanejamentoCampo from "./pages/RelatorioPlanejamentoCampo";
import RelatorioBairrosCidades from "./pages/RelatorioBairrosCidades";
import RelatorioConferenciaLeads from "./pages/RelatorioConferenciaLeads";
import Usuarios from "./pages/Usuarios";
import Dobradinhas from "./pages/Dobradinhas";
import Configuracoes from "./pages/Configuracoes";
import Arquivo from "./pages/Arquivo";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import RadarSocial from "./pages/RadarSocial";
// Logistics pages
import LogDashboard from "./pages/LogDashboard";
import LogMateriais from "./pages/LogMateriais";
import LogEstoque from "./pages/LogEstoque";
import LogDistribuicao from "./pages/LogDistribuicao";
import LogSolicitacoes from "./pages/LogSolicitacoes";
import LogPlanejamento from "./pages/LogPlanejamento";
import LogItinerario from "./pages/LogItinerario";
import LogFinanceiro from "./pages/LogFinanceiro";
import LogAuditoria from "./pages/LogAuditoria";
import LogRelatorios from "./pages/LogRelatorios";
import InteligenciaCampanha from "./pages/InteligenciaCampanha";
import RastreamentoEquipe from "./pages/RastreamentoEquipe";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
import Landing from "./pages/Landing";
import CaptarEleitor from "./pages/CaptarEleitor";
import CadastroEquipe from "./pages/CadastroEquipe";
import CadastroCaboCaptador from "./pages/CadastroCaboCaptador";
import Leads from "./pages/Leads";
import EleitoresCaptados from "./pages/EleitoresCaptados";
import ContatoCoordenacao from "./pages/ContatoCoordenacao";
import AdminVendas from "./pages/AdminVendas";
import Apresentacao from "./pages/Apresentacao";
import LeadsCentralizados from "./pages/LeadsCentralizados";
import MapaPublico from "./pages/MapaPublico";
import CampoPlanejamento from "./pages/CampoPlanejamento";
import CampoExecucao from "./pages/CampoExecucao";
import CampoPainel from "./pages/CampoPainel";
import WhatsAppEnvio from "./pages/WhatsAppEnvio";
import Santinho from "./pages/Santinho";
import { useApplyBranding } from "@/hooks/useApplyBranding";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry up to 3x on transient errors (503/504/429/network) with exponential backoff
      retry: (failureCount, error) => {
        if (failureCount >= 3) return false;
        return isTransientError(error);
      },
      retryDelay: (attempt) =>
        Math.min(500 * 2 ** attempt, 8000) + Math.random() * 300,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        return isTransientError(error);
      },
      retryDelay: (attempt) =>
        Math.min(500 * 2 ** attempt, 8000) + Math.random() * 300,
    },
  },
});

function AppRoutes() {
  const location = useLocation();
  useApplyBranding();

  useEffect(() => {
    document.documentElement.setAttribute("lang", "pt-BR");
    document.documentElement.setAttribute("translate", "no");
    document.documentElement.classList.add("notranslate");
    document.body.setAttribute("translate", "no");
    document.body.classList.add("notranslate");

    const protectPortalNodes = () => {
      document
        .querySelectorAll<HTMLElement>("[data-radix-portal], [data-radix-popper-content-wrapper]")
        .forEach((node) => {
          if (node.parentNode && node.parentNode !== document.body) {
            document.body.appendChild(node);
          }
        });

      document
        .querySelectorAll<HTMLElement>(
          "[data-radix-portal], [data-radix-popper-content-wrapper], [role='dialog'], [role='tooltip']",
        )
        .forEach((node) => {
          node.setAttribute("translate", "no");
          node.classList.add("notranslate");
        });
    };

    protectPortalNodes();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(protectPortalNodes);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <ErrorBoundary locationKey={location.key}>
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/captar/:token" element={<CaptarEleitor />} />
        <Route path="/equipe/cadastro/:token" element={<CadastroEquipe />} />
        <Route path="/mapa-publico/:token" element={<MapaPublico />} />
        <Route path="/cabo/cadastro/:token" element={<CadastroCaboCaptador />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardUnificado />} />
          <Route path="/dashboard-eleitoral" element={<Dashboard />} />
          <Route path="/mapa" element={<MapaEleitoral />} />
          <Route path="/cidades" element={<Cidades />} />
          <Route path="/liderancas" element={<Liderancas />} />
          <Route path="/projecoes" element={<Projecoes />} />
          <Route path="/dobradinhas" element={<Dobradinhas />} />
          <Route path="/estrutura" element={<Estrutura />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/visitas" element={<Visitas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/relatorios/cidades-representadas" element={<RelatorioCidadesRepresentadas />} />
          <Route path="/relatorios/meta-captacao" element={<RelatorioMetaCaptacao />} />
          <Route path="/relatorios/planejamento-campo" element={<RelatorioPlanejamentoCampo />} />
          <Route path="/relatorios/bairros-cidades" element={<RelatorioBairrosCidades />} />
          <Route path="/relatorios/conferencia-leads" element={<RelatorioConferenciaLeads />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/eleitores-captados" element={<EleitoresCaptados />} />
          <Route path="/contato-coordenacao" element={<ContatoCoordenacao />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/arquivo" element={<Arquivo />} />
          {/* Logistics routes */}
          <Route path="/log-dashboard" element={<LogDashboard />} />
          <Route path="/log-materiais" element={<LogMateriais />} />
          <Route path="/log-estoque" element={<LogEstoque />} />
          <Route path="/log-distribuicao" element={<LogDistribuicao />} />
          <Route path="/log-solicitacoes" element={<LogSolicitacoes />} />
          <Route path="/log-planejamento" element={<LogPlanejamento />} />
          <Route path="/log-itinerario" element={<LogItinerario />} />
          <Route path="/log-financeiro" element={<LogFinanceiro />} />
          <Route path="/log-auditoria" element={<LogAuditoria />} />
          <Route path="/log-relatorios" element={<LogRelatorios />} />
          <Route path="/radar-social" element={<RadarSocial />} />
          <Route path="/inteligencia" element={<InteligenciaCampanha />} />
          <Route path="/rastreamento" element={<RastreamentoEquipe />} />
          <Route path="/campo-planejamento" element={<CampoPlanejamento />} />
          <Route path="/campo-execucao" element={<CampoExecucao />} />
          <Route path="/campo-painel" element={<CampoPainel />} />
          <Route path="/whatsapp" element={<WhatsAppEnvio />} />
          <Route path="/santinho" element={<Santinho />} />
          <Route path="/admin-vendas" element={<AdminVendas />} />
          <Route path="/leads-centralizados" element={<LeadsCentralizados />} />
          <Route path="/apresentacao" element={<Apresentacao />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
