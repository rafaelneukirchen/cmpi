import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIMITE_SANTINHOS = 10;
const jsonError = (error: string) =>
  new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "Chave de IA não configurada." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identifica o usuário logado e aplica o limite de criações (admin sem limite)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Você precisa estar logado para gerar o santinho.");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) return jsonError("Sessão inválida. Entre novamente no sistema.");
    const userId = claimsData.claims.sub as string;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      const { count, error: countError } = await supabase
        .from("santinho_geracoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (countError) {
        console.error("Erro ao contar geracoes", countError);
        return jsonError("Não foi possível verificar o seu limite. Tente novamente.");
      }
      if ((count ?? 0) >= LIMITE_SANTINHOS) {
        return jsonError("Seu limite de criação de santinho acabou. Fale com o administrador do sistema para liberar mais criações.");
      }
    }

    const { templateImage, candidatoImage, userImage } = await req.json();
    if (!templateImage || !userImage) {
      return new Response(JSON.stringify({ success: false, error: "Imagens obrigatórias ausentes." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você recebe 3 imagens:
1) A arte oficial do santinho de campanha (fundo azul, faixas, bandeira de São Paulo, textos e números dos candidatos, ponte estaiada). MANTENHA esta arte EXATAMENTE igual: mesmos textos, números, cores, posições, fotos redondas dos candidatos e layout. Não altere, não redesenhe e não reescreva nada. As fotos dos candidatos devem permanecer IDÊNTICAS às originais (recorte/cópia fiel, sem reinterpretação por IA).
2) A foto do deputado estadual Felipe Carmona (homem de barba, terno preto e camisa branca).
3) A foto enviada pelo apoiador.

Tarefa: preencher a GRANDE ÁREA VAZIA do lado DIREITO da arte colocando Felipe Carmona (imagem 2) e a pessoa da imagem 3 lado a lado.

ÁREA EXATA A PREENCHER (tamanho FIXO, obrigatório):
- A área vazia ocupa TODO o lado direito da arte: começa logo abaixo do texto "NOSSA COLINHA!" (topo) e termina logo acima do texto "POR UMA SP MAIS FORTE!" (base). Em coordenadas aproximadas da imagem: de 45% a 95% da largura, e de 18% a 78% da altura.
- É uma área GRANDE — as duas fotos JUNTAS devem ocupar TODO esse espaço, sem sobrar área vazia. NÃO faça fotos pequenas. NÃO centralize deixando margens. As fotos devem ser GRANDES e preencher a área de ponta a ponta.
- TAMANHO FIXO: as duas fotos combinadas devem cobrir toda essa área. Use metade da largura da área para cada pessoa. As fotos devem ser grandes o suficiente para que as pessoas apareçam do peito/cintura para cima (ou corpo inteiro se couber), ocupando o máximo do espaço disponível.

 POSIÇÃO FIXA (não pode ser alterada):
- Felipe Carmona SEMPRE na metade esquerda e a pessoa enviada SEMPRE na metade direita. Os dois devem ficar LADO A LADO, bem próximos, ombro com ombro, olhando para a câmera e com os rostos no mesmo plano visual.
- Felipe Carmona fica apenas LIGEIRAMENTE à frente: diferença mínima de profundidade, equivalente a poucos centímetros. A pessoa enviada NÃO pode parecer distante, menor, recuada para o fundo ou posicionada atrás do ombro de Felipe.
- A pessoa enviada deve ficar ao lado direito de Felipe, com o ombro interno tocando ou sobrepondo muito levemente o ombro direito de Felipe. Ambos devem ter tamanho corporal semelhante e ocupar juntos toda a largura disponível.
- Sobreposição fixa e discreta: somente a borda do ombro direito de Felipe pode ficar sobre a borda do ombro esquerdo da pessoa enviada. Nunca cobrir rosto, pescoço, tronco ou mais de 8% da largura da pessoa enviada.
- Não mova, não troque de lado, não sobreponha às fotos redondas dos candidatos da coluna esquerda, não invada os textos "NOSSA COLINHA!", "POR UMA SP MAIS FORTE!", os números, faixas azuis ou a bandeira.
- Ajuste APENAS escala uniforme, alinhamento vertical e recorte para preencher a área. Fixe os olhos das duas pessoas na mesma altura, cabeças com tamanho semelhante, ombros na mesma linha e base dos corpos na mesma linha. Não altere perspectiva, distância da câmera ou pose.

REGRAS OBRIGATÓRIAS DE FIDELIDADE E PROFUNDIDADE:
- CAMADAS: Felipe Carmona (imagem 2) DEVE estar na camada superior somente na pequena interseção dos ombros. A pessoa enviada (imagem 3) fica na camada inferior nessa interseção, mas permanece ao lado, igualmente próxima da câmera e plenamente visível. Eles parecem estar juntos na mesma linha, e não um atrás do outro. NUNCA coloque a pessoa enviada à frente de Felipe Carmona.
- PADRÃO INVARIÁVEL: em toda geração, mantenha exatamente esta distribuição — Felipe à esquerda ocupando cerca de 52% da área das pessoas e a pessoa enviada à direita ocupando cerca de 48%; rostos alinhados, escala equivalente, distância mínima entre os ombros e profundidade quase igual. Não improvise outra composição.
- Trate as imagens 2 e 3 como RECORTES FOTOGRÁFICOS REAIS: apenas remova o fundo e cole na arte. NÃO redesenhe, NÃO estilize, NÃO "melhore", NÃO suavize a pele, NÃO altere traços, formato do rosto, nariz, boca, olhos, sobrancelhas, barba, cabelo, óculos, idade, peso, tom de pele ou expressão. O rosto de cada pessoa deve ser pixel a pixel reconhecível como o original.
- NÃO gere rostos novos, NÃO faça "beautify", NÃO mude o ângulo da cabeça nem a pose. Use exatamente o enquadramento das fotos originais.
- Mantenha as roupas exatamente como nas fotos originais.
- PROPORÇÕES REAIS: as duas pessoas devem ter escala humana coerente entre si — mesma linha de horizonte, olhos na mesma altura, cabeças com dimensões semelhantes e tamanho de corpo natural. A pessoa enviada deve ter entre 90% e 100% da altura aparente de Felipe. Nada de cabeça grande demais, corpo esticado, pessoa gigante, pequena ou recuada. Se necessário para preencher a área, mostre ambos do peito para cima com o mesmo enquadramento.
- A integração deve ser sutil: apenas ajuste leve de brilho/sombra na borda do recorte para o encaixe parecer natural. Nenhuma outra edição.
- As faixas e ondas azuis da arte podem passar levemente sobre a base da composição.

Saída: um único santinho vertical, no mesmo formato e proporção da imagem 1, em altíssima resolução, textos e números perfeitamente legíveis, sem borrões, sem artefatos, sem marcas d'água e sem textos novos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: templateImage } },
              ...(candidatoImage ? [{ type: "image_url", image_url: { url: candidatoImage } }] : []),
              { type: "image_url", image_url: { url: userImage } },
            ],
          },
        ],
        modalities: ["image", "text"],
        image_config: { image_size: "4K" },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Erro do gateway de IA", response.status, text);
      let msg = "Não foi possível gerar o santinho agora. Tente novamente.";
      if (response.status === 429) msg = "Muitas solicitações no momento. Aguarde alguns segundos e tente de novo.";
      if (response.status === 402) msg = "Créditos de IA esgotados. Fale com o administrador.";
      if (response.status === 403) msg = "O limite de créditos de IA do espaço foi atingido. Peça ao administrador para aumentar o limite.";
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("Resposta sem imagem", JSON.stringify(json).slice(0, 500));
      return new Response(JSON.stringify({ success: false, error: "A IA não retornou uma imagem. Tente outra foto." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      const { error: insertError } = await supabase.from("santinho_geracoes").insert({ user_id: userId });
      if (insertError) console.error("Erro ao registrar geracao", insertError);
    }

    return new Response(JSON.stringify({ success: true, image: `data:image/png;base64,${b64}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Falha inesperada", e);
    return new Response(JSON.stringify({ success: false, error: "Falha inesperada ao gerar o santinho." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
