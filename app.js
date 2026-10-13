/**
 * SOUND AGRICULTURE • SIMULADOR DE ATENDIMENTO FLÁVIO
 * Aplicação de validação e apontamento de melhorias para a equipe Sound.
 */

// Webhook de atendimento
const WEBHOOK_URL = 'https://agentesn8n-n8n.cqc86v.easypanel.host/webhook/ab47b89d-3100-4b96-b01c-3281b673cb2c/chat';

// Webhook que grava os erros marcados na Data Table do n8n
const FEEDBACK_WEBHOOK_URL = 'https://agentesn8n-n8n.cqc86v.easypanel.host/webhook/sound-chat-feedback';

// Chaves locais
const STORAGE_KEYS = {
  SESSION_ID: 'sound_chat_session_id',
  FEEDBACKS: 'sound_chat_feedbacks',
  PENDING_FEEDBACKS: 'sound_chat_pending_feedbacks'
};

const WELCOME_MESSAGE = `Olá, tudo bem? Aqui é o Flávio, da Sound Agriculture! Prazer falar com você.

Pra eu te atender da melhor forma: você atende produtores por uma revenda ou cooperativa, é produtor rural buscando pra sua própria lavoura, ou está procurando outro tipo de informação?`;

// Perfis Suportados
const PROFILES = {
  TRIAGEM: { code: 'TRIAGEM', label: '⏳ Triagem Inicial', className: 'tag-triagem' },
  PRODUTOR: { code: 'PRO', label: '🌾 Produtor Rural', className: 'tag-produtor' },
  CANAL: { code: 'CAN', label: '🏢 Revenda / Cooperativa', className: 'tag-canal' },
  RTV: { code: 'RTV', label: '🤝 Representante (RTV)', className: 'tag-rtv' },
  FORNECEDOR: { code: 'FOR_NDI', label: '📄 Institucional / Outro', className: 'tag-fornecedor' }
};

// Estado da Aplicação
const state = {
  sessionId: '',
  feedbacks: [],
  isSending: false,
  lastUserMessage: '',
  activeFlagTarget: null,
  currentProfile: PROFILES.TRIAGEM
};

// Elementos DOM
const dom = {
  chatMessages: document.getElementById('chatMessages'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  typingIndicatorRow: document.getElementById('typingIndicatorRow'),
  newChatTopBtn: document.getElementById('newChatTopBtn'),
  newChatInnerBtn: document.getElementById('newChatInnerBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  
  // Feedback Modal
  feedbackModal: document.getElementById('feedbackModal'),
  closeFeedbackModalBtn: document.getElementById('closeFeedbackModalBtn'),
  cancelFeedbackBtn: document.getElementById('cancelFeedbackBtn'),
  saveFeedbackBtn: document.getElementById('saveFeedbackBtn'),
  modalFlaggedQuote: document.getElementById('modalFlaggedQuote'),
  feedbackCommentInput: document.getElementById('feedbackCommentInput'),
  
  // Feedback Drawer
  feedbackDrawer: document.getElementById('feedbackDrawer'),
  openFeedbackDrawerBtn: document.getElementById('openFeedbackDrawerBtn'),
  closeFeedbackDrawerBtn: document.getElementById('closeFeedbackDrawerBtn'),
  feedbackBadgeCount: document.getElementById('feedbackBadgeCount'),
  drawerFeedbackCount: document.getElementById('drawerFeedbackCount'),
  feedbackListContainer: document.getElementById('feedbackListContainer'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  clearFeedbacksBtn: document.getElementById('clearFeedbacksBtn')
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initSession();
  loadFeedbacks();
  setupEventListeners();
  autoResizeTextarea();
  flushPendingFeedbacks();
});

// ==========================================
// ENVIO DOS ERROS PARA O SERVIDOR (n8n)
// ==========================================
function getPendingFeedbacks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_FEEDBACKS)) || [];
  } catch (e) {
    return [];
  }
}

function setPendingFeedbacks(list) {
  localStorage.setItem(STORAGE_KEYS.PENDING_FEEDBACKS, JSON.stringify(list));
}

