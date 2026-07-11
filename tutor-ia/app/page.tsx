"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  mensagens: Mensagem[];
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false); 
  
  // Estados para edição de título
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");

  // Estados da ARENA DE BUGS
  const [modalArenaAberto, setModalArenaAberto] = useState(false);
  const [temaArena, setTemaArena] = useState("");

  const fimDoChatRef = useRef<HTMLDivElement>(null);

  // 1. Carregar histórico (Local Storage)
  useEffect(() => {
    const savedSessions = localStorage.getItem("carecaai_sessions");
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error("Erro ao carregar histórico", e);
      }
    }
  }, []);

  // 2. Salvar histórico automático
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("carecaai_sessions", JSON.stringify(sessions));
    } else {
      localStorage.removeItem("carecaai_sessions");
    }
  }, [sessions]);

  // 3. Rolar chat
  useEffect(() => {
    fimDoChatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  // --- CONTROLES DE SESSÃO ---
  const criarNovoChat = () => {
    const novoId = crypto.randomUUID();
    setSessions((prev) => [{ id: novoId, title: "Nova Conversa", mensagens: [] }, ...prev]);
    setActiveSessionId(novoId);
    if (window.innerWidth < 768) setMenuAberto(false);
  };

  const deletarChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const trocarChat = (id: string) => {
    if (editingChatId) return;
    setActiveSessionId(id);
    if (window.innerWidth < 768) setMenuAberto(false);
  };

  const iniciarEdicao = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(id);
    setEditTitleInput(currentTitle);
  };

  const salvarEdicao = (id: string, e?: React.FormEvent | React.FocusEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (editTitleInput.trim()) {
      setSessions((prev) => prev.map(s => s.id === id ? { ...s, title: editTitleInput.trim() } : s));
    }
    setEditingChatId(null);
  };

  // --- O MOTOR PRINCIPAL DE MENSAGENS E STREAMING ---
  const processarRequisicaoIA = async (sessionId: string, mensagensParaAPI: Mensagem[]) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: mensagensParaAPI }),
      });

      if (!response.ok) throw new Error("Erro na API");
      if (!response.body) throw new Error("Sem corpo");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textoAcumulado = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textoAcumulado += decoder.decode(value, { stream: true });
        
        setSessions((prev) => prev.map((s) => {
          if (s.id === sessionId) {
            const ultimas = [...s.mensagens];
            ultimas[ultimas.length - 1].content = textoAcumulado;
            return { ...s, mensagens: ultimas };
          }
          return s;
        }));
      }
    } catch (error) {
      console.error(error);
      setSessions((prev) => prev.map((s) => {
        if (s.id === sessionId) {
          const ultimas = [...s.mensagens];
          ultimas[ultimas.length - 1].content = "❌ O servidor engasgou. Tente de novo chefe!";
          return { ...s, mensagens: ultimas };
        }
        return s;
      }));
    } finally {
      setCarregando(false);
    }
  };

  // --- LÓGICA DO CHAT NORMAL ---
  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || carregando) return;

    const msgUser: Mensagem = { role: "user", content: input };
    const inputTextCopia = input;
    setInput("");
    setCarregando(true);

    let currentSessionId = activeSessionId;

    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID();
      const novoTitulo = inputTextCopia.length > 20 ? inputTextCopia.substring(0, 20) + "..." : inputTextCopia;
      setSessions((prev) => [{ id: currentSessionId!, title: novoTitulo, mensagens: [msgUser, { role: "assistant", content: "" }] }, ...prev]);
      setActiveSessionId(currentSessionId);
    } else {
      setSessions((prev) => prev.map((s) => {
        if (s.id === currentSessionId) {
          const isNova = s.mensagens.length === 0;
          const tituloAtual = isNova ? (inputTextCopia.length > 20 ? inputTextCopia.substring(0, 20) + "..." : inputTextCopia) : s.title;
          return { ...s, title: tituloAtual, mensagens: [...s.mensagens, msgUser, { role: "assistant", content: "" }] };
        }
        return s;
      }));
    }

    const sessaoAtiva = sessions.find((s) => s.id === currentSessionId);
    const historicoRequisicao = sessaoAtiva ? [...sessaoAtiva.mensagens, msgUser] : [msgUser];
    await processarRequisicaoIA(currentSessionId!, historicoRequisicao);
  };

  // --- LÓGICA DA ARENA DE BUGS ---
  const iniciarDesafioArena = async () => {
    if (!temaArena.trim() || carregando) return;
    
    setModalArenaAberto(false);
    setCarregando(true);

    const novoId = crypto.randomUUID();
    
    // Mensagem que aparece bonita na interface
    const msgUI: Mensagem = { role: "user", content: `⚔️ **Desafio da Arena Iniciado!**\n\nTema escolhido: **${temaArena}**.\nMande o código quebrado, chefe!` };
    
    // Comando invisível que vai para o "cérebro" da API
    const msgAPI: Mensagem = { 
      role: "user", 
      content: `Aja como um Tech Lead carrasco e irônico. Inicie um desafio da ARENA DE BUGS sobre o tema: ${temaArena}. 
      1. Explique o contexto de um sistema hipotético e o que a função deveria fazer.
      2. Envie um bloco de código Markdown com um bug oculto, erro de lógica ou falha de performance.
      3. Desafie-me a encontrar e consertar o erro.
      NÃO DÊ A RESPOSTA NEM O CÓDIGO CORRIGIDO AINDA! Espere eu tentar adivinhar na minha próxima mensagem.` 
    };

    setSessions((prev) => [{ id: novoId, title: `⚔️ Arena: ${temaArena}`, mensagens: [msgUI, { role: "assistant", content: "" }] }, ...prev]);
    setActiveSessionId(novoId);
    setTemaArena("");
    if (window.innerWidth < 768) setMenuAberto(false);

    await processarRequisicaoIA(novoId, [msgAPI]);
  };

  const sessaoAtiva = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-[100dvh] bg-gray-950 text-gray-100 font-sans overflow-hidden">
      
      {/* --- MODAL DA ARENA DE BUGS --- */}
      {modalArenaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-gray-900 border-2 border-red-900/50 p-6 rounded-2xl w-full max-w-md shadow-2xl shadow-red-900/20">
            <h3 className="text-2xl font-black text-red-500 mb-2">⚔️ Arena de Bugs</h3>
            <p className="text-gray-400 text-sm mb-6">Mestre, sobre qual linguagem, framework ou tecnologia você quer ser testado hoje?</p>
            
            <input 
              autoFocus
              value={temaArena} 
              onChange={(e) => setTemaArena(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && iniciarDesafioArena()}
              placeholder="Ex: React, Python, SQL, C++, Lógica..." 
              className="w-full bg-gray-950 border border-gray-700 p-4 rounded-xl mb-6 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all" 
            />
            
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalArenaAberto(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                Amarelei
              </button>
              <button 
                onClick={iniciarDesafioArena} 
                disabled={!temaArena.trim() || carregando}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-900/30 transition-all"
              >
                Começar Desafio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <aside className={`absolute md:relative z-40 h-full bg-gray-900 border-r border-gray-800 w-72 flex flex-col transition-transform duration-300 ${menuAberto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-4 flex flex-col gap-3 border-b border-gray-800">
          <div className="flex justify-between items-center md:hidden mb-2">
            <span className="font-bold text-gray-200">Histórico</span>
            <button onClick={() => setMenuAberto(false)} className="text-gray-400 hover:text-white p-1">✕</button>
          </div>
          
          <button 
            onClick={criarNovoChat}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <span>+</span> Novo Chat
          </button>
          
          <button 
            onClick={() => setModalArenaAberto(true)}
            className="w-full bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-400 hover:text-red-300 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            ⚔️ Arena de Bugs
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center mt-6">A sua garagem está vazia.</p>
          ) : (
            sessions.map((sessao) => (
              <div 
                key={sessao.id} 
                onClick={() => trocarChat(sessao.id)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeSessionId === sessao.id ? "bg-gray-800/80 text-white border border-gray-700/50" : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border border-transparent"}`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  {editingChatId === sessao.id ? (
                    <input
                      autoFocus
                      value={editTitleInput}
                      onChange={(e) => setEditTitleInput(e.target.value)}
                      onBlur={(e) => salvarEdicao(sessao.id, e)}
                      onKeyDown={(e) => e.key === 'Enter' && salvarEdicao(sessao.id, e)}
                      className="bg-gray-950 border border-gray-600 text-white text-sm px-2 py-1 rounded-lg w-full outline-none focus:border-orange-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="truncate text-sm font-medium flex items-center gap-2">
                      {sessao.title.includes("Arena:") && <span className="text-red-500 text-xs">⚔️</span>}
                      {sessao.title.replace("⚔️ Arena:", "")}
                    </div>
                  )}
                </div>
                
                {editingChatId !== sessao.id && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity bg-gray-900/80 rounded pl-1">
                    <button onClick={(e) => iniciarEdicao(sessao.id, sessao.title, e)} className="p-1.5 text-gray-500 hover:text-blue-400 rounded-md transition-colors" title="Renomear">
                      ✏️
                    </button>
                    <button onClick={(e) => deletarChat(sessao.id, e)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-md transition-colors" title="Apagar">
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* --- ÁREA PRINCIPAL --- */}
      <div className="flex-1 flex flex-col w-full min-w-0 relative">
        <header className="flex items-center p-4 bg-gray-900 border-b border-gray-800 shadow-sm">
          <button onClick={() => setMenuAberto(true)} className="md:hidden text-gray-400 hover:text-white mr-4 p-1">
            ☰
          </button>
          <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-orange-400 to-yellow-500 bg-clip-text text-transparent tracking-tight">
            👨‍🦲 CarecaAI
          </h1>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full max-w-4xl mx-auto space-y-6">
          {!sessaoAtiva || sessaoAtiva.mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-4 animate-fade-in">
              <span className="text-7xl md:text-8xl mb-6 drop-shadow-lg">👨‍🦲</span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-200">Em que posso ajudar hoje?</h2>
              <p className="text-sm md:text-base mt-4 text-gray-500 max-w-md">Cole o seu código, descreva o seu projeto ou clique em <span className="text-red-400 font-bold">Arena de Bugs</span> na barra lateral para ser testado.</p>
            </div>
          ) : (
            sessaoAtiva.mensagens.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[95%] md:max-w-[85%] min-w-0 rounded-3xl p-5 shadow-md ${msg.role === "user" ? "bg-orange-600 text-white rounded-tr-none" : "bg-gray-800 text-gray-200 border border-gray-700/50 rounded-tl-none"}`}>
                  {msg.role === "user" ? (
                    <div className="break-words whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</div>
                  ) : (
                    <div className="prose prose-invert max-w-none overflow-x-auto break-words w-full prose-pre:bg-[#1e1e1e] prose-pre:m-0 prose-pre:p-0 text-[15px] leading-relaxed">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            if (match) {
                              return (
                                <div className="rounded-xl overflow-hidden border border-gray-700 my-5 bg-[#1e1e1e] shadow-xl">
                                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950 border-b border-gray-800">
                                    <span className="text-xs font-mono font-medium text-gray-400 lowercase">{match[1]}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(String(children))}
                                      className="text-xs font-bold text-gray-500 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md"
                                    >
                                      COPIAR
                                    </button>
                                  </div>
                                  <SyntaxHighlighter
                                    {...props}
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ margin: 0, padding: "1.25rem", background: "transparent", fontSize: "0.875rem" }}
                                  >
                                    {String(children).replace(/\n$/, "")}
                                  </SyntaxHighlighter>
                                </div>
                              );
                            }
                            return (
                              <code {...props} className="bg-gray-900 text-orange-400 px-1.5 py-0.5 rounded-md text-sm font-mono border border-gray-800">
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={fimDoChatRef} />
        </main>

        <footer className="p-3 md:p-5 bg-gray-900 border-t border-gray-800 pb-safe">
          <form onSubmit={enviarMensagem} className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={carregando}
              placeholder="Digite sua dúvida ou responda o desafio..."
              className="w-full bg-gray-950 border border-gray-700 text-white text-[15px] md:text-base rounded-2xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 block p-3.5 md:p-4 pr-14 outline-none disabled:opacity-50 shadow-inner transition-all"
            />
            <button 
              type="submit" 
              disabled={carregando || !input.trim()}
              className="absolute right-2 p-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-400 hover:to-orange-500 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 transition-all flex items-center justify-center h-10 w-10 md:h-11 md:w-11 shadow-md hover:shadow-orange-900/50"
            >
              <span className="mb-[2px] ml-[2px]">🚀</span>
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}