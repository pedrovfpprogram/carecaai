# 👨‍🦲 CarecaAI — Ecossistema de Aprendizagem Interativo (v0.4.0)

O **CarecaAI** é um tutor de programação e Tech Lead implacável projetado para levar desenvolvedores do nível Estagiário a Sénior. Através de uma arquitetura híbrida e modular construída em Next.js 16, a plataforma combina inteligência artificial com gamificação, execução de código local e sincronização em nuvem.

---

## 🚀 Novidades da Versão 0.4.0

### 1. Arquitetura Local-First & Cloud Sync ☁️
* **Zero Latência:** O histórico de conversas e níveis de XP passam a ser carregados instantaneamente a partir do armazenamento nativo do dispositivo (`localStorage`), eliminando perdas de dados ao atualizar a página.
* **Sincronização Supabase:** Autenticação e espelhamento em tempo real com o banco de dados na nuvem assim que o status passa para `☁️ ON`.

### 2. CarecaCode Playground & Mágica Local 💻
* **Editor Integrado:** Acoplado com o **Monaco Editor** (o mesmo motor do VS Code), permitindo alteração de código em tempo real diretamente dentro da plataforma.
* **Execução Sandbox:** Compilação e execução nativa para linguagens Web (**JavaScript, HTML e CSS**) rodando localmente no navegador, garantindo imunidade a bloqueios de APIs externas.

### 3. O Dicionário do Careca (2º Cérebro) 🧠
* **Cofre de Snippets:** Adicionado o botão `💾 GUARDAR` em todos os blocos de código gerados pela IA. 
* **Caderno Persistente:** Permite armazenar apontamentos técnicos importantes acessíveis a qualquer momento através do painel lateral para consulta, cópia ou re-execução direta no Playground.

### 4. Sistema de Combos & Ataques da API ⚔️
* **RPG de Bugs:** A Arena de Bugs agora gera relatórios de missões estruturados contendo Nível de Ameaça, Tecnologia e Objetivos claros.
* **Multiplicador de Chamas (🔥):** Acertar desafios seguidos ativa o multiplicador de Combo. Chegar a um Combo múltiplo de 3 garante um bónus brutal de **+150 XP**.

---

## 🛠️ Tecnologias Utilizadas

* **Framework:** [Next.js 16 (Turbopack)](https://nextjs.org/)
* **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
* **Banco de Dados & Auth:** [Supabase](https://supabase.com/)
* **Motor do Editor:** [@monaco-editor/react](https://www.npmjs.com/package/@monaco-editor/react)
* **Renderização de Texto:** [ReactMarkdown](https://github.com/remarkjs/react-markdown) & [Prism Syntax Highlighter](https://github.com/prismjs/prism)
* **Pontes Nativas (Mobile):** [Capacitor Core & Plugins (Haptics, Share)](https://capacitorjs.com/)

---