async function postFeedback(record) {
  const response = await fetch(FEEDBACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataHora: record.formattedTime,
      sessao: record.sessionId || '',
      perfilAtribuido: record.attributedProfile || '',
      mensagemUsuario: record.userPrompt || '',
      respostaFlavio: record.botResponse || '',
      tipoErro: record.category || '',
      gravidade: record.severity || '',
      comentario: record.comment || ''
    })
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
}

// Tenta enviar; se falhar, guarda na fila para reenviar depois
async function sendFeedbackToServer(record) {
  try {
    await postFeedback(record);
  } catch (err) {
    console.warn('Não foi possível enviar o erro ao servidor, será reenviado depois.', err);
    const pending = getPendingFeedbacks();
    pending.push(record);
    setPendingFeedbacks(pending);
  }
}

// Reenvia os erros que ficaram pendentes (ex.: sem internet)
async function flushPendingFeedbacks() {
  const pending = getPendingFeedbacks();
  if (pending.length === 0) return;

  const stillPending = [];
  for (const record of pending) {
    try {
      await postFeedback(record);
    } catch (err) {
      stillPending.push(record);
    }
  }
  setPendingFeedbacks(stillPending);
}

function initSession(forceNew = false) {
  if (forceNew || !localStorage.getItem(STORAGE_KEYS.SESSION_ID)) {
    const newId = 'sound-conv-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, newId);
    state.sessionId = newId;
  } else {
    state.sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  }
}

function updateProfileBadge(profileKey) {
  const profile = PROFILES[profileKey] || PROFILES.TRIAGEM;
  state.currentProfile = profile;
  
  const badge = document.getElementById('profileTagValue');
  if (badge) {
    badge.className = `profile-tag ${profile.className}`;
    badge.textContent = profile.label;
    badge.title = `Perfil identificado pelo bot: ${profile.label} (${profile.code})`;
  }
}

function detectProfileFromContext(userMsg, botMsg, rawProfile) {
  if (rawProfile) {
    const upper = String(rawProfile).toUpperCase();
    if (upper === 'PRO') return 'PRODUTOR';
    if (upper === 'CAN') return 'CANAL';
    if (upper === 'RTV') return 'RTV';
    if (upper === 'FOR_NDI' || upper === 'FOR') return 'FORNECEDOR';
    if (upper === 'TRIAGEM') return 'TRIAGEM';
  }

  // Regra de persistência: se já detectou canal ou produtor, mantém
  if (state.currentProfile && state.currentProfile.code !== 'TRIAGEM') {
    const currentKey = Object.keys(PROFILES).find(k => PROFILES[k].code === state.currentProfile.code);
    if (currentKey) return currentKey;
  }

  const combined = (userMsg + ' ' + botMsg).toLowerCase();

  if (
    combined.includes('revenda') ||
    combined.includes('cooperativa') ||
    combined.includes('maisagro') ||
    combined.includes('atendo produtores') ||
    combined.includes('decisão de portfólio') ||
    combined.includes('decisor de portfólio') ||
    combined.includes('novos produtos aí na revenda') ||
    combined.includes('distribuidora')
  ) {
    return 'CANAL';
  }

  if (
    combined.includes('produtor rural') ||
    combined.includes('minha lavoura') ||
    combined.includes('minha fazenda') ||
    combined.includes('hectares') ||
    combined.includes('planto') ||
    combined.includes('área de soja') ||
    combined.includes('área de milho') ||
    combined.includes('adubação')
  ) {
    return 'PRODUTOR';
  }

  if (
    combined.includes('rtv') ||
    combined.includes('representante comercial') ||
    combined.includes('agrônomo de revenda') ||
    combined.includes('vendedor de campo')
  ) {
    return 'RTV';
  }

  if (
    combined.includes('contato@soundag') ||
    combined.includes('assessoria de comunicação') ||
    combined.includes('carreiras no linkedin')
  ) {
    return 'FORNECEDOR';
  }

  return 'TRIAGEM';
}

