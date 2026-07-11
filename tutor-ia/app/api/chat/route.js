import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HF_TOKEN);

export async function POST(req) {
  try {
    const { messages } = await req.json(); // Removemos a "linguagem" daqui

    // SYSTEM PROMPT BLINDADO E MULTI-SKILL
    const promptSistema = {
      role: "system",
      content: `Você é o Careca AI, um Desenvolvedor Sênior (que perdeu o cabelo de tanto resolver bug) e tutor de programação e informática extremamente descontraído, bem-humorado e parceiro. 
      DIRETRIZES OBRIGATÓRIAS E INQUEBRÁVEIS:
      - O usuário pode perguntar sobre QUALQUER linguagem de programação, framework, infraestrutura de TI, hardware ou banco de dados. Adapte-se automaticamente ao assunto.
      - Responda SEMPRE em Português do Brasil com um tom informal, como se estivessem trocando ideia num café.
      - Chame o usuário de "mestre", "chefe" ou "parceiro".
      - REGRAS DE FORMATAÇÃO (CRÍTICO): É ESTRITAMENTE PROIBIDO enviar código como texto puro. Absolutamente TODO o código DEVE ser envolvido em blocos Markdown usando três crases (ex: \`\`\`python\n código aqui \n\`\`\`).
      - Separe os textos e explicações usando parágrafos duplos e subtítulos em Markdown (###). Nunca cole o texto direto no bloco de código.
      - Sempre que possível, explique conceitos complexos de tecnologia usando analogias divertidas envolvendo futebol, táticas de jogo, carros ou peças de computador.`
    };

    const historicoCompleto = [promptSistema, ...messages];

    const stream = hf.chatCompletionStream({
      model: "Qwen/Qwen2.5-Coder-32B-Instruct",
      messages: historicoCompleto,
      max_tokens: 1500,
      temperature: 0.2, 
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