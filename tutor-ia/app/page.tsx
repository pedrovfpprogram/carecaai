"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  mensagens: Mensagem[];
  isArena?: boolean;
  xpReivindicado?: boolean;
  isPinned?: boolean;
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false); 
  
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");

  const [modalArenaAberto, setModalArenaAberto] = useState(false);
  const [temaArena, setTemaArena] = useState("");

  const [chatMenuAberto, setChatMenuAberto] = useState<string | null>(null);

  const [xp, setXp] = useState<number>(0);

  const fimDoChatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem("carecaai_sessions");
    const savedXp = localStorage.getItem("carecaai_xp");
    
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
    
    if (savedXp) {
      setXp(parseInt(savedXp, 10));
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("carecaai_sessions", JSON.stringify(sessions));
    } else {
      localStorage.removeItem("carecaai_sessions");
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("carecaai_xp", xp.toString());
  }, [xp]);

  useEffect(() => {
    fimDoChatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  // A TUA EVOLUÇÃO (Títulos baseados na pontuação)
  const calcularNivel = (pontos: number) => {
    if (pontos < 100) return { nivel: 1, titulo: "Estagiário Perdido", progresso: (pontos / 100) * 100, max: 100 };
    if (pontos < 300) return { nivel: 2, titulo: "Dev Júnior Traumatizado", progresso: ((pontos - 100) / 200) * 100, max: 300 };
    if (pontos < 600) return { nivel: 3, titulo: "Pleno do Stack Overflow", progresso: ((pontos - 300) / 300) * 100, max: 600 };
    return { nivel: 4, titulo: "Sénior Sem Cabelo", progresso: 100, max: "MÁX" };
  };

  const statusAtual = calcularNivel(xp);

  const reivindicarXP = async () => {
    if (!activeSessionId) return;
    try { await Haptics.notification({ type: NotificationType.Success }); } catch (e) {}
    setXp(prev => prev + 50);
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { ...s, xpReivindicado: true } : s
    ));
  };

  const criarNovoChat = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
    const novoId = crypto.randomUUID();
    setSessions((prev) => [{ id: novoId, title: "Nova Conversa", mensagens: [] }, ...prev]);
    setActiveSessionId(novoId);
    if (window.innerWidth < 768) setMenuAberto(false);
  };

  const deletarChat = (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation(); 
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const trocarChat = (id: string) => {
    if (editingChatId) return;
    setActiveSessionId(id);
    if (window.innerWidth < 768) setMenuAberto(false);
  };

  const togglePinChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s));
    setChatMenuAberto(null);
  };

  const iniciarEdicao = (id: string, currentTitle: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
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
      setSessions((prev) => prev.map((s) => {
        if (s.id === sessionId) {
          const ultimas = [...s.mensagens];
          ultimas[ultimas.length - 1].content = "❌ O servidor engasgou. Tente novamente, chefe!";
          return { ...s, mensagens: ultimas };
        }
        return s;
      }));
    } finally {
      setCarregando(false);
    }
  };

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || carregando) return;

    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (e) {}

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

    const sessaoAtualizada = sessions.find((s) => s.id === currentSessionId) || { mensagens: [] };
    const historicoRequisicao = [...sessaoAtualizada.mensagens, msgUser];
    await processarRequisicaoIA(currentSessionId!, historicoRequisicao);
  };

  const iniciarDesafioArena = async () => {
    if (!temaArena.trim() || carregando) return;
    try { await Haptics.notification({ type: NotificationType.Warning }); } catch (e) {}

    setModalArenaAberto(false);
    setCarregando(true);

    const novoId = crypto.randomUUID();
    
    const msgUI: Mensagem = { role: "user", content: `⚔️ **Desafio da Arena Iniciado!**\n\nTema escolhido: **${temaArena}**.\nMande o código quebrado, chefe!` };
    
    const msgAPI: Mensagem = { 
      role: "user", 
      content: `Aja como um Tech Lead carrasco. Inicie um desafio da ARENA DE BUGS sobre: ${temaArena}. 
      1. Explique um contexto.
      2. Envie um bloco de código Markdown com um bug.
      3. Desafie-me a consertar.
      ⚠️ REGRA MÁXIMA: NÃO DÊ A RESPOSTA! Espere eu tentar. Se (E APENAS SE) eu enviar a resposta certa e consertar o código nas próximas mensagens, você deve OBRIGATORIAMENTE incluir a tag exata [DESAFIO_CONCLUIDO] no final da sua resposta parabenizando-me.` 
    };

    setSessions((prev) => [{ 
      id: novoId, 
      title: `⚔️ Arena: ${temaArena}`, 
      mensagens: [msgUI, { role: "assistant", content: "" }],
      isArena: true,
      xpReivindicado: false
    }, ...prev]);
    
    setActiveSessionId(novoId);
    setTemaArena("");
    if (window.innerWidth < 768) setMenuAberto(false);

    await processarRequisicaoIA(novoId, [msgAPI]);
  };

  const sessaoAtiva = sessions.find((s) => s.id === activeSessionId);
  
  const sessoesFixadas = sessions.filter(s => s.isPinned);
  const sessoesNormais = sessions.filter(s => !s.isPinned);
  const todasSessoesOrdenadas = [...sessoesFixadas, ...sessoesNormais];

  const lastMsg = sessaoAtiva?.mensagens[sessaoAtiva.mensagens.length - 1];
  const iaValidouAcerto = lastMsg?.role === "assistant" && lastMsg.content.includes("[DESAFIO_CONCLUIDO]");
  const mostrarBotaoXP = sessaoAtiva?.isArena && !sessaoAtiva?.xpReivindicado && iaValidouAcerto;

  return (
    <div className="flex h-[100dvh] bg-gray-950 text-gray-100 font-sans overflow-hidden">
      
      {modalArenaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-gray-900 border-2 border-red-900/50 p-6 rounded-2xl w-full max-w-md shadow-2xl shadow-red-900/20">
            <h3 className="text-2xl font-black text-red-500 mb-2">⚔️ Arena de Bugs</h3>
            <p className="text-gray-400 text-sm mb-6">Mestre, sobre que linguagem ou framework quer ser testado hoje?</p>
            <input 
              autoFocus
              value={temaArena} 
              onChange={(e) => setTemaArena(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && iniciarDesafioArena()}
              placeholder="Ex: React, Python, SQL, C++..." 
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

      <aside className={`absolute md:relative z-40 h-full bg-gray-900 border-r border-gray-800 w-72 flex flex-col transition-transform duration-300 ${menuAberto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        
        <div className="p-4 bg-gray-950/50 border-b border-gray-800">
          <div className="flex justify-between items-end mb-1">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Nv. {statusAtual.nivel}</span>
            <span className="text-xs text-gray-400">{xp} / {statusAtual.max} XP</span>
          </div>
          <div className="text-sm font-black text-white mb-2 truncate" title={statusAtual.titulo}>
            {statusAtual.titulo}
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-orange-500 to-yellow-400 h-2 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${statusAtual.progresso}%` }}
            ></div>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3 border-b border-gray-800">
          <button onClick={criarNovoChat} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
            <span>+</span> Novo Chat
          </button>
          <button onClick={() => setModalArenaAberto(true)} className="w-full bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-400 hover:text-red-300 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
            ⚔️ Arena de Bugs
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1 pb-20">
          {todasSessoesOrdenadas.length === 0 ? (
            <p className="text-xs text-gray-500 text-center mt-6">Sem histórico de chats.</p>
          ) : (
            todasSessoesOrdenadas.map((sessao) => (
              <div 
                key={sessao.id} 
                onClick={() => trocarChat(sessao.id)}
                className={`relative group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeSessionId === sessao.id ? "bg-gray-800/80 text-white border border-gray-700/50" : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border border-transparent"}`}
              >
                <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
                  {sessao.isPinned && <span className="text-[10px]">📌</span>}
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
                    <div className="truncate text-sm font-medium">
                      {sessao.isArena && <span className="text-red-500 text-xs mr-1">⚔️</span>}
                      {sessao.title.replace("⚔️ Arena:", "").trim()}
                    </div>
                  )}
                </div>
                
                {editingChatId !== sessao.id && (
                  <div className="relative flex items-center">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setChatMenuAberto(chatMenuAberto === sessao.id ? null : sessao.id); 
                      }}
                      className={`p-2 text-gray-400 hover:text-white rounded-md transition-opacity ${activeSessionId === sessao.id || chatMenuAberto === sessao.id ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100 opacity-100'}`}
                    >
                      ⋮
                    </button>

                    {/* O ESCUDO INVISÍVEL - Cobre o ecrã inteiro para captar o clique de fechar */}
                    {chatMenuAberto === sessao.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-[90]" 
                          onClick={(e) => { e.stopPropagation(); setChatMenuAberto(null); }}
                        />
                        <div className="absolute top-8 left-0 md:right-0 md:left-auto mt-1 w-36 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[100] overflow-hidden py-1">
                          <button onClick={(e) => togglePinChat(sessao.id, e)} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex gap-2">
                            {sessao.isPinned ? "📍 Desfixar" : "📌 Fixar"}
                          </button>
                          <button onClick={(e) => { setChatMenuAberto(null); iniciarEdicao(sessao.id, sessao.title, e); }} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex gap-2">
                            ✏️ Renomear
                          </button>
                          <div className="border-t border-gray-700 my-1"></div>
                          <button onClick={(e) => { setChatMenuAberto(null); deletarChat(sessao.id, e); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors flex gap-2">
                            🗑️ Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col w-full min-w-0 relative">
        <header className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuAberto(true)} className="md:hidden text-gray-400 hover:text-white p-1">
              ☰
            </button>
            <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-orange-400 to-yellow-500 bg-clip-text text-transparent tracking-tight">
              👨‍🦲 CarecaAI
            </h1>
          </div>
          
          {mostrarBotaoXP && (
            <button onClick={reivindicarXP} className="bg-green-600 hover:bg-green-500 text-white text-xs md:text-sm font-bold py-1.5 md:py-2 px-3 md:px-4 rounded-lg shadow-lg shadow-green-900/20 transition-transform active:scale-95 animate-pulse">
              ✅ Consegui! (+50 XP)
            </button>
          )}
          {sessaoAtiva?.xpReivindicado && (
            <span className="text-xs font-bold text-green-500 bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-800">
              🎉 XP Adquirido
            </span>
          )}
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full max-w-4xl mx-auto space-y-6">
          {!sessaoAtiva || sessaoAtiva.mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-4 animate-fade-in">
              <span className="text-7xl md:text-8xl mb-6 drop-shadow-lg">👨‍🦲</span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-200">Em que posso ajudar hoje?</h2>
              <p className="text-sm md:text-base mt-4 text-gray-500 max-w-md">Cola o teu código, descreve o projeto ou clica na <span className="text-red-400 font-bold">Arena de Bugs</span> para ganhares XP.</p>
            </div>
          ) : (
            sessaoAtiva.mensagens.map((msg, index) => {
              const displayContent = msg.content.replace(/\[DESAFIO_CONCLUIDO\]/g, "").trim();

              return (
                <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[95%] md:max-w-[85%] min-w-0 rounded-3xl p-5 shadow-md ${msg.role === "user" ? "bg-orange-600 text-white rounded-tr-none" : "bg-gray-800 text-gray-200 border border-gray-700/50 rounded-tl-none"}`}>
                    {msg.role === "user" ? (
                      <div className="break-words whitespace-pre-wrap text-[15px] leading-relaxed">{displayContent}</div>
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
                                        onClick={async () => {
                                          navigator.clipboard.writeText(String(children));
                                          try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
                                        }}
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
                          {displayContent}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
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
              placeholder="Digita a tua dúvida ou responde ao desafio..."
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