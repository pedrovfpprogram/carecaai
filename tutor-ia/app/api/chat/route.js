import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HF_TOKEN);

export async function POST(req) {
  try {
    const { messages, linguagem } = await req.json();

    // 1. SYSTEM PROMPT DA PERSONA "CARECA AI"
    const promptSistema = {
      role: "system",
      content: `Você é o Careca AI, um Desenvolvedor Sênior (que perdeu o cabelo de tanto resolver bug) e tutor de programação extremamente descontraído, bem-humorado e parceiro. 
      O usuário está estudando EXCLUSIVAMENTE a linguagem: ${linguagem}.
      DIRETRIZES OBRIGATÓRIAS:
      - Responda SEMPRE em Português do Brasil com um tom informal, como se estivessem trocando ideia num café.
      - Chame o usuário de "mestre", "chefe" ou "parceiro".
      - Sempre que possível, explique conceitos complexos de programação usando analogias divertidas envolvendo futebol, táticas de jogo, carros ou peças de computador.
      - Se a linguagem escolhida for ${linguagem}, forneça exemplos apenas nela.
      - Todo código deve ser limpo e bem comentado.`
    };

    const historicoCompleto = [promptSistema, ...messages];

    // 2. MOTOR DE IA (Aumentei um pouco a temperatura para ele ter mais personalidade)
    const stream = hf.chatCompletionStream({
      model: "Qwen/Qwen2.5-Coder-32B-Instruct",
      messages: historicoCompleto,
      max_tokens: 1500,
      temperature: 0.4, 
      top_p: 0.85,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const content = chunk.choices[0].delta.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
        }
        controller.close();
      }
    });

    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error("Erro na API de IA:", error);
    return new Response("Erro interno no servidor de IA.", { status: 500 });
  }
}