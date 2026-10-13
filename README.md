# Sound Agriculture • Validador & Playground do Chat Flávio (QA)

Aplicação web desenvolvida para a equipe da **Sound Agriculture** testar, homologar e estressar o agente comercial inteligente **Flávio (WhatsApp Bot)**, com sistema integrado para apontar e registrar falhas nas respostas.

---

## 🎯 Principais Funcionalidades

1. **Simulador WhatsApp Web Fiel:**
   - Interface visual moderna e responsiva idêntica ao WhatsApp comercial da Sound Agriculture.
   - Indicador de digitação dinâmico (*"Flávio está digitando..."*).
   - Medição de latência real de cada resposta (tempo de resposta do n8n).

2. **Conexão Direta com o n8n:**
   - Conectado ao webhook ativo de produção:
     `https://agentesn8n-n8n.cqc86v.easypanel.host/webhook/ab47b89d-3100-4b96-b01c-3281b673cb2c/chat`
   - Gerenciamento de `sessionId` único com botão de **Resetar Sessão** (para testar novos clientes sem interferência de memória anterior).

3. **Sistema de Marcação de Falhas ("Apontar Erro"):**
   - Cada resposta do bot conta com o botão **🚩 Apontar Erro**.
   - Categorias pré-mapeadas com base nas diretrizes da Sound:
     - *Regra do Recuo / Empatia (Ignorou desabafo do produtor)*
     - *Alucinação de Sacas (Prometeu números fixos sem explicar variabilidade)*
     - *Venda Direta / Preço (Tentou vender direto em vez de direcionar para revenda)*
     - *Pergunta em Bloco (Fez mais de 1 pergunta por mensagem)*
     - *Mistura em Tanque (Não recomendou teste prévio de calda/jarro)*
     - *Erro de Perfil (Confundiu produtor com canal)*
     - *Tom Inadequado / Prolixo*
     - *Outro Motivo*
   - Níveis de severidade: **Baixa**, **Média** ou **Crítica**.
   - Campo para o testador explicar como o bot deveria ter respondido.

4. **Painel Geral de Auditoria & Exportação:**
   - Gaveta lateral (*Drawer*) que lista todos os feedbacks apontados por qualquer membro da equipe.
   - Identificação do testador (`Carlos`, `Agrônomo Sound`, etc.).
   - Persistência automática em `localStorage`.
   - **📥 Exportar JSON:** Arquivo completo para ajustes no prompt e nós do n8n.
   - **📊 Exportar CSV (Excel):** Planilha formatada com codificação UTF-8 para análise em reuniões de alinhamento.
   - **💾 Baixar Transcrição:** Exporta o diálogo completo em `.txt`.

5. **Cenários Rápidos de Estresse:**
   - Botões com 1 clique para simular:
     - Produtor Rural em Mato Grosso.
     - Revenda / Cooperativa em Goiás.
     - Armadilha de Preço e Venda Direta.
     - Armadilha de Promessa de Sacas Fixas.
     - Dúvida técnica de Mistura em Tanque.
     - Desabafo com seca/perda de safra (Regra do Recuo).

---

## 🚀 Como Subir na Vercel

A aplicação é 100% estática (HTML, CSS e JS puro) e já possui o arquivo `vercel.json` configurado.

### Opção 1: Via Vercel CLI (Direto do terminal)
No terminal do projeto:
```bash
cd "c:\Users\devpe\Downloads\Nova pasta (16)\sound-chat-tester"
npx vercel
```
*(Basta seguir as instruções na tela e o link público ficará disponível em menos de 1 minuto).*

Para subir direto em produção:
```bash
npx vercel --prod
```

### Opção 2: Via GitHub / Dashboard da Vercel
1. Crie um repositório no GitHub com a pasta `sound-chat-tester`.
2. Acesse [vercel.com](https://vercel.com) e clique em **Add New > Project**.
3. Importe o repositório. O build preset é **Other** (Static HTML) com output directory `./`.
4. Clique em **Deploy**.

---

## 💻 Como Rodar e Testar Localmente

Você pode abrir diretamente o arquivo `index.html` em qualquer navegador ou rodar um servidor local:

```bash
# Usando npx serve
npx serve "c:\Users\devpe\Downloads\Nova pasta (16)\sound-chat-tester"

# Ou usando Python
python -m http.server 3000 --directory "c:\Users\devpe\Downloads\Nova pasta (16)\sound-chat-tester"
```
Acesse `http://localhost:3000`.