function startNewConversation() {
  initSession(true);
  updateProfileBadge('TRIAGEM');
  
  // Remove mensagens anteriores deixando apenas o indicador de digitação
  const allRows = dom.chatMessages.querySelectorAll('.msg-row');
  allRows.forEach(row => {
    if (row.id !== 'typingIndicatorRow') row.remove();
  });

  // Remove divisores antigos
  const dividers = dom.chatMessages.querySelectorAll('.chat-date-divider');
  dividers.forEach(d => d.remove());

  // Adiciona novo divisor e mensagem de boas-vindas limpa
  const divider = document.createElement('div');
  divider.className = 'chat-date-divider';
  divider.textContent = 'Nova Conversa Iniciada';
  dom.chatMessages.insertBefore(divider, dom.typingIndicatorRow);

  // Insere mensagem inicial do Flávio
  appendBotMessage(WELCOME_MESSAGE, null, true);

  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';
  dom.messageInput.focus();
}

function loadFeedbacks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FEEDBACKS);
    state.feedbacks = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.feedbacks = [];
  }
  updateFeedbackBadges();
}

function saveFeedbacks() {
  localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(state.feedbacks));
  updateFeedbackBadges();
}

function updateFeedbackBadges() {
  const count = state.feedbacks.length;
  if (dom.feedbackBadgeCount) dom.feedbackBadgeCount.textContent = count;
  if (dom.drawerFeedbackCount) dom.drawerFeedbackCount.textContent = count;
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  // Envio de mensagem
  dom.sendBtn.addEventListener('click', handleSendMessage);
  
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Botões de Nova Conversa (Simples e Direto)
  if (dom.newChatTopBtn) {
    dom.newChatTopBtn.addEventListener('click', () => {
      if (confirm('Deseja iniciar uma nova conversa com o Flávio do zero?')) {
        startNewConversation();
      }
    });
  }

  if (dom.newChatInnerBtn) {
    dom.newChatInnerBtn.addEventListener('click', () => {
      if (confirm('Deseja iniciar uma nova conversa com o Flávio do zero?')) {
        startNewConversation();
      }
    });
  }

  // Limpar tela do chat
  if (dom.clearChatBtn) {
    dom.clearChatBtn.addEventListener('click', () => {
      if (confirm('Deseja limpar as mensagens da tela? (Os erros já salvos não serão apagados)')) {
        const messages = dom.chatMessages.querySelectorAll('.msg-row');
        messages.forEach((row, index) => {
          if (index > 0 && row.id !== 'typingIndicatorRow') row.remove();
        });
      }
    });
  }

  // Exportar histórico de conversa em texto
  if (dom.exportChatBtn) {
    dom.exportChatBtn.addEventListener('click', exportChatTranscript);
  }

  // Cenários rápidos da sidebar
  document.querySelectorAll('.scenario-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt) {
        dom.messageInput.value = prompt;
        dom.messageInput.focus();
        handleSendMessage();
      }
    });
  });

  // Modal de Feedback
  dom.closeFeedbackModalBtn.addEventListener('click', closeFeedbackModal);
  dom.cancelFeedbackBtn.addEventListener('click', closeFeedbackModal);
  dom.saveFeedbackBtn.addEventListener('click', handleSaveFeedback);

  // Gravidade no modal
  document.querySelectorAll('.severity-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.severity-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
    });
  });

  // Categoria no modal
  document.querySelectorAll('.category-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      const radio = option.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Drawer de Feedbacks
  dom.openFeedbackDrawerBtn.addEventListener('click', openFeedbackDrawer);
  dom.closeFeedbackDrawerBtn.addEventListener('click', closeFeedbackDrawer);
  dom.feedbackDrawer.addEventListener('click', (e) => {
    if (e.target === dom.feedbackDrawer) closeFeedbackDrawer();
  });

  // Exportações
  dom.exportJsonBtn.addEventListener('click', exportFeedbacksAsJson);
  dom.exportCsvBtn.addEventListener('click', exportFeedbacksAsCsv);
  dom.clearFeedbacksBtn.addEventListener('click', handleClearFeedbacks);
}

// Auto-expand textarea
function autoResizeTextarea() {
  dom.messageInput.addEventListener('input', () => {
    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 120) + 'px';
  });
}

