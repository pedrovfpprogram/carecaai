# 👨‍🦲 CarecaAI (v0.3 - Production Ready)

O **CarecaAI** é um tutor de programação inteligente e implacável, focado em ajudar desenvolvedores a resolver bugs, entender lógica complexa e aprender novas tecnologias com uma abordagem gamificada e direta.

---

## 🚀 O que há de novo na Versão 0.3?

O CarecaAI deu um salto de uma página web para uma experiência nativa de telemóvel:

* **🎖️ Sistema de Patentes e XP:** Ganhe experiência ao derrotar a IA na Arena de Bugs. Suba de *Estagiário Perdido* até *Sénior Sem Cabelo* com uma barra de progresso visual.
* **📶 Modo Offline Inteligente:** Ficar sem internet não quebra a app. O sistema deteta a falha de rede instantaneamente, avisa o utilizador e bloqueia envios fantasma.
* **📲 Partilha Nativa e Haptics:** Integração profunda com o telemóvel via Capacitor. Sinta a vibração física ao enviar mensagens ou ganhar XP, e exporte blocos de código diretamente para o WhatsApp ou Discord com um clique.
* **📌 Gestão de Chats Avançada:** Novo menu flutuante (estilo Gemini) que permite Renomear, Apagar e **Fixar (Pin)** as suas conversas mais importantes no topo da lista.

## ⚔️ A Arena de Bugs

Um modo interativo onde a IA assume o papel de um Tech Lead carrasco, gerando código propositadamente quebrado (em qualquer linguagem que escolher). Descubra o erro, conserte o código e reivindique os seus pontos de XP!

---

## 🛠️ Tecnologias Utilizadas

- **Front-end:** [Next.js 16](https://nextjs.org/), [Tailwind CSS v4](https://tailwindcss.com/)
- **IA/Back-end:** [Hugging Face Inference API](https://huggingface.co/) (Qwen2.5-Coder-32B)
- **Mobile (Capacitor):** Haptics (Vibração), Share (Partilha Nativa).
- **Persistência:** `localStorage` (Histórico de chats e pontuação salvos localmente).

---

## ⚙️ Como usar

1. **Site web**
   
   [CarecaAI](carecaai.vercel.app)