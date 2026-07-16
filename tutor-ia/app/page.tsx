"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { supabase } from "../lib/supabase"; 

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

// Funções seguras para codificar/decodificar Base64 com acentos e emojis
const encodeBase64 = (str: string) => btoa(unescape(encodeURIComponent(str)));
const decodeBase64 = (str: string) => decodeURIComponent(escape(atob(str)));

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
  const [isOnline, setIsOnline] = useState(true);
  const [xp, setXp] = useState<number>(0);

  const [user, setUser] = useState<any>(null);
  const [authModalAberto, setAuthModalAberto] = useState(false);
  const [emailAuth, setEmailAuth] = useState("");
  const [senhaAuth, setSenhaAuth] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const fimDoChatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) carregarDadosDaNuvem(session.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) carregarDadosDaNuvem(session.user.id);
    });

    // MÁGICA 1: PROCESSAR O LINK DE DUELO QUANDO O APP ABRE
    processarLinkDeDesafio();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const processarLinkDeDesafio = () => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const challengeBase64 = urlParams.get("challenge");
    const temaBase64 = urlParams.get("tema");

    if (challengeBase64 && temaBase64) {
      try {
        const decodedContent = decodeBase64(challengeBase64);
        const decodedTema = decodeBase64(temaBase64);

        const novoId = crypto.randomUUID();
        const novaSessao: ChatSession = {
          id: novoId,
          title: `⚔️ Duelo: ${decodedTema}`,
          mensagens: [
            { role: "user", content: `🥊 **Duelo Aceite!**\n\nFui desafiado no tema: **${decodedTema}**.\nVou consertar este bug e roubar os 50 XP!` },
            { role: "assistant", content: decodedContent }
          ],
          isArena: true,
          xpReivindicado: false
        };

        setSessions(prev => [novaSessao, ...prev]);
        setActiveSessionId(novoId);

        // Limpa a URL para não ficar em loop se recarregar a página
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error("Link de desafio inválido ou corrompido.", e);
      }
    }
  };

  useEffect(() => {
    if (user) return; 
    const savedSessions = localStorage.getItem("carecaai_sessions");
    const savedXp = localStorage.getItem("carecaai_xp");
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        // Só carrega do localstorage se não tiver já carregado um Duelo do link
        if (parsed.length > 0 && sessions.length === 0) { 
          setSessions(parsed); 
          setActiveSessionId(parsed[0].id); 
        }
      } catch (e) {}
    }
    if (savedXp) setXp(parseInt(savedXp, 10));
  }, [user]);

  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem("carecaai_sessions", JSON.stringify(sessions));
    else localStorage.removeItem("carecaai_sessions");
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("carecaai_xp", xp.toString());
  }, [xp]);

  useEffect(() => {
    fimDoChatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  const carregarDadosDaNuvem = async (userId: string) => {
    const { data: profile } = await supabase.from('profiles').select('xp').eq('id', userId).single();
    if (profile) setXp(profile.xp);

    const { data: chatsData } = await supabase.from('chats').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (chatsData && chatsData.length > 0) {
      const sessoesNuvem = chatsData.map(c => ({
        id: c.id, title: c.title, mensagens: c.mensagens, isArena: c.is_arena, xpReivindicado: c.xp_reivindicado, isPinned: c.is_pinned
      }));
      
      setSessions(prev => {
        // Se a pessoa abriu o app por um link de desafio, junta o desafio novo com os que vieram da nuvem
        const desafioAtual = prev.find(s => s.title.includes("⚔️ Duelo:"));
        if (desafioAtual && !sessoesNuvem.find(s => s.id === desafioAtual.id)) {
          salvarSessaoNaNuvem(desafioAtual); // Salva o novo duelo na nuvem
          return [desafioAtual, ...sessoesNuvem];
        }
        setActiveSessionId(sessoesNuvem[0].id);
        return sessoesNuvem;
      });
    }
  };

  const salvarSessaoNaNuvem = async (sessao: ChatSession) => {
    if (!user || !isOnline) return;
    await supabase.from('chats').upsert({
      id: sessao.id, user_id: user.id, title: sessao.title, mensagens: sessao.mensagens, 
      is_arena: sessao.isArena || false, xp_reivindicado: sessao.xpReivindicado || false, 
      is_pinned: sessao.isPinned || false, updated_at: new Date().toISOString()
    });
  };

  const deletarSessaoNaNuvem = async (id: string) => {
    if (!user || !isOnline) return;
    await supabase.from('chats').delete().eq('id', id);
  };

  const atualizarXpNaNuvem = async (novoXp: number) => {
    if (!user || !isOnline) return;
    await supabase.from('profiles').update({ xp: novoXp }).eq('id', user.id);
  };

  const autenticarNuvem = async () => {
    if (!emailAuth || !senhaAuth) return;
    setCarregando(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: emailAuth, password: senhaAuth });
      if (error) alert("Erro ao criar: " + error.message);
      else setAuthModalAberto(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailAuth, password: senhaAuth });
      if (error) alert("Erro ao entrar: " + error.message);
      else setAuthModalAberto(false);
    }
    setCarregando(false);
  };

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (id: string) => {
    touchTimerRef.current = setTimeout(() => {
      setChatMenuAberto(id);
      try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
    }, 500); 
  };

  const handleTouchEndOrMove = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    setChatMenuAberto(id);
    try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
  };

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
    const novoXp = xp + 50;
    setXp(novoXp);
    atualizarXpNaNuvem(novoXp);

    setSessions(prev => {
      const novas = prev.map(s => s.id === activeSessionId ? { ...s, xpReivindicado: true } : s);
      const sessaoAtualizada = novas.find(s => s.id === activeSessionId);
      if (sessaoAtualizada) salvarSessaoNaNuvem(sessaoAtualizada);
      return novas;
    });
  };

  const criarNovoChat = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
    const novoId = crypto.randomUUID();
    const novaSessao: ChatSession = { id: novoId, title: "Nova Conversa", mensagens: [] };
    setSessions(prev => [novaSessao, ...prev]);
    setActiveSessionId(novoId);
    salvarSessaoNaNuvem(novaSessao);
    if (window.innerWidth < 768) setMenuAberto(false);
  };

  const deletarChat = (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation(); 
    setSessions(prev => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
    deletarSessaoNaNuvem(id);
    setChatMenuAberto(null);
  };

  const trocarChat = (id: string) => {
    if (editingChatId) return;
    setActiveSessionId(id);
    if (window.innerWidth < 768) setMenuAberto(false);
  };

  const togglePinChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const novas = prev.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s);
      const modificada = novas.find(s => s.id === id);
      if (modificada) salvarSessaoNaNuvem(modificada);
      return novas;
    });
    setChatMenuAberto(null);
  };

  const iniciarEdicao = (id: string, currentTitle: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    setEditingChatId(id);
    setEditTitleInput(currentTitle);
    setChatMenuAberto(null);
  };

  const salvarEdicao = (id: string, e?: React.FormEvent | React.FocusEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (editTitleInput.trim()) {
      setSessions(prev => {
        const novas = prev.map(s => s.id === id ? { ...s, title: editTitleInput.trim() } : s);
        const modificada = novas.find(s => s.id === id);
        if (modificada) salvarSessaoNaNuvem(modificada);
        return novas;
      });
    }
    setEditingChatId(null);
  };

  const processarRequisicaoIA = async (sessionId: string, mensagensParaAPI: Mensagem[]) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: mensagensParaAPI }),
      });

      if (!response.ok) throw new Error("Erro na API");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let textoAcumulado = "";

      if (reader) {
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
      }

      setSessions(prev => {
        const atual = prev.find(s => s.id === sessionId);
        if (atual) salvarSessaoNaNuvem(atual);
        return prev;
      });

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
    if (!input.trim() || carregando || !isOnline) return;

    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (e) {}

    const msgUser: Mensagem = { role: "user", content: input };
    const inputTextCopia = input;
    setInput("");
    setCarregando(true);

    let currentSessionId = activeSessionId;

    setSessions((prev) => {
      let novas = [...prev];
      if (!currentSessionId) {
        currentSessionId = crypto.randomUUID();
        const novoTitulo = inputTextCopia.length > 20 ? inputTextCopia.substring(0, 20) + "..." : inputTextCopia;
        novas = [{ id: currentSessionId!, title: novoTitulo, mensagens: [msgUser, { role: "assistant", content: "" }] }, ...novas];
        setActiveSessionId(currentSessionId);
      } else {
        novas = novas.map((s) => {
          if (s.id === currentSessionId) {
            const isNova = s.mensagens.length === 0;
            const tituloAtual = isNova ? (inputTextCopia.length > 20 ? inputTextCopia.substring(0, 20) + "..." : inputTextCopia) : s.title;
            return { ...s, title: tituloAtual, mensagens: [...s.mensagens, msgUser, { role: "assistant", content: "" }] };
          }
          return s;
        });
      }
      return novas;
    });

    setTimeout(async () => {
      setSessions(stateAtual => {
        const sessaoAtualizada = stateAtual.find((s) => s.id === currentSessionId);
        if (sessaoAtualizada) {
          const historicoRequisicao = sessaoAtualizada.mensagens.slice(0, -1);
          processarRequisicaoIA(currentSessionId!, historicoRequisicao);
          salvarSessaoNaNuvem(sessaoAtualizada);
        }
        return stateAtual;
      });
    }, 50);
  };

  const iniciarDesafioArena = async () => {
    if (!temaArena.trim() || carregando || !isOnline) return;
    try { await Haptics.notification({ type: NotificationType.Warning }); } catch (e) {}
    setModalArenaAberto(false);
    setCarregando(true);

    const novoId = crypto.randomUUID();
    const msgUI: Mensagem = { role: "user", content: `⚔️ **Desafio da Arena Iniciado!**\n\nTema escolhido: **${temaArena}**.\nMande o código quebrado, chefe!` };
    const msgAPI: Mensagem = { 
      role: "user", 
      content: `Aja como um Tech Lead carrasco. Inicie um desafio da ARENA DE BUGS sobre: ${temaArena}. 
      1. Explique um contexto breve.
      2. Envie um bloco de código Markdown com um bug claro.
      3. Desafie-me a consertar.
      ⚠️ REGRA MÁXIMA: NÃO DÊ A RESPOSTA! Espere eu tentar. Se eu acertar nas próximas mensagens, OBRIGATORIAMENTE inclua a tag exata [DESAFIO_CONCLUIDO] no final da sua resposta.` 
    };

    const novaSessao: ChatSession = { id: novoId, title: `⚔️ Arena: ${temaArena}`, mensagens: [msgUI, { role: "assistant", content: "" }], isArena: true, xpReivindicado: false };
    
    setSessions(prev => [novaSessao, ...prev]);
    setActiveSessionId(novoId);
    setTemaArena("");
    if (window.innerWidth < 768) setMenuAberto(false);

    salvarSessaoNaNuvem(novaSessao);
    await processarRequisicaoIA(novoId, [msgAPI]);
  };

  // MÁGICA 2: GERAR O LINK COMPLETO DO DESAFIO PARA OS AMIGOS
  const desafiarAmigo = async () => {
    if (!sessaoAtiva || !sessaoAtiva.isArena || sessaoAtiva.mensagens.length < 2) return;

    // A mensagem da IA com o desafio inteiro (Contexto + Código)
    const iaMensagem = sessaoAtiva.mensagens[1].content;
    const tema = sessaoAtiva.title.replace("⚔️ Arena: ", "").replace("⚔️ Duelo: ", "");
    
    // Criptografar para URL
    const encodedTema = encodeBase64(tema);
    const encodedContent = encodeBase64(iaMensagem);
    
    const link = `${window.location.origin}/?challenge=${encodedContent}&tema=${encodedTema}`;
    const textoPartilha = `🥊 *Duelo CarecaAI!*\n\nFui desafiado na Arena de Bugs com este código de ${tema}. Duvido que consigas encontrar o bug antes de mim!\n\nClica no link para aceitar o duelo e ganhar XP no teu telemóvel:\n${link}`;

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await Share.share({
        title: 'Desafio CarecaAI',
        text: textoPartilha,
        dialogTitle: 'Enviar duelo via'
      });
    } catch (e) {
      // O Codespaces roda num iframe e perde o foco, bloqueando o clipboard moderno.
      // Solução de mestre (Fallback Old School):
      const textArea = document.createElement("textarea");
      textArea.value = textoPartilha;
      textArea.style.position = "fixed"; // fixed previne scroll para o elemento
      textArea.style.left = "-999999px"; // esconde fora do ecrã
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        alert("Link de Duelo copiado para a área de transferência! Cole (Ctrl+V) no WhatsApp do seu rival.");
      } catch (err) {
        // Se até a técnica milenar falhar, mostramos o link no ecrã para cópia manual
        prompt("Erro ao copiar automaticamente. Copie o link abaixo:", link);
      } finally {
        document.body.removeChild(textArea);
      }
    }
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
      
      {authModalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4">
          <div className="bg-gray-900 border-2 border-orange-900/50 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-2xl font-black text-orange-500 mb-2">{isSignUp ? "Criar Conta" : "Login na Nuvem"}</h3>
            <p className="text-gray-400 text-sm mb-6">Guarda os teus níveis e código seguro na nuvem.</p>
            <input type="email" value={emailAuth} onChange={e=>setEmailAuth(e.target.value)} placeholder="E-mail" className="w-full bg-gray-950 border border-gray-700 p-3 rounded-xl mb-3 text-white outline-none focus:border-orange-500" />
            <input type="password" value={senhaAuth} onChange={e=>setSenhaAuth(e.target.value)} placeholder="Senha" className="w-full bg-gray-950 border border-gray-700 p-3 rounded-xl mb-6 text-white outline-none focus:border-orange-500" />
            
            <div className="flex flex-col gap-3">
              <button onClick={autenticarNuvem} disabled={carregando} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg">
                {carregando ? "A processar..." : (isSignUp ? "Registar e Sincronizar" : "Entrar")}
              </button>
              <div className="flex justify-between items-center mt-2">
                <button onClick={()=>setIsSignUp(!isSignUp)} className="text-sm text-gray-400 hover:text-white underline">
                  {isSignUp ? "Já tenho conta" : "Criar nova conta"}
                </button>
                <button onClick={()=>setAuthModalAberto(false)} className="text-sm text-gray-500 hover:text-white">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalArenaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-gray-900 border-2 border-red-900/50 p-6 rounded-2xl w-full max-w-md shadow-2xl shadow-red-900/20">
            <h3 className="text-2xl font-black text-red-500 mb-2">⚔️ Arena de Bugs</h3>
            <p className="text-gray-400 text-sm mb-6">Mestre, sobre que linguagem quer ser testado hoje?</p>
            <input 
              autoFocus value={temaArena} onChange={(e) => setTemaArena(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && iniciarDesafioArena()}
              disabled={!isOnline} placeholder={isOnline ? "Ex: React, Python, SQL..." : "Sem internet..."} 
              className={`w-full border p-4 rounded-xl mb-6 text-white outline-none transition-all ${isOnline ? "bg-gray-950 border-gray-700 focus:border-red-500" : "bg-red-950/20 border-red-900 text-red-500 opacity-70"}`} 
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalArenaAberto(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Amarelei</button>
              <button onClick={iniciarDesafioArena} disabled={!temaArena.trim() || carregando || !isOnline} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-900/30 transition-all">Começar Desafio</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`absolute md:relative z-40 h-full bg-gray-900 border-r border-gray-800 w-72 flex flex-col transition-transform duration-300 ${menuAberto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-4 bg-gray-950/50 border-b border-gray-800 relative overflow-hidden">
          {!isOnline && <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse" title="Modo Offline"></div>}
          <div className="flex justify-between items-end mb-1">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Nv. {statusAtual.nivel}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{xp} / {statusAtual.max} XP</span>
              {!user ? (
                <button onClick={() => setAuthModalAberto(true)} className="text-[10px] bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30 hover:bg-orange-600/40 transition-colors">☁️ Sync</button>
              ) : (
                <button onClick={() => supabase.auth.signOut()} className="text-[10px] bg-green-600/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 hover:bg-green-600/40 transition-colors" title="Deslogar">☁️ ON</button>
              )}
            </div>
          </div>
          <div className="text-sm font-black text-white mb-2 truncate" title={statusAtual.titulo}>{statusAtual.titulo}</div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="bg-gradient-to-r from-orange-500 to-yellow-400 h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: `${statusAtual.progresso}%` }}></div>
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
                onContextMenu={(e) => handleContextMenu(e, sessao.id)}
                onTouchStart={() => handleTouchStart(sessao.id)}
                onTouchEnd={handleTouchEndOrMove}
                onTouchMove={handleTouchEndOrMove}
                className={`relative group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeSessionId === sessao.id ? "bg-gray-800/80 text-white border border-gray-700/50" : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border border-transparent"}`}
              >
                <div className="flex-1 min-w-0 pr-2 flex items-center gap-2 pointer-events-none">
                  {sessao.isPinned && <span className="text-[10px]">📌</span>}
                  {editingChatId === sessao.id ? (
                    <input
                      autoFocus value={editTitleInput} onChange={(e) => setEditTitleInput(e.target.value)}
                      onBlur={(e) => salvarEdicao(sessao.id, e)} onKeyDown={(e) => e.key === 'Enter' && salvarEdicao(sessao.id, e)}
                      className="bg-gray-950 border border-gray-600 text-white text-sm px-2 py-1 rounded-lg w-full outline-none focus:border-orange-500 pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="truncate text-sm font-medium select-none">
                      {sessao.isArena && <span className="text-red-500 text-xs mr-1">⚔️</span>}
                      {sessao.title.replace("⚔️ Arena:", "").replace("⚔️ Duelo:", "").trim()}
                    </div>
                  )}
                </div>
                
                {chatMenuAberto === sessao.id && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); setChatMenuAberto(null); }} onTouchStart={(e) => { e.stopPropagation(); setChatMenuAberto(null); }} />
                    <div className="absolute top-10 left-4 w-36 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[100] overflow-hidden py-1">
                      <button onClick={(e) => togglePinChat(sessao.id, e)} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex gap-2">
                        {sessao.isPinned ? "📍 Desfixar" : "📌 Fixar"}
                      </button>
                      <button onClick={(e) => iniciarEdicao(sessao.id, sessao.title, e)} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex gap-2">
                        ✏️ Renomear
                      </button>
                      <div className="border-t border-gray-700 my-1"></div>
                      <button onClick={(e) => deletarChat(sessao.id, e)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors flex gap-2">
                        🗑️ Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col w-full min-w-0 relative">
        <header className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shadow-sm relative">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuAberto(true)} className="md:hidden text-gray-400 hover:text-white p-1">☰</button>
            <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-orange-400 to-yellow-500 bg-clip-text text-transparent tracking-tight">
              👨‍🦲 CarecaAI
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* O BOTÃO DIVIDIDO: GERADOR DE LINK PARA DUELO DE AMIGOS */}
            {sessaoAtiva?.isArena && sessaoAtiva.mensagens.length >= 2 && (
              <button 
                onClick={desafiarAmigo} 
                title="Mandar link do desafio para um rival"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs md:text-sm font-bold py-1.5 md:py-2 px-3 md:px-4 rounded-lg shadow-lg shadow-blue-900/20 transition-transform active:scale-95"
              >
                🔗 Desafiar Amigo
              </button>
            )}

            {mostrarBotaoXP && (
              <button onClick={reivindicarXP} className="bg-green-600 hover:bg-green-500 text-white text-xs md:text-sm font-bold py-1.5 md:py-2 px-3 md:px-4 rounded-lg shadow-lg shadow-green-900/20 transition-transform active:scale-95 animate-pulse">
                ✅ Consegui! (+50 XP)
              </button>
            )}
            {sessaoAtiva?.xpReivindicado && (
              <span className="text-xs font-bold text-green-500 bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-800">🎉 XP Adquirido</span>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full max-w-4xl mx-auto space-y-6" onClick={() => setChatMenuAberto(null)}>
          {!sessaoAtiva || sessaoAtiva.mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-4 animate-fade-in">
              <span className={`text-7xl md:text-8xl mb-6 drop-shadow-lg transition-transform ${!isOnline ? "grayscale opacity-50" : ""}`}>👨‍🦲</span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-200">
                {isOnline ? "Em que posso ajudar hoje?" : "Estou sem sinal, chefe!"}
              </h2>
              <p className="text-sm md:text-base mt-4 text-gray-500 max-w-md">
                {isOnline 
                  ? <span>Cola o teu código, descreve o projeto ou clica na <span className="text-red-400 font-bold">Arena de Bugs</span> para ganhares XP.</span>
                  : "Liga a Wi-Fi ou os dados móveis para continuarmos a programar."}
              </p>
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
                              const rawCode = String(children).replace(/\n$/, "");
                              if (match) {
                                return (
                                  <div className="rounded-xl overflow-hidden border border-gray-700 my-5 bg-[#1e1e1e] shadow-xl">
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950 border-b border-gray-800">
                                      <span className="text-xs font-mono font-medium text-gray-400 lowercase">{match[1]}</span>
                                      <div className="flex gap-2">
                                        <button onClick={async () => { try { await Share.share({ title: 'Código CarecaAI', text: rawCode }); } catch (e) {} }} className="text-xs font-bold text-blue-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md">PARTILHAR</button>
                                        <button onClick={async () => { navigator.clipboard.writeText(rawCode); try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {} }} className="text-xs font-bold text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md">COPIAR</button>
                                      </div>
                                    </div>
                                    <SyntaxHighlighter {...props} style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: "1.25rem", background: "transparent", fontSize: "0.875rem" }}>
                                      {rawCode}
                                    </SyntaxHighlighter>
                                  </div>
                                );
                              }
                              return <code {...props} className="bg-gray-900 text-orange-400 px-1.5 py-0.5 rounded-md text-sm font-mono border border-gray-800">{children}</code>;
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

        <footer className="p-3 md:p-5 bg-gray-900 border-t border-gray-800 pb-safe" onClick={() => setChatMenuAberto(null)}>
          <form onSubmit={enviarMensagem} className="max-w-4xl mx-auto relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={carregando || !isOnline} placeholder={isOnline ? "Digita a tua dúvida ou responde ao desafio..." : "Sem sinal..."} className={`w-full bg-gray-950 border text-[15px] md:text-base rounded-2xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 block p-3.5 md:p-4 pr-14 outline-none shadow-inner transition-all ${!isOnline ? "border-red-900/50 text-red-400 cursor-not-allowed" : "border-gray-700 text-white disabled:opacity-50"}`} />
            <button type="submit" disabled={carregando || !input.trim() || !isOnline} className="absolute right-2 p-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-400 hover:to-orange-500 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 transition-all flex items-center justify-center h-10 w-10 md:h-11 md:w-11 shadow-md"><span className="mb-[2px] ml-[2px]">🚀</span></button>
          </form>
        </footer>
      </div>
    </div>
  );
}