// ==========================================
// ENVIO E RECEBIMENTO DE MENSAGENS
// ==========================================
async function handleSendMessage() {
  const text = dom.messageInput.value.trim();
  if (!text || state.isSending) return;

  state.isSending = true;
  state.lastUserMessage = text;
  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';
  dom.sendBtn.disabled = true;

  // Renderiza a mensagem do usuário na tela
  appendUserMessage(text);
  showTypingIndicator();

  const startTime = performance.now();

  try {
    const payload = {
      chatInput: text,
      sessionId: state.sessionId
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const elapsedMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      throw new Error(`Código ${response.status}`);
    }

    const data = await response.json();
    const botText = data.output || data.response || data.text || 'Sem resposta do atendente.';

    // Atualiza o perfil atribuído na conversa
    const detected = detectProfileFromContext(text, botText, data.perfil);
    updateProfileBadge(detected);

    hideTypingIndicator();
    appendBotMessage(botText, elapsedMs);

  } catch (err) {
    console.error('Falha no envio da mensagem:', err);
    hideTypingIndicator();
    appendErrorMessage('⚠️ O Flávio não conseguiu responder no momento. Por favor, tente enviar novamente.');
  } finally {
    state.isSending = false;
    dom.sendBtn.disabled = false;
    dom.messageInput.focus();
  }
}

// ==========================================
// RENDERIZAÇÃO DE MENSAGENS
// ==========================================
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  
  row.innerHTML = `
    <div class="msg-bubble">
      <div class="msg-text">${escapeHtml(text)}</div>
      <div class="msg-meta">
        <span>${getCurrentTime()}</span>
        <span style="color: var(--wa-check-blue);">✔✔</span>
      </div>
    </div>
  `;

  insertMessageBeforeTyping(row);
  scrollToBottom();
}

function appendBotMessage(text, latencyMs, isInitial = false) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  
  const timeLabel = isInitial ? 'Início da conversa' : getCurrentTime();

  row.innerHTML = `
    <div class="msg-bubble">
      <div class="msg-sender">Flávio • Sound Agriculture</div>
      <div class="msg-text">${formatMessageText(text)}</div>
      <div class="msg-meta">
        <span>${timeLabel}</span>
      </div>
      <div class="msg-feedback-bar">
        <span style="font-size: 10px; color: var(--slate-500);">Resposta do Flávio</span>
        <button class="btn-flag" onclick="openFeedbackForMessage(this)" data-msg="${encodeURIComponent(text)}">
          🚩 Apontar Erro
        </button>
      </div>
    </div>
  `;

  insertMessageBeforeTyping(row);
  scrollToBottom();
}

function appendErrorMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  
  row.innerHTML = `
    <div class="msg-bubble" style="background: #FEE2E2; border: 1px solid #FCA5A5; color: #991B1B;">
      <div class="msg-sender" style="color: #991B1B;">Aviso</div>
      <div class="msg-text">${escapeHtml(text)}</div>
      <div class="msg-meta">
        <span>${getCurrentTime()}</span>
      </div>
    </div>
  `;

  insertMessageBeforeTyping(row);
  scrollToBottom();
}

function showTypingIndicator() {
  if (dom.typingIndicatorRow) {
    dom.typingIndicatorRow.style.display = 'flex';
    scrollToBottom();
  }
}

function hideTypingIndicator() {
  if (dom.typingIndicatorRow) {
    dom.typingIndicatorRow.style.display = 'none';
  }
}

function insertMessageBeforeTyping(el) {
  if (dom.typingIndicatorRow) {
    dom.chatMessages.insertBefore(el, dom.typingIndicatorRow);
  } else {
    dom.chatMessages.appendChild(el);
  }
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  });
}

