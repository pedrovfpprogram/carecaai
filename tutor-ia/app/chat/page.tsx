"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { supabase } from "../../lib/supabase";
import Editor from "@monaco-editor/react";

const encodeBase64 = (str: string) => btoa(unescape(encodeURIComponent(str)));
const decodeBase64 = (str: string) => decodeURIComponent(escape(atob(str)));

interface Mensagem { role: "user" | "assistant"; content: string; }
interface ChatSession { id: string; title: string; mensagens: Mensagem[]; isArena?: boolean; xpReivindicado?: boolean; isPinned?: boolean; }
interface NotaDicionario { id: string; titulo: string; codigo: string; linguagem: string; } // TIPO DO DICIONÁRIO

const MAPA_PISTON: Record<string, { lang: string, ver: string }> = {
  python: { lang: "python", ver: "3.10.0" }, py: { lang: "python", ver: "3.10.0" },
  cpp: { lang: "c++", ver: "10.2.0" }, "c++": { lang: "c++", ver: "10.2.0" }, c: { lang: "c", ver: "10.2.0" }
};

export default function ChatApp() {
  const router = useRouter();
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false); 
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [modalArenaAberto, setModalArenaAberto] = useState(false);
  const [temaArena, setTemaArena] = useState("");
  const [chatMenuAberto, setChatMenuAberto] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const [xp, setXp] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [user, setUser] = useState<any>(null);

  const [pgAberto, setPgAberto] = useState(false);
  const [pgCodigo, setPgCodigo] = useState("");
  const [pgLinguagem, setPgLinguagem] = useState("");
  const [pgSaida, setPgSaida] = useState("");
  const [pgCarregando, setPgCarregando] = useState(false);

  // ESTADOS DO DICIONÁRIO DO CARECA
  const [dicionario, setDicionario] = useState<NotaDicionario[]>([]);
  const [modalDicionarioAberto, setModalDicionarioAberto] = useState(false);

  const fimDoChatRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const montou = useRef(false);

  // MÁGICA 1: CARREGAMENTO LOCAL-FIRST (Fim do Bug do Chat Desaparecer)
  useEffect(() => {
    const savedSessions = localStorage.getItem("carecaai_sessions");
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) setActiveSessionId(parsed[0].id);
      } catch (e) {}
    }
    
    // Carregar o Dicionário
    const savedDic = localStorage.getItem("carecaai_dicionario");
    if (savedDic) setDicionario(JSON.parse(savedDic));
  }, []);

  // Sincronizar qualquer alteração com o Local Storage IMEDIATAMENTE
  useEffect(() => {
    if (!montou.current) { montou.current = true; return; }
    localStorage.setItem("carecaai_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Escutar eventos de gravação no Dicionário
  const atualizarDicionarioLocal = () => {
    const dicSalvo = localStorage.getItem("carecaai_dicionario");
    if (dicSalvo) setDicionario(JSON.parse(dicSalvo));
  };

  useEffect(() => {
    window.addEventListener('dicionario_atualizado', atualizarDicionarioLocal);
    return () => window.removeEventListener('dicionario_atualizado', atualizarDicionarioLocal);
  }, []);

  const memoizedComponents = useMemo(() => ({
    blockquote({ children }: any) {
      return <blockquote className="border-l-4 border-red-500 bg-red-950/20 py-2 px-4 rounded-r-lg my-4 italic text-gray-300">{children}</blockquote>
    },
    code({ className, children, ...props }: any) {
      const match = /language-(\S+)/.exec(className || "");
      const rawCode = String(children).replace(/\n$/, "");
      if (match) {
        return (
          <div className="rounded-xl overflow-hidden border border-gray-700 my-5 bg-[#1e1e1e] shadow-xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950 border-b border-gray-800 flex-wrap gap-2">
              <span className="text-xs font-mono font-medium text-gray-400 lowercase">{match[1]}</span>
              <div className="flex gap-2">
                <button onClick={() => abrirPlayground(rawCode, match[1])} className="text-xs font-bold text-green-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md border border-green-900/50">▶️ PLAYGROUND</button>
                {/* O NOVO BOTÃO DE DICIONÁRIO */}
                <button onClick={() => {
                  const titulo = prompt("Que nome quer dar a esta anotação? (Ex: Como centrar uma div)");
                  if (titulo) {
                    const novaNota = { id: crypto.randomUUID(), titulo, codigo: rawCode, linguagem: match[1] };
                    const atual = JSON.parse(localStorage.getItem("carecaai_dicionario") || "[]");
                    localStorage.setItem("carecaai_dicionario", JSON.stringify([novaNota, ...atual]));
                    window.dispatchEvent(new Event('dicionario_atualizado'));
                    try { Haptics.notification({ type: NotificationType.Success }); } catch(e){}
                    alert("✅ Guardado no seu Dicionário!");
                  }
                }} className="text-xs font-bold text-yellow-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md border border-yellow-900/50">💾 GUARDAR</button>
                <button onClick={async () => { navigator.clipboard.writeText(rawCode); try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {} }} className="text-xs font-bold text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md">COPIAR</button>
              </div>
            </div>
            <SyntaxHighlighter 
              {...props} 
              style={vscDarkPlus} 
              language={match[1] === "c++" ? "cpp" : match[1]} 
              PreTag="div" 
              customStyle={{ margin: 0, padding: "1.25rem", background: "transparent", fontSize: "0.875rem" }}
            >
              {rawCode}
            </SyntaxHighlighter>
          </div>
        );
      }
      return <code {...props} className="bg-gray-900 text-orange-400 px-1.5 py-0.5 rounded-md text-sm font-mono border border-gray-800">{children}</code>;
    }
  }), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/");
      else { setUser(session.user); carregarDadosDaNuvem(session.user.id); }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/");
      else { setUser(session.user); carregarDadosDaNuvem(session.user.id); }
    });

    return () => authListener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    processarLinkDeDesafio();
    
    const savedCombo = localStorage.getItem("carecaai_combo");
    if (savedCombo) setCombo(parseInt(savedCombo, 10));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("carecaai_combo", combo.toString());
  }, [combo]);

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
          id: novoId, title: `⚔️ Duelo: ${decodedTema}`,
          mensagens: [
            { role: "user", content: `🥊 **Duelo Aceite!**\n\nFui desafiado no tema: **${decodedTema}**.\nVou consertar este bug e roubar os 50 XP!` },
            { role: "assistant", content: decodedContent }
          ],
          isArena: true, xpReivindicado: false
        };
        setSessions(prev => [novaSessao, ...prev]);
        setActiveSessionId(novoId);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {}
    }
  };

  const carregarDadosDaNuvem = async (userId: string) => {
    const { data: profile } = await supabase.from('profiles').select('xp').eq('id', userId).single();
    if (profile) setXp(profile.xp);

    const { data: chatsData } = await supabase.from('chats').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (chatsData && chatsData.length > 0) {
      const sessoesNuvem = chatsData.map(c => ({
        id: c.id, title: c.title, mensagens: c.mensagens, isArena: c.is_arena, xpReivindicado: c.xp_reivindicado, isPinned: c.is_pinned
      }));
      setSessions(prev => {
        // Se temos um desafio via link localmente não gravado, priorizamos mantê-lo
        const desafioAtual = prev.find(s => s.title.includes("⚔️ Duelo:"));
        if (desafioAtual && !sessoesNuvem.find(s => s.id === desafioAtual.id)) {
          salvarSessaoNaNuvem(desafioAtual, userId);
          return [desafioAtual, ...sessoesNuvem];
        }
        return sessoesNuvem;
      });
      // Só troca o ID se não houver um chat ativo!
      setActiveSessionId(prevId => prevId || sessoesNuvem[0].id);
    }
  };

  const salvarSessaoNaNuvem = async (sessao: ChatSession, forceUserId?: string) => {
    const targetUserId = forceUserId || user?.id;
    if (!targetUserId || !isOnline) return;
    await supabase.from('chats').upsert({
      id: sessao.id, user_id: targetUserId, title: sessao.title, mensagens: sessao.mensagens, 
      is_arena: sessao.isArena || false, xpReivindicado: sessao.xpReivindicado || false, 
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

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleTouchStart = (id: string) => {
    touchTimerRef.current = setTimeout(() => {
      setChatMenuAberto(id);
      try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
    }, 500); 
  };
  const handleTouchEndOrMove = () => { if (touchTimerRef.current) clearTimeout(touchTimerRef.current); };
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
    
    const novoCombo = combo + 1;
    let xpGanho = 50;

    if (novoCombo > 0 && novoCombo % 3 === 0) {
      xpGanho = 150; 
      alert(`🔥 COMBO X${novoCombo}! Destruíste os bugs! (+150 XP BÓNUS)`);
    }

    const novoXp = xp + xpGanho;
    setCombo(novoCombo);
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
        }
      }
      
      setCarregando(false);
      setDigitando(true);
      
      let index = 0;
      const charsPorVez = 8; 
      
      const intervalo = setInterval(() => {
        index += charsPorVez;
        const finalizou = index >= textoAcumulado.length;
        let textoAtual = finalizou ? textoAcumulado : textoAcumulado.slice(0, index);

        const blockCount = (textoAtual.match(/```/g) || []).length;
        if (blockCount % 2 !== 0) {
          textoAtual += "\n```"; 
        }

        setSessions((prev) => {
          const novasSessoes = prev.map((s) => {
            if (s.id === sessionId) {
              const ultimas = [...s.mensagens];
              ultimas[ultimas.length - 1].content = textoAtual;
              return { ...s, mensagens: ultimas };
            }
            return s;
          });
          
          if (finalizou) {
            const atual = novasSessoes.find(s => s.id === sessionId);
            if (atual) salvarSessaoNaNuvem(atual);
          }
          return novasSessoes;
        });

        const container = document.getElementById("chat-scroll-container");
        if (container) {
          container.scrollTop = container.scrollHeight;
        }

        if (finalizou) {
          clearInterval(intervalo);
          setDigitando(false);
        }
      }, 30); 

    } catch (error) {
      setCarregando(false);
      setDigitando(false);
      setSessions((prev) => prev.map((s) => {
        if (s.id === sessionId) {
          const ultimas = [...s.mensagens];
          ultimas[ultimas.length - 1].content = "❌ O servidor engasgou. Tente novamente, chefe!";
          return { ...s, mensagens: ultimas };
        }
        return s;
      }));
    }
  };

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || carregando || digitando || !isOnline) return;
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

    setTimeout(() => {
      const container = document.getElementById("chat-scroll-container");
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 50);

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
    }, 100);
  };

  const iniciarDesafioArena = async () => {
    if (!temaArena.trim() || carregando || digitando || !isOnline) return;
    try { await Haptics.notification({ type: NotificationType.Warning }); } catch (e) {}
    setModalArenaAberto(false);
    setCarregando(true);

    const novoId = crypto.randomUUID();
    const msgUI: Mensagem = { role: "user", content: `⚔️ **Desafio da Arena Iniciado!**\n\nTema escolhido: **${temaArena}**.\nMande o código quebrado, chefe!` };
    
    const msgAPI: Mensagem = { 
      role: "user", 
      content: `Aja como um 'Tech Lead' implacável. Inicie um desafio da ARENA DE BUGS sobre: ${temaArena}. 
      Inicie a resposta com um cabeçalho em Markdown:
      > 🔴 **NÍVEL:** [Fácil/Médio/Difícil]
      > 💻 **TECNOLOGIA:** ${temaArena}
      > 🎯 **MISSÃO:** [Resumo épico do problema]
      
      Abaixo do cabeçalho, envie o contexto e o código quebrado.
      ⚠️ REGRA MÁXIMA: NÃO DÊ A RESPOSTA! Se eu acertar nas próximas mensagens, inclua a tag [DESAFIO_CONCLUIDO].` 
    };

    const novaSessao: ChatSession = { id: novoId, title: `⚔️ Arena: ${temaArena}`, mensagens: [msgUI, { role: "assistant", content: "" }], isArena: true, xpReivindicado: false };
    setSessions(prev => [novaSessao, ...prev]);
    setActiveSessionId(novoId);
    setTemaArena("");
    if (window.innerWidth < 768) setMenuAberto(false);
    salvarSessaoNaNuvem(novaSessao);
    
    setTimeout(() => {
      const container = document.getElementById("chat-scroll-container");
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 50);
    
    await processarRequisicaoIA(novoId, [msgAPI]);
  };

  const desafiarAmigo = async () => {
    if (!sessaoAtiva || !sessaoAtiva.isArena || sessaoAtiva.mensagens.length < 2) return;
    const iaMensagem = sessaoAtiva.mensagens[1].content;
    const tema = sessaoAtiva.title.replace("⚔️ Arena: ", "").replace("⚔️ Duelo: ", "");
    
    const encodedTema = encodeBase64(tema);
    const encodedContent = encodeBase64(iaMensagem);
    const link = `${window.location.origin}/?challenge=${encodedContent}&tema=${encodedTema}`;
    const textoPartilha = `🥊 *Duelo CarecaAI!*\n\nFui desafiado na Arena de Bugs com este código de ${tema}. Duvido que consigas encontrar o bug antes de mim!\n\nClica no link para aceitar o duelo e ganhar XP no teu telemóvel:\n${link}`;

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await Share.share({ title: 'Desafio CarecaAI', text: textoPartilha, dialogTitle: 'Enviar duelo via' });
    } catch (e) {
      const textArea = document.createElement("textarea");
      textArea.value = textoPartilha;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); alert("Link copiado! Cole no WhatsApp do seu rival."); } 
      catch (err) { prompt("Copie o link:", link); } 
      finally { document.body.removeChild(textArea); }
    }
  };

  const abrirPlayground = (codigo: string, lang: string) => {
    setPgCodigo(codigo);
    setPgLinguagem(lang.toLowerCase());
    setPgSaida("");
    setPgAberto(true);
    try { Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
  };

  const executarCodigoPlayground = async () => {
    setPgCarregando(true);
    setPgSaida("A processar...");

    const linguagensWeb = ["html", "xml", "css", "javascript", "js"];
    
    if (linguagensWeb.includes(pgLinguagem)) {
      setPgSaida("RENDER_WEB");
      setPgCarregando(false);
      return;
    }

    const configLang = MAPA_PISTON[pgLinguagem];
    if (!configLang) {
      setPgSaida(`❌ Linguagem não suportada para execução: ${pgLinguagem}.`);
      setPgCarregando(false);
      return;
    }

    try {
      const res = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: configLang.lang, version: configLang.ver, files: [{ content: pgCodigo }] })
      });
      const data = await res.json();
      
      if (data.message && data.message.includes("whitelist only")) {
        setPgSaida("⚠️ O Servidor Público de Compilação está bloqueado (Whitelist Only).\n\nPara rodar C++ ou Python, precisaremos de hospedar uma API privada no futuro. \n\nDICA: Tenta rodar código JavaScript (JS), HTML ou CSS! O CarecaAI compila-os localmente no teu navegador sem precisar de internet!");
      } else if (data.run && data.run.output) {
        setPgSaida(data.run.output);
      } else if (data.message) {
        setPgSaida(`Erro na API: ${data.message}`);
      } else {
        setPgSaida("Executado sem saída de consola.");
      }
    } catch (err) {
      setPgSaida("❌ Falha ao conectar ao servidor de compilação. Verifica a tua internet.");
    }
    setPgCarregando(false);
  };

  const getIframeConteudo = () => {
    if (pgLinguagem === 'js' || pgLinguagem === 'javascript') {
      return `
        <style>body { background: #000; color: #4ade80; font-family: monospace; font-size: 14px; padding: 10px; margin: 0; }</style>
        <body>
          <script>
            const oldLog = console.log;
            console.log = function(...args) {
              document.body.innerHTML += args.join(' ') + '<br>';
              oldLog(...args);
            };
            try {
              ${pgCodigo}
            } catch (e) {
              document.body.innerHTML += '<span style="color:red">' + e.toString() + '</span><br>';
            }
          </script>
        </body>
      `;
    }
    return pgCodigo; 
  };

  if (!user) return <div className="h-[100dvh] flex items-center justify-center bg-gray-950 text-white">A carregar Terminal...</div>;

  const sessaoAtiva = sessions.find((s) => s.id === activeSessionId);
  const sessoesFixadas = sessions.filter(s => s.isPinned);
  const sessoesNormais = sessions.filter(s => !s.isPinned);
  const todasSessoesOrdenadas = [...sessoesFixadas, ...sessoesNormais];

  const lastMsg = sessaoAtiva?.mensagens[sessaoAtiva.mensagens.length - 1];
  const iaValidouAcerto = lastMsg?.role === "assistant" && lastMsg.content.includes("[DESAFIO_CONCLUIDO]");
  const mostrarBotaoXP = sessaoAtiva?.isArena && !sessaoAtiva?.xpReivindicado && iaValidouAcerto;

  return (
    <div className="flex h-[100dvh] bg-gray-950 text-gray-100 font-sans overflow-hidden">
      
      {/* O MODAL DA IDEIA 3: O DICIONÁRIO DO CARECA */}
      {modalDicionarioAberto && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-gray-900 border-2 border-yellow-900/50 p-6 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-yellow-900/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-yellow-500">📖 Dicionário do Careca</h3>
              <button onClick={() => setModalDicionarioAberto(false)} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {dicionario.length === 0 ? (
                <div className="text-center py-10">
                  <span className="text-6xl mb-4 block">🗂️</span>
                  <p className="text-gray-400">O teu cérebro está vazio. <br/>Clica em "💾 GUARDAR" num bloco de código para o guardares aqui!</p>
                </div>
              ) : (
                dicionario.map(nota => (
                  <div key={nota.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-white text-lg">{nota.titulo}</h4>
                        <span className="text-xs text-yellow-500 font-mono uppercase bg-yellow-900/20 border border-yellow-900/50 px-2 py-0.5 rounded">{nota.linguagem}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setModalDicionarioAberto(false); abrirPlayground(nota.codigo, nota.linguagem); }} className="text-xs font-bold bg-green-900/40 border border-green-900/50 text-green-400 px-3 py-1.5 rounded hover:bg-green-900/60">▶️ RODAR</button>
                        <button onClick={async () => { navigator.clipboard.writeText(nota.codigo); try { await Haptics.impact({ style: ImpactStyle.Light }); } catch(e){} }} className="text-xs font-bold bg-gray-800 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-700">COPIAR</button>
                        <button onClick={() => {
                          if (confirm("Tens a certeza que queres apagar esta anotação preciosa?")) {
                            const novo = dicionario.filter(d => d.id !== nota.id);
                            setDicionario(novo);
                            localStorage.setItem("carecaai_dicionario", JSON.stringify(novo));
                          }
                        }} className="text-xs font-bold bg-red-900/40 border border-red-900/50 text-red-400 px-3 py-1.5 rounded hover:bg-red-900/60">APAGAR</button>
                      </div>
                    </div>
                    <pre className="text-[13px] text-gray-400 bg-[#0d0d0d] p-3 rounded-lg overflow-x-auto max-h-40 border border-gray-900 font-mono">{nota.codigo}</pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {pgAberto && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-950">
          <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-orange-500 font-black">👨‍🦲 CarecaCode</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded uppercase">{pgLinguagem}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={executarCodigoPlayground} disabled={pgCarregando} className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold px-4 py-1.5 rounded-lg flex items-center gap-2">
                {pgCarregando ? "A processar..." : "▶️ Executar"}
              </button>
              <button onClick={() => setPgAberto(false)} className="bg-red-950/50 text-red-400 hover:text-white px-3 py-1.5 rounded-lg">Fechar</button>
            </div>
          </header>
          
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="flex-1 border-r border-gray-800 relative">
              <Editor
                height="100%" 
                theme="vs-dark"
                language={pgLinguagem === 'js' ? 'javascript' : pgLinguagem === 'py' ? 'python' : pgLinguagem}
                value={pgCodigo} 
                onChange={(val) => setPgCodigo(val || "")}
                options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on" }}
              />
            </div>
            
            <div className="h-1/3 md:h-full md:w-1/3 bg-black border-t md:border-t-0 border-gray-800 p-4 flex flex-col">
              <span className="text-gray-500 text-xs uppercase font-bold mb-2">Saída (Output)</span>
              <div className="flex-1 overflow-auto rounded border border-gray-800 bg-[#0d0d0d]">
                {pgSaida === "RENDER_WEB" ? (
                  <iframe srcDoc={getIframeConteudo()} className="w-full h-full bg-white" title="Web Preview" sandbox="allow-scripts allow-modals" />
                ) : (
                  <pre className="p-3 text-green-400 font-mono text-sm whitespace-pre-wrap">{pgSaida || "Clica em Executar para ver a magia acontecer..."}</pre>
                )}
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
              disabled={!isOnline} placeholder={isOnline ? "Ex: React, Python, C++..." : "Sem internet..."} 
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
              {combo > 0 && (
                <span className="text-[10px] font-black text-white bg-gradient-to-r from-red-500 to-orange-500 px-2 py-0.5 rounded shadow-lg shadow-red-900/50 animate-pulse">
                  🔥 X{combo}
                </span>
              )}
              <span className="text-xs text-gray-400">{xp} / {statusAtual.max} XP</span>
              <button onClick={logout} className="text-[10px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded border border-red-900/50 hover:bg-red-900/60 transition-colors" title="Sair da Conta">Sair</button>
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
          {/* BOTÃO DO DICIONÁRIO */}
          <button onClick={() => setModalDicionarioAberto(true)} className="w-full bg-yellow-950/30 hover:bg-yellow-900/50 border border-yellow-900/50 text-yellow-500 hover:text-yellow-400 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
            📖 Meu Dicionário
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1 pb-20">
          {todasSessoesOrdenadas.length === 0 ? (
            <p className="text-xs text-gray-500 text-center mt-6">Sem histórico.</p>
          ) : (
            todasSessoesOrdenadas.map((sessao) => (
              <div 
                key={sessao.id} onClick={() => trocarChat(sessao.id)}
                onContextMenu={(e) => handleContextMenu(e, sessao.id)}
                onTouchStart={() => handleTouchStart(sessao.id)}
                onTouchEnd={handleTouchEndOrMove} onTouchMove={handleTouchEndOrMove}
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
                      <button onClick={(e) => togglePinChat(sessao.id, e)} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                        {sessao.isPinned ? "📍 Desfixar" : "📌 Fixar"}
                      </button>
                      <button onClick={(e) => iniciarEdicao(sessao.id, sessao.title, e)} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                        ✏️ Renomear
                      </button>
                      <div className="border-t border-gray-700 my-1"></div>
                      <button onClick={(e) => deletarChat(sessao.id, e)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors">
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
            {sessaoAtiva?.isArena && sessaoAtiva.mensagens.length >= 2 && (
              <button onClick={desafiarAmigo} className="bg-blue-600 hover:bg-blue-500 text-white text-xs md:text-sm font-bold py-1.5 md:py-2 px-3 md:px-4 rounded-lg shadow-lg shadow-blue-900/20 transition-transform active:scale-95">
                🔗 Desafiar Amigo
              </button>
            )}
            {mostrarBotaoXP && (
              <button onClick={reivindicarXP} className="bg-green-600 hover:bg-green-500 text-white text-xs md:text-sm font-bold py-1.5 md:py-2 px-3 md:px-4 rounded-lg shadow-lg shadow-green-900/20 transition-transform active:scale-95 animate-pulse">
                ✅ (+50 XP)
              </button>
            )}
            {sessaoAtiva?.xpReivindicado && (
              <span className="text-xs font-bold text-green-500 bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-800">🎉 XP Ganho</span>
            )}
          </div>
        </header>

        <main id="chat-scroll-container" className="flex-1 p-4 md:p-6 overflow-y-auto w-full max-w-4xl mx-auto relative" onClick={() => setChatMenuAberto(null)}>
          
          {!sessaoAtiva || sessaoAtiva.mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-4 animate-fade-in pb-10">
              <span className={`text-7xl md:text-8xl mb-6 drop-shadow-lg transition-transform ${!isOnline ? "grayscale opacity-50" : ""}`}>👨‍🦲</span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-200">
                {isOnline ? "Abre o terminal, o que precisas?" : "Estou sem sinal, chefe!"}
              </h2>
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-6">

              {sessaoAtiva.mensagens.map((msg, index) => {
                const displayContent = msg.content.replace(/\[DESAFIO_CONCLUIDO\]/g, "").trim();
                const isLastAssistantMessage = msg.role === "assistant" && index === sessaoAtiva.mensagens.length - 1;
                
                if (!displayContent && msg.role === "assistant" && carregando && isLastAssistantMessage) {
                  return (
                    <div key={index} className="flex flex-col w-full items-start">
                      <div className="flex items-center gap-2 text-orange-500 text-sm font-bold mb-2 ml-2 animate-pulse">
                        <span className="text-lg">✨</span> A estruturar a resposta...
                      </div>
                    </div>
                  );
                }
                
                if (!displayContent && msg.role === "assistant") return null;

                return (
                  <div key={index} className={`flex flex-col w-full ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[95%] md:max-w-[85%] min-w-0 rounded-3xl p-5 shadow-md ${msg.role === "user" ? "bg-orange-600 text-white rounded-tr-none" : "bg-gray-800 text-gray-200 border border-gray-700/50 rounded-tl-none animate-fade-in"}`}>
                      {msg.role === "user" ? (
                        <div className="break-words whitespace-pre-wrap text-[15px] leading-relaxed">{displayContent}</div>
                      ) : (
                        <div className="prose prose-invert max-w-none overflow-x-auto break-words w-full prose-pre:bg-[#1e1e1e] prose-pre:m-0 prose-pre:p-0 text-[15px] leading-relaxed">
                          <ReactMarkdown components={memoizedComponents}>
                            {displayContent}
                          </ReactMarkdown>
                          
                          {isLastAssistantMessage && digitando && (
                            <span className="inline-block w-2 h-4 bg-orange-500 ml-1 animate-pulse align-middle"></span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={fimDoChatRef} className="h-4"></div>
            </div>
          )}
        </main>

        <footer className="p-3 md:p-5 bg-gray-900 border-t border-gray-800 pb-safe" onClick={() => setChatMenuAberto(null)}>
          <form onSubmit={enviarMensagem} className="max-w-4xl mx-auto relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={carregando || digitando || !isOnline} placeholder={isOnline ? "Digita a tua dúvida ou responde ao desafio..." : "Sem sinal..."} className={`w-full bg-gray-950 border text-[15px] md:text-base rounded-2xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 block p-3.5 md:p-4 pr-14 outline-none shadow-inner transition-all ${!isOnline ? "border-red-900/50 text-red-400 cursor-not-allowed" : "border-gray-700 text-white disabled:opacity-50"}`} />
            <button type="submit" disabled={carregando || digitando || !input.trim() || !isOnline} className="absolute right-2 p-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-400 hover:to-orange-500 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 transition-all flex items-center justify-center h-10 w-10 md:h-11 md:w-11 shadow-md"><span className="mb-[2px] ml-[2px]">🚀</span></button>
          </form>
        </footer>
      </div>
    </div>
  );
}