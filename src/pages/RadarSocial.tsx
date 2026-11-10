import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radar } from "lucide-react";
import { InstagramWidget } from "@/components/InstagramWidget";
import { InstagramInsightsPanel } from "@/components/radar-social/InstagramInsightsPanel";
import { InstagramStatusAgora } from "@/components/radar-social/InstagramStatusAgora";
import { InstagramMentionsPanel } from "@/components/radar-social/InstagramMentionsPanel";
import { InstagramCompetitorsPanel } from "@/components/radar-social/InstagramCompetitorsPanel";

export default function RadarSocial() {
  const [tab, setTab] = useState("relatorio");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radar className="h-6 w-6 text-primary" /> Radar Social — Meu Perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Análise completa do Instagram: engajamento do dia, visão geral, interagentes e monitoramento
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="relatorio">📊 Instagram — Relatório</TabsTrigger>
          <TabsTrigger value="comparativo">🏆 Comparativo</TabsTrigger>
          <TabsTrigger value="mencoes">@ Menções</TabsTrigger>
          <TabsTrigger value="instagram">📸 Meu Instagram</TabsTrigger>
        </TabsList>

        <TabsContent value="relatorio" className="mt-4">
          <InstagramInsightsPanel />
        </TabsContent>

        <TabsContent value="comparativo" className="mt-4">
          <InstagramCompetitorsPanel />
        </TabsContent>




        <TabsContent value="mencoes" className="mt-4">
          <InstagramMentionsPanel />
        </TabsContent>

        <TabsContent value="instagram" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InstagramWidget />
            <InstagramStatusAgora />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
