"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LandingPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modoAuth, setModoAuth] = useState<"login" | "cadastro">("login");
  const [erro, setErro] = useState("");
  const [sessaoAtiva, setSessaoAtiva] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessaoAtiva(true);
    });
  }, []);

  const autenticar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!email || !senha) {
      setErro("Preenche todos os campos, chefe!");
      return;
    }
    
    setCarregando(true);
    let authError;

    if (modoAuth === "cadastro") {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      authError = error;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      authError = error;
    }

    if (authError) {
      setErro(authError.message);
      setCarregando(false);
    } else {
      router.push("/chat");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* NAV */}
      <nav className="w-full border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-black bg-gradient-to-r from-orange-400 to-yellow-500 bg-clip-text text-transparent tracking-tight">
            👨‍🦲 CarecaAI
          </h1>
          {sessaoAtiva && (
            <button onClick={() => router.push("/chat")} className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2 rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20">
              Ir para o Terminal
            </button>
          )}
        </div>
      </nav>

      {/* HEADER / HERO SECTION */}
      <header className="flex-1 flex flex-col lg:flex-row items-center justify-center max-w-6xl mx-auto px-6 py-12 lg:py-20 gap-12">
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-block bg-orange-950/40 border border-orange-900/50 text-orange-400 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-2">
            Versão 0.4.0 • Cloud Sync
          </div>
          <h2 className="text-4xl lg:text-6xl font-black leading-tight">
            O teu Tech Lead <br/><span className="text-orange-500">Implacável.</span>
          </h2>
          <p className="text-gray-400 text-lg lg:text-xl max-w-lg mx-auto lg:mx-0">
            Gera código, resolve bugs, ganha XP na Arena e sincroniza as tuas conversas na nuvem. Um tutor desenhado para te levar de Estagiário a Sénior.
          </p>
        </div>

        {/* AUTH CARD */}
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-yellow-400"></div>
          
          {sessaoAtiva ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">👋</div>
              <h3 className="text-2xl font-bold text-white mb-2">Bem-vindo de volta!</h3>
              <p className="text-gray-400 mb-6">A tua sessão está ativa e o código espera por ti.</p>
              <button onClick={() => router.push("/chat")} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg">
                Entrar no Chat 🚀
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-8 border-b border-gray-800 pb-4">
                <button 
                  onClick={() => { setModoAuth("login"); setErro(""); }} 
                  className={`flex-1 font-bold text-lg transition-colors ${modoAuth === "login" ? "text-orange-500" : "text-gray-500 hover:text-gray-300"}`}
                >
                  Entrar
                </button>
                <button 
                  onClick={() => { setModoAuth("cadastro"); setErro(""); }} 
                  className={`flex-1 font-bold text-lg transition-colors ${modoAuth === "cadastro" ? "text-orange-500" : "text-gray-500 hover:text-gray-300"}`}
                >
                  Registar
                </button>
              </div>

              <form onSubmit={autenticar} className="space-y-4">
                {erro && <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm p-3 rounded-lg text-center">{erro}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">E-mail</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={carregando} className="w-full bg-gray-950 border border-gray-700 p-3.5 rounded-xl text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all" placeholder="dev@exemplo.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Senha</label>
                  <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} disabled={carregando} className="w-full bg-gray-950 border border-gray-700 p-3.5 rounded-xl text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all" placeholder="••••••••" />
                </div>
                <button type="submit" disabled={carregando} className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg mt-2">
                  {carregando ? "A conectar à nuvem..." : (modoAuth === "login" ? "Acessar Sistema" : "Criar Conta e Começar")}
                </button>
              </form>
            </>
          )}
        </div>
      </header>

      {/* GRID DE FUNCIONALIDADES */}
      <main className="bg-gray-900/50 border-t border-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-sm">
            <div className="text-3xl mb-4">⚔️</div>
            <h3 className="text-xl font-bold text-white mb-2">Arena de Bugs</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Desafia a IA num duelo de código. Encontra o erro escondido, conserta o algoritmo e sobe a tua patente de desenvolvedor.</p>
          </div>
          <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-sm">
            <div className="text-3xl mb-4">☁️</div>
            <h3 className="text-xl font-bold text-white mb-2">Cloud Sync</h3>
            <p className="text-gray-400 text-sm leading-relaxed">O teu código, em qualquer lado. O CarecaAI guarda o teu histórico de conversas e o teu nível de XP de forma segura na nuvem.</p>
          </div>
          <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-sm">
            <div className="text-3xl mb-4">📱</div>
            <h3 className="text-xl font-bold text-white mb-2">Experiência Nativa</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Partilha blocos de código com um clique, recebe feedback háptico (vibração) e continua a usar mesmo em Modo Offline.</p>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-8 text-center text-gray-500 text-sm border-t border-gray-800">
        <p>Desenvolvido por Pedro • 404Club & CarecaAI Ecosystem</p>
      </footer>
    </div>
  );
}