function formatMessageText(text) {
  return escapeHtml(text).replace(/\n/g, '<br/>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// REGISTRO DE ERROS (FEEDBACK)
// ==========================================
window.openFeedbackForMessage = function(btnElement) {
  state.activeFlagTarget = btnElement;
  
  let rawMsg = btnElement.getAttribute('data-msg') || '';
  try {
    rawMsg = decodeURIComponent(rawMsg);
  } catch (e) {}

  dom.modalFlaggedQuote.textContent = `"${rawMsg}"`;
  dom.feedbackCommentInput.value = '';
  
  document.querySelectorAll('.severity-pill').forEach(p => {
    p.classList.toggle('selected', p.getAttribute('data-severity') === 'Média');
  });

  dom.feedbackModal.classList.add('active');
  dom.feedbackCommentInput.focus();
};

function closeFeedbackModal() {
  dom.feedbackModal.classList.remove('active');
  state.activeFlagTarget = null;
}

function handleSaveFeedback() {
  if (!state.activeFlagTarget) {
    closeFeedbackModal();
    return;
  }

  let rawMsg = state.activeFlagTarget.getAttribute('data-msg') || '';
  try { rawMsg = decodeURIComponent(rawMsg); } catch (e) {}

  const categoryRadio = document.querySelector('input[name="feedbackCategory"]:checked');
  const category = categoryRadio ? categoryRadio.value : 'Outro';
  
  const selectedSeverityEl = document.querySelector('.severity-pill.selected');
  const severity = selectedSeverityEl ? selectedSeverityEl.getAttribute('data-severity') : 'Média';
  
  const comment = dom.feedbackCommentInput.value.trim() || 'Sem observação detalhada.';

  const feedbackRecord = {
    id: 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
    formattedTime: new Date().toLocaleString('pt-BR'),
    sessionId: state.sessionId,
    attributedProfile: state.currentProfile ? state.currentProfile.label : 'Triagem Inicial',
    userPrompt: state.lastUserMessage || '(Início da conversa)',
    botResponse: rawMsg,
    category: category,
    severity: severity,
    comment: comment
  };

  state.feedbacks.unshift(feedbackRecord);
  saveFeedbacks();
  sendFeedbackToServer(feedbackRecord);

  // Altera visualmente o botão na resposta para indicar que foi registrado
  state.activeFlagTarget.outerHTML = `
    <span class="feedback-registered-badge" title="${escapeHtml(category)}: ${escapeHtml(comment)}">
      ⚠️ Erro Marcado (${escapeHtml(severity)})
    </span>
  `;

  closeFeedbackModal();
  renderFeedbackList();
  
  if (dom.openFeedbackDrawerBtn) {
    dom.openFeedbackDrawerBtn.style.transform = 'scale(1.06)';
    setTimeout(() => { dom.openFeedbackDrawerBtn.style.transform = 'none'; }, 200);
  }
}

function openFeedbackDrawer() {
  renderFeedbackList();
  dom.feedbackDrawer.classList.add('active');
}

function closeFeedbackDrawer() {
  dom.feedbackDrawer.classList.remove('active');
}

function renderFeedbackList() {
  updateFeedbackBadges();

  if (state.feedbacks.length === 0) {
    dom.feedbackListContainer.innerHTML = `
      <div class="feedback-empty-state">
        <span style="font-size: 32px;">🌱</span>
        <strong style="color: var(--slate-700);">Nenhum erro registrado até o momento</strong>
        <p style="font-size: 12px;">Quando o Flávio responder algo fora do padrão, clique em <strong>"🚩 Apontar Erro"</strong> na mensagem.</p>
      </div>
    `;
    return;
  }

  dom.feedbackListContainer.innerHTML = state.feedbacks.map(item => {
    let severityStyle = 'background: #FEF3C7; color: #92400E;';
    if (item.severity === 'Alta') severityStyle = 'background: #FEE2E2; color: #991B1B; font-weight: 800;';
    if (item.severity === 'Baixa') severityStyle = 'background: #DCFCE7; color: #166534;';

    return `
      <div class="feedback-item-card" data-id="${item.id}">
        <div class="feedback-item-top">
          <span class="feedback-category-badge">${escapeHtml(item.category)}</span>
          <span class="feedback-timestamp">${item.formattedTime}</span>
        </div>

        <div style="font-size: 11px; color: var(--slate-600); margin-top: 2px;">
          🏷️ <strong>Perfil no momento do erro:</strong> ${escapeHtml(item.attributedProfile || 'Não especificado')}
        </div>

        ${item.userPrompt ? `
          <div style="font-size: 11px; color: var(--slate-600); margin-top: 2px;">
            <strong>Usuário enviou:</strong> "${escapeHtml(item.userPrompt)}"
          </div>
        ` : ''}

        <div class="feedback-message-snippet">
          <strong>Flávio respondeu:</strong> "${escapeHtml(item.botResponse)}"
        </div>

        <div class="feedback-comment">
          <strong>Como deveria ser:</strong> ${escapeHtml(item.comment)}
        </div>

        <div class="feedback-meta-footer">
          <span style="padding: 2px 6px; border-radius: 4px; ${severityStyle}">
            Gravidade: ${escapeHtml(item.severity)}
          </span>
          <button onclick="deleteSingleFeedback('${item.id}')" style="background: none; border: none; color: var(--accent-red); cursor: pointer; font-size: 11px;" title="Remover apontamento">
            🗑️ Excluir
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.deleteSingleFeedback = function(id) {
  if (confirm('Deseja excluir este registro de erro?')) {
    state.feedbacks = state.feedbacks.filter(fb => fb.id !== id);
    saveFeedbacks();
    renderFeedbackList();
  }
};

function handleClearFeedbacks() {
  if (state.feedbacks.length === 0) return;
  if (confirm(`Tem certeza que deseja apagar todos os ${state.feedbacks.length} erros registrados?`)) {
    state.feedbacks = [];
    saveFeedbacks();
    renderFeedbackList();
  }
}

// ==========================================
// EXPORTAÇÕES (CSV / JSON / TEXTO)
// ==========================================
function exportFeedbacksAsCsv() {
  if (state.feedbacks.length === 0) {
    alert('Nenhum erro registrado para exportar.');
    return;
  }

  const headers = ['Data e Hora', 'Perfil Atribuido', 'Pergunta do Usuario', 'Resposta do Flavio', 'Tipo de Erro', 'Gravidade', 'O que deveria ter respondido'];
  
  const rows = state.feedbacks.map(fb => [
    fb.formattedTime,
    `"${cleanCsv(fb.attributedProfile || 'Triagem')}"`,
    `"${cleanCsv(fb.userPrompt)}"`,
    `"${cleanCsv(fb.botResponse)}"`,
    `"${cleanCsv(fb.category)}"`,
    `"${cleanCsv(fb.severity)}"`,
    `"${cleanCsv(fb.comment)}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  downloadFile(csvContent, `erros-chat-flavio-${getFormattedDateSlug()}.csv`, 'text/csv;charset=utf-8;');
}

function exportFeedbacksAsJson() {
  if (state.feedbacks.length === 0) {
    alert('Nenhum erro registrado para exportar.');
    return;
  }

  const exportData = {
    dataExportacao: new Date().toISOString(),
    totalErros: state.feedbacks.length,
    erros: state.feedbacks
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  downloadFile(jsonStr, `erros-chat-flavio-${getFormattedDateSlug()}.json`, 'application/json');
}

function exportChatTranscript() {
  const rows = dom.chatMessages.querySelectorAll('.msg-row');
  if (rows.length === 0) {
    alert('Não há mensagens na tela para exportar.');
    return;
  }

  let text = `========================================================\r\n`;
  text += `SOUND AGRICULTURE • CONVERSA COM O FLÁVIO\r\n`;
  text += `Data: ${new Date().toLocaleString('pt-BR')}\r\n`;
  text += `========================================================\r\n\r\n`;

  rows.forEach(row => {
    if (row.id === 'typingIndicatorRow') return;
    const isUser = row.classList.contains('user');
    const sender = isUser ? 'USUÁRIO' : 'FLÁVIO';
    const msgText = row.querySelector('.msg-text')?.innerText || '';
    const time = row.querySelector('.msg-meta span')?.innerText || '';
    text += `[${time}] ${sender}:\r\n${msgText}\r\n\r\n`;
  });

  downloadFile(text, `conversa-flavio-${getFormattedDateSlug()}.txt`, 'text/plain;charset=utf-8;');
}

function cleanCsv(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
}

function getFormattedDateSlug() {
  const now = new Date();
  return now.toISOString().slice(0, 10) + '_' + now.toTimeString().slice(0, 8).replace(/:/g, '-');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
