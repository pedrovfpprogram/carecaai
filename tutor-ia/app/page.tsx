"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

// 1. Tipagem: Ensinando ao TypeScript o formato da nossa mensagem
interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  // 2. Tipagem: Avisando que o array é de "Mensagens"
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [linguagem, setLinguagem] = useState("Python");
  const [carregando, setCarregando] = useState(false);
  
  // 3. Tipagem: Avisando que a referência vai apontar para uma <div>
  const fimDoChatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDoChatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // 4. Tipagem: Avisando que o evento 'e' vem de um formulário HTML
  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || carregando) return;

    const novaMensagemUsuario: Mensagem = { role: "user", content: input };
    setMensagens((prev) => [...prev, novaMensagemUsuario]);
    setInput("");
    setCarregando(true);

    setMensagens((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...mensagens, novaMensagemUsuario],
          linguagem: linguagem,
        }),
      });

      if (!response.ok) throw new Error("Erro ao conectar com a API");
      if (!response.body) throw new Error("Sem corpo de resposta");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textoAcumulado = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textoAcumulado += decoder.decode(value, { stream: true });
        
        setMensagens((prev) => {
          const novoHistorico = [...prev];
          novoHistorico[novoHistorico.length - 1].content = textoAcumulado;
          return novoHistorico;
        });
      }
    } catch (error) {
      console.error(error);
      setMensagens((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Vish, o servidor deu uma engasgada. Verifica os logs aí, mestre." }
      ]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-950 text-gray-100 font-sans">
      <header className="flex flex-col md:flex-row items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shadow-md gap-4 md:gap-0">
        <h1 className="text-2xl font-black bg-gradient-to-r from-orange-400 to-yellow-500 bg-clip-text text-transparent tracking-tight">
          👨‍🦲 CarecaAI
        </h1>
        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
          <label className="text-sm text-gray-400 hidden md:block">Focando em:</label>
          <select 
            value={linguagem} 
            onChange={(e) => setLinguagem(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none w-full md:w-auto"
          >
            <option value="Python">Python</option>
            <option value="C++">C++</option>
            <option value="JavaScript">JavaScript</option>
            <option value="HTML/CSS">HTML/CSS</option>
            <option value="Java">Java</option>
          </select>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto w-full max-w-4xl mx-auto space-y-6">
        {mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-4">
            <span className="text-8xl mb-6">👨‍🦲</span>
            <h2 className="text-3xl font-bold text-gray-200">Qual é o serviço de hoje?</h2>
            <p className="text-sm mt-4 text-gray-500">Manda a bronca que eu resolvo o código pra você.</p>
          </div>
        ) : (
          mensagens.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[95%] md:max-w-[85%] min-w-0 rounded-2xl p-4 shadow-sm ${msg.role === "user" ? "bg-orange-600 text-white rounded-tr-none" : "bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none"}`}>
                
                {msg.role === "user" ? (
                  <div className="break-words whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="prose prose-invert max-w-none overflow-x-auto break-words w-full">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}

              </div>
            </div>
          ))
        )}
        <div ref={fimDoChatRef} />
      </main>

      <footer className="p-3 md:p-4 bg-gray-900 border-t border-gray-800 pb-safe">
        <form onSubmit={enviarMensagem} className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={carregando}
            placeholder="Qual é o bug de hoje?"
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm md:text-base rounded-full focus:ring-orange-500 focus:border-orange-500 block p-3 md:p-4 pr-12 outline-none disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={carregando || !input.trim()}
            className="absolute right-2 p-2 bg-orange-600 text-white rounded-full hover:bg-orange-700 disabled:bg-gray-600 transition-colors flex items-center justify-center h-8 w-8 md:h-10 md:w-10"
          >
            🚀
          </button>
        </form>
      </footer>
    </div>
  );
}