/**
 * Bot Widget — Embeddable Chat Widget (Vanilla JS, Shadow DOM)
 *
 * Usage:
 *   <script src="/bot-widget/bot-widget.js" data-tenant-id="tid-xxx" defer></script>
 *   <script src="https://platform.com/bot-widget/bot-widget.js" data-embed-key="ek-xxx" defer></script>
 *
 * Or programmatically:
 *   <script>
 *     BotWidget.init({ tenantId: 'tid-xxx', pageContext: 'storefront' });
 *     BotWidget.init({ embedKey: 'ek-xxx', pageContext: 'storefront' });
 *   </script>
 *
 * Features:
 * - Shadow DOM encapsulation
 * - Collapsed/expanded states
 * - Pre-chat form (email/phone/order)
 * - Message threading with typing indicator
 * - After-hours mode
 * - Skill cards
 * - Thumbs up/down feedback
 * - Session resume via localStorage
 * - Mobile responsive
 * - Offline state handling
 */

(function () {
  'use strict';

  // ====================
  // CONSTANTS
  // ====================

  var STORAGE_KEY_PREFIX = 'bot_widget_';
  var SESSION_TTL_HOURS = 24;
  var TYPING_DELAY_MS = 600;
  var MAX_RETRIES = 2;

  // ====================
  // STATE
  // ====================

  var state = {
    tenantId: null,
    embedKey: null,
    pageContext: null,
    config: null,
    sessionId: null,
    messages: [],
    isExpanded: false,
    isTyping: false,
    isLoading: false,
    preChatCompleted: false,
    afterHours: false,
    online: navigator.onLine,
  };

  // ====================
  // UTILITIES
  // ====================

  function getSessionKey(tenantId) {
    return STORAGE_KEY_PREFIX + tenantId;
  }

  function saveSession(tenantId, sessionId) {
    try {
      var data = { sessionId: sessionId, ts: Date.now() };
      localStorage.setItem(getSessionKey(tenantId), JSON.stringify(data));
    } catch (e) {}
  }

  function loadSession(tenantId) {
    try {
      var raw = localStorage.getItem(getSessionKey(tenantId));
      if (!raw) return null;
      var data = JSON.parse(raw);
      var age = Date.now() - data.ts;
      if (age > SESSION_TTL_HOURS * 60 * 60 * 1000) {
        localStorage.removeItem(getSessionKey(tenantId));
        return null;
      }
      return data.sessionId;
    } catch (e) {
      return null;
    }
  }

  function clearSession(tenantId) {
    try {
      localStorage.removeItem(getSessionKey(tenantId));
    } catch (e) {}
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(date) {
    var d = typeof date === 'string' ? new Date(date) : date;
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    m = m < 10 ? '0' + m : m;
    return h + ':' + m + ' ' + ampm;
  }

  // ====================
  // API
  // ====================

  function apiBase() {
    return (window.location.origin || '');
  }

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (state.embedKey) {
      headers['x-embed-key'] = state.embedKey;
    }
    return headers;
  }

  function tenantParam() {
    if (state.embedKey) {
      return 'embedKey=' + encodeURIComponent(state.embedKey);
    }
    return 'tenantId=' + encodeURIComponent(state.tenantId);
  }

  async function fetchWidgetConfig(tenantId) {
    var url = apiBase() + '/api/public/bot/config?' + tenantParam();
    var resp = await fetch(url, {
      headers: state.embedKey ? { 'x-embed-key': state.embedKey } : {},
    });
    if (!resp.ok) return null;
    var json = await resp.json();
    return json.success && json.config ? json.config : null;
  }

  async function startConversation(tenantId, opts) {
    var url = apiBase() + '/api/public/bot/conversations';
    var body = {
      customerEmail: opts.email || undefined,
      customerPhone: opts.phone || undefined,
      pageContext: state.pageContext,
    };
    if (state.embedKey) {
      body.embedKey = state.embedKey;
    } else {
      body.tenantId = tenantId;
    }
    var resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('Failed to start conversation');
    var json = await resp.json();
    if (!json.success) throw new Error(json.message || 'Failed to start conversation');
    saveSession(tenantId, json.sessionId);
    return { sessionId: json.sessionId, greeting: json.greeting };
  }

  async function sendMessage(sessionId, message) {
    var url = apiBase() + '/api/public/bot/conversations/' + sessionId + '/messages';
    var body = { message: message, pageContext: state.pageContext };
    if (state.embedKey) {
      body.embedKey = state.embedKey;
    } else {
      body.tenantId = state.tenantId;
    }
    var resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('Failed to send message');
    var json = await resp.json();
    if (!json.success) throw new Error(json.message || 'Failed to send message');
    return json;
  }

  async function submitFeedback(sessionId, messageId, rating) {
    var url = apiBase() + '/api/public/bot/conversations/' + sessionId + '/feedback';
    try {
      await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ messageId: messageId, rating: rating }),
      });
    } catch (e) {}
  }

  // ====================
  // WIDGET CSS (injected into shadow DOM)
  // ====================

  function getWidgetStyles(config) {
    var pos = config ? config.widgetPosition : 'bottom-right';
    var offsetX = config ? (config.widgetOffsetX || 20) : 20;
    var offsetY = config ? (config.widgetOffsetY || 20) : 20;
    var color = config ? (config.widgetColor || '#4F46E5') : '#4F46E5';
    var font = config ? (config.widgetFont || 'system-ui, sans-serif') : 'system-ui, sans-serif';

    function getContrastColor(hex) {
      var c = hex.replace('#', '');
      if (c.length < 6) return '#ffffff';
      var r = parseInt(c.slice(0, 2), 16) / 255;
      var g = parseInt(c.slice(2, 4), 16) / 255;
      var b = parseInt(c.slice(4, 6), 16) / 255;
      var lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return lum > 0.55 ? '#111111' : '#ffffff';
    }
    var textColor = getContrastColor(color);

    var posStyle = '';
    if (pos === 'bottom-right') posStyle = 'bottom:' + offsetY + 'px;right:' + offsetX + 'px;';
    else if (pos === 'bottom-left') posStyle = 'bottom:' + offsetY + 'px;left:' + offsetX + 'px;';
    else if (pos === 'top-right') posStyle = 'top:' + offsetY + 'px;right:' + offsetX + 'px;';
    else if (pos === 'top-left') posStyle = 'top:' + offsetY + 'px;left:' + offsetX + 'px;';

    return '\
      :host { all: initial; }\
      .bw-container { position:fixed;' + posStyle + 'z-index:2147483647;font-family:' + font + '; }\
      .bw-toggle { \
        width:60px;height:60px;border-radius:50%;background:' + color + ';\
        border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;\
        box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s,box-shadow 0.2s;\
      }\
      .bw-toggle:hover { transform:scale(1.05);box-shadow:0 6px 16px rgba(0,0,0,0.2); }\
      .bw-toggle svg { width:28px;height:28px;fill:' + textColor + '; }\
      .bw-toggle-close svg { fill:' + textColor + '; }\
      .bw-panel {\
        position:absolute;' + (pos.indexOf('bottom') >= 0 ? 'bottom:70px;' : 'top:70px;') + '\
        ' + (pos.indexOf('right') >= 0 ? 'right:0;' : 'left:0;') + '\
        width:370px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);\
        background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);\
        display:none;flex-direction:column;overflow:hidden;\
      }\
      .bw-panel.open { display:flex;animation:bwFadeIn 0.2s ease; }\
      @keyframes bwFadeIn { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }\
      .bw-header {\
        background:' + color + ';color:' + textColor + ';padding:14px 18px;display:flex;align-items:center;\
        justify-content:space-between;flex-shrink:0;\
      }\
      .bw-header-info { display:flex;align-items:center;gap:10px; }\
      .bw-avatar {\
        width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);\
        display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;\
        background-size:cover;background-position:center;\
      }\
      .bw-header-text { display:flex;flex-direction:column; }\
      .bw-bot-name { font-size:15px;font-weight:600; }\
      .bw-status { font-size:11px;opacity:0.85; }\
      .bw-close { background:none;border:none;color:' + textColor + ';cursor:pointer;padding:4px;opacity:0.8; }\
      .bw-close:hover { opacity:1; }\
      .bw-close svg { width:20px;height:20px;fill:' + textColor + '; }\
      .bw-messages { flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f7f7f8; }\
      .bw-msg { max-width:80%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.4;word-wrap:break-word; }\
      .bw-msg-user { align-self:flex-end;background:' + color + '1A;border:1px solid ' + color + '40;color:' + color + ';border-bottom-right-radius:4px; }\
      .bw-msg-bot { align-self:flex-start;background:#fff;color:#1a1a1a;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.08); }\
      .bw-msg-time { font-size:10px;opacity:0.5;margin-top:4px; }\
      .bw-msg-fallback { font-style:italic;opacity:0.7; }\
      .bw-msg-skill-card {\
        border:1px solid #e0e0e0;border-radius:10px;padding:10px;margin-top:8px;\
        background:#f9f9f9;font-size:13px;\
      }\
      .bw-msg-feedback { display:flex;gap:8px;margin-top:6px; }\
      .bw-feedback-btn {\
        background:none;border:1px solid #ddd;border-radius:6px;padding:3px 8px;\
        cursor:pointer;font-size:12px;color:#666;\
      }\
      .bw-feedback-btn:hover { background:#f0f0f0; }\
      .bw-feedback-btn.selected { background:#e8e8e8;border-color:#999; }\
      .bw-typing { align-self:flex-start;display:flex;gap:4px;padding:10px 14px;background:#fff;border-radius:14px;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.08); }\
      .bw-typing-dot { width:8px;height:8px;border-radius:50%;background:#bbb;animation:bwTyping 1.2s infinite; }\
      .bw-typing-dot:nth-child(2) { animation-delay:0.2s; }\
      .bw-typing-dot:nth-child(3) { animation-delay:0.4s; }\
      @keyframes bwTyping { 0%,60%,100% { opacity:0.3; } 30% { opacity:1; } }\
      .bw-after-hours {\
        background:#fff3cd;color:#856404;padding:10px 14px;text-align:center;font-size:13px;\
        border-bottom:1px solid #ffeaa7;\
      }\
      .bw-offline {\
        background:#fee;color:#c33;padding:10px 14px;text-align:center;font-size:13px;\
        border-bottom:1px solid #fcc;\
      }\
      .bw-prechat { padding:20px;display:flex;flex-direction:column;gap:12px;flex:1;justify-content:center; }\
      .bw-prechat-title { font-size:16px;font-weight:600;text-align:center;color:#333; }\
      .bw-prechat-desc { font-size:13px;color:#666;text-align:center; }\
      .bw-input-group { display:flex;flex-direction:column;gap:4px; }\
      .bw-label { font-size:12px;color:#555;font-weight:500; }\
      .bw-input {\
        padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;\
        font-family:inherit;outline:none;transition:border-color 0.2s;\
      }\
      .bw-input:focus { border-color:' + color + '; }\
      .bw-btn {\
        padding:10px 16px;background:' + color + ';color:' + textColor + ';border:none;border-radius:8px;\
        font-size:14px;font-family:inherit;cursor:pointer;transition:opacity 0.2s;\
      }\
      .bw-btn:hover { opacity:0.9; }\
      .bw-btn:disabled { opacity:0.5;cursor:not-allowed; }\
      .bw-input-area { display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff;flex-shrink:0; }\
      .bw-text-input {\
        flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:20px;font-size:14px;\
        font-family:inherit;outline:none;transition:border-color 0.2s;\
      }\
      .bw-text-input:focus { border-color:' + color + '; }\
      .bw-send-btn {\
        width:40px;height:40px;border-radius:50%;background:' + color + ';border:none;\
        cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;\
        transition:opacity 0.2s;\
      }\
      .bw-send-btn:hover { opacity:0.9; }\
      .bw-send-btn:disabled { opacity:0.4;cursor:not-allowed; }\
      .bw-send-btn svg { width:20px;height:20px;fill:' + textColor + '; }\
      .bw-greeting { text-align:center;font-size:13px;color:#888;padding:8px; }\
      @media (max-width: 480px) {\
        .bw-panel { width:calc(100vw - 20px);height:calc(100vh - 90px);' + posStyle + ' }\
      }\
    ';
  }

  // ====================
  // ICONS
  // ====================

  var ICON_CHAT = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>';

  // ====================
  // WIDGET CLASS
  // ====================

  function BotWidget() {}

  BotWidget.prototype.host = null;
  BotWidget.prototype.shadow = null;
  BotWidget.prototype.container = null;
  BotWidget.prototype.panel = null;
  BotWidget.prototype.messagesEl = null;
  BotWidget.prototype.inputEl = null;

  BotWidget.prototype.init = function (opts) {
    var self = this;
    state.tenantId = opts.tenantId || (document.currentScript && document.currentScript.getAttribute('data-tenant-id')) || null;
    state.embedKey = opts.embedKey || (document.currentScript && document.currentScript.getAttribute('data-embed-key')) || null;
    state.pageContext = opts.pageContext || (document.currentScript && document.currentScript.getAttribute('data-page-context')) || null;

    if (!state.tenantId && !state.embedKey) {
      console.warn('[BotWidget] No tenantId or embedKey provided');
      return;
    }

    // Check for existing instance
    if (document.getElementById('bot-widget-host')) return;

    // Create host element
    self.host = document.createElement('div');
    self.host.id = 'bot-widget-host';
    self.host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;';
    document.body.appendChild(self.host);

    // Attach shadow DOM
    self.shadow = self.host.attachShadow({ mode: 'open' });

    // Load config then render
    self.loadAndRender();
  };

  BotWidget.prototype.loadAndRender = async function () {
    var self = this;
    try {
      state.config = await fetchWidgetConfig(state.tenantId);
      if (!state.config || state.config.status !== 'active') {
        return;
      }
      state.afterHours = state.config.afterHoursEnabled || false;
      self.render();
      self.attachEventListeners();

      // Try to resume session
      var existingSession = loadSession(state.tenantId);
      if (existingSession) {
        state.sessionId = existingSession;
        state.preChatCompleted = true;
        self.showPanel();
      }
    } catch (e) {
      console.warn('[BotWidget] Failed to load config:', e);
    }
  };

  BotWidget.prototype.render = function () {
    var self = this;
    var config = state.config;

    // Style element
    var style = document.createElement('style');
    style.textContent = getWidgetStyles(config);

    // Container
    self.container = document.createElement('div');
    self.container.className = 'bw-container';

    // Toggle button
    var toggle = document.createElement('button');
    toggle.className = 'bw-toggle';
    toggle.id = 'bw-toggle';
    toggle.innerHTML = ICON_CHAT;
    toggle.setAttribute('aria-label', 'Open chat');
    self.container.appendChild(toggle);

    // Panel
    self.panel = document.createElement('div');
    self.panel.className = 'bw-panel';
    self.panel.id = 'bw-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'bw-header';
    var avatarUrl = config.widgetAvatarUrl || config.platformLogoUrl;
    var avatarStyle = avatarUrl ? 'background-image:url(' + avatarUrl + ')' : '';
    header.innerHTML = '\
      <div class="bw-header-info">\
        <div class="bw-avatar" style="' + avatarStyle + '">' + (avatarUrl ? '' : '🤖') + '</div>\
        <div class="bw-header-text">\
          <div class="bw-bot-name">' + escapeHtml(config.botName || 'Assistant') + '</div>\
          <div class="bw-status">' + (state.online ? (state.afterHours ? 'After Hours' : 'Online') : 'Offline') + '</div>\
        </div>\
      </div>\
      <button class="bw-close" id="bw-close">' + ICON_CLOSE + '</button>\
    ';
    self.panel.appendChild(header);

    // After-hours banner
    if (state.afterHours && config.afterHoursMessage) {
      var afterHours = document.createElement('div');
      afterHours.className = 'bw-after-hours';
      afterHours.textContent = config.afterHoursMessage;
      self.panel.appendChild(afterHours);
    }

    // Offline banner
    if (!state.online) {
      var offline = document.createElement('div');
      offline.className = 'bw-offline';
      offline.textContent = 'You are offline. Messages will be sent when connection returns.';
      self.panel.appendChild(offline);
    }

    // Messages or pre-chat
    self.messagesEl = document.createElement('div');
    self.messagesEl.className = 'bw-messages';
    self.messagesEl.id = 'bw-messages';
    self.panel.appendChild(self.messagesEl);

    // Input area
    var inputArea = document.createElement('div');
    inputArea.className = 'bw-input-area';
    inputArea.innerHTML = '\
      <input type="text" class="bw-text-input" id="bw-input" placeholder="Type a message..." disabled />\
      <button class="bw-send-btn" id="bw-send" disabled>' + ICON_SEND + '</button>\
    ';
    self.panel.appendChild(inputArea);

    self.container.appendChild(self.panel);
    self.shadow.appendChild(style);
    self.shadow.appendChild(self.container);

    // Render initial content
    if (!state.preChatCompleted && config.preChatEnabled) {
      self.renderPreChat();
    } else {
      self.enableInput();
    }
  };

  BotWidget.prototype.renderPreChat = function () {
    var self = this;
    var config = state.config;
    self.messagesEl.innerHTML = '';

    var prechat = document.createElement('div');
    prechat.className = 'bw-prechat';

    var fields = '';
    if (config.preChatEmail) {
      fields += '\
        <div class="bw-input-group">\
          <label class="bw-label">Email</label>\
          <input type="email" class="bw-input" id="bw-prechat-email" placeholder="your@email.com" />\
        </div>';
    }
    if (config.preChatPhone) {
      fields += '\
        <div class="bw-input-group">\
          <label class="bw-label">Phone</label>\
          <input type="tel" class="bw-input" id="bw-prechat-phone" placeholder="Your phone number" />\
        </div>';
    }
    if (config.preChatOrder) {
      fields += '\
        <div class="bw-input-group">\
          <label class="bw-label">Order Number</label>\
          <input type="text" class="bw-input" id="bw-prechat-order" placeholder="Order #" />\
        </div>';
    }

    prechat.innerHTML = '\
      <div class="bw-prechat-title">Chat with ' + escapeHtml(config.botName || 'us') + '</div>\
      <div class="bw-prechat-desc">Fill in the form below to start chatting.</div>\
      ' + fields + '\
      <button class="bw-btn" id="bw-prechat-submit">Start Chat</button>\
    ';
    self.messagesEl.appendChild(prechat);

    var submitBtn = self.shadow.getElementById('bw-prechat-submit');
    submitBtn.addEventListener('click', function () { self.handlePreChatSubmit(); });
  };

  BotWidget.prototype.handlePreChatSubmit = async function () {
    var self = this;
    var email = '';
    var phone = '';

    var emailEl = self.shadow.getElementById('bw-prechat-email');
    var phoneEl = self.shadow.getElementById('bw-prechat-phone');

    if (emailEl) email = emailEl.value.trim();
    if (phoneEl) phone = phoneEl.value.trim();

    var submitBtn = self.shadow.getElementById('bw-prechat-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Starting...';

    try {
      var result = await startConversation(state.tenantId, { email: email, phone: phone });
      state.sessionId = result.sessionId;
      state.preChatCompleted = true;
      self.messagesEl.innerHTML = '';
      self.addMessage('assistant', result.greeting, 'static');
      self.enableInput();
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Start Chat';
      self.addMessage('assistant', 'Sorry, something went wrong. Please try again.', 'fallback');
    }
  };

  BotWidget.prototype.attachEventListeners = function () {
    var self = this;
    var toggle = self.shadow.getElementById('bw-toggle');
    var closeBtn = self.shadow.getElementById('bw-close');
    var sendBtn = self.shadow.getElementById('bw-send');
    self.inputEl = self.shadow.getElementById('bw-input');

    toggle.addEventListener('click', function () { self.togglePanel(); });
    closeBtn.addEventListener('click', function () { self.closePanel(); });
    sendBtn.addEventListener('click', function () { self.handleSend(); });
    self.inputEl.addEventListener('keypress', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self.handleSend();
      }
    });

    // Online/offline detection
    window.addEventListener('online', function () {
      state.online = true;
      self.updateStatus();
    });
    window.addEventListener('offline', function () {
      state.online = false;
      self.updateStatus();
    });
  };

  BotWidget.prototype.togglePanel = function () {
    var self = this;
    if (state.isExpanded) {
      self.closePanel();
    } else {
      self.showPanel();
    }
  };

  BotWidget.prototype.showPanel = function () {
    var self = this;
    state.isExpanded = true;
    self.panel.classList.add('open');
    var toggle = self.shadow.getElementById('bw-toggle');
    toggle.innerHTML = ICON_CLOSE;
    toggle.classList.add('bw-toggle-close');

    // If no session and no pre-chat, start conversation automatically
    if (!state.sessionId && !state.config.preChatEnabled) {
      self.autoStartConversation();
    }

    // Focus input
    if (state.preChatCompleted) {
      setTimeout(function () { self.inputEl && self.inputEl.focus(); }, 100);
    }
  };

  BotWidget.prototype.closePanel = function () {
    var self = this;
    state.isExpanded = false;
    self.panel.classList.remove('open');
    var toggle = self.shadow.getElementById('bw-toggle');
    toggle.innerHTML = ICON_CHAT;
    toggle.classList.remove('bw-toggle-close');
  };

  BotWidget.prototype.autoStartConversation = async function () {
    var self = this;
    if (state.isLoading) return;
    state.isLoading = true;
    try {
      var result = await startConversation(state.tenantId, {});
      state.sessionId = result.sessionId;
      state.preChatCompleted = true;
      self.messagesEl.innerHTML = '';
      self.addMessage('assistant', result.greeting, 'static');
      self.enableInput();
    } catch (e) {
      self.addMessage('assistant', 'Sorry, I could not start the conversation. Please try again later.', 'fallback');
    } finally {
      state.isLoading = false;
    }
  };

  BotWidget.prototype.enableInput = function () {
    var self = this;
    var input = self.shadow.getElementById('bw-input');
    var send = self.shadow.getElementById('bw-send');
    if (input) input.disabled = false;
    if (send) send.disabled = false;
  };

  BotWidget.prototype.disableInput = function () {
    var self = this;
    var input = self.shadow.getElementById('bw-input');
    var send = self.shadow.getElementById('bw-send');
    if (input) input.disabled = true;
    if (send) send.disabled = true;
  };

  BotWidget.prototype.handleSend = async function () {
    var self = this;
    var text = self.inputEl.value.trim();
    if (!text || state.isTyping || !state.sessionId) return;

    // Add user message
    self.addMessage('user', text, 'user');
    self.inputEl.value = '';

    // Show typing indicator
    self.showTyping();
    self.disableInput();

    try {
      var result = await sendMessage(state.sessionId, text);
      self.hideTyping();

      var msgEl = self.addMessage('assistant', result.reply, result.responseType, {
        matchedFaqId: result.matchedFaqId,
        skillCard: result.skillCard,
        skillName: result.skillName,
        messageId: result.messageId,
      });

      // Add feedback buttons
      if (msgEl && result.messageId) {
        self.addFeedbackButtons(msgEl, result.messageId);
      }
    } catch (e) {
      self.hideTyping();
      self.addMessage('assistant', 'Sorry, I could not process your message. Please try again.', 'fallback');
    } finally {
      self.enableInput();
      self.inputEl.focus();
    }
  };

  BotWidget.prototype.addMessage = function (role, content, responseType, extra) {
    var self = this;
    var msg = document.createElement('div');
    msg.className = 'bw-msg ' + (role === 'user' ? 'bw-msg-user' : 'bw-msg-bot');
    if (responseType === 'fallback') msg.classList.add('bw-msg-fallback');

    var contentHtml = escapeHtml(content);
    if (extra && extra.skillCard) {
      contentHtml += '<div class="bw-msg-skill-card">' + self.renderSkillCard(extra.skillCard, extra.skillName) + '</div>';
    }

    msg.innerHTML = contentHtml + '<div class="bw-msg-time">' + formatTime(new Date()) + '</div>';
    self.messagesEl.appendChild(msg);
    self.scrollToBottom();
    return msg;
  };

  BotWidget.prototype.renderSkillCard = function (schema, skillName) {
    if (!schema) return '';
    var html = '<div style="font-weight:600;margin-bottom:4px;">' + escapeHtml(skillName || 'Skill') + '</div>';
    if (schema.type === 'product_list' && schema.fields) {
      html += '<div style="color:#666;">Showing ' + (schema.max_results || 5) + ' results</div>';
    } else if (schema.type === 'inventory_status') {
      html += '<div style="color:#666;">Inventory status</div>';
    } else if (schema.type === 'order_status') {
      html += '<div style="color:#666;">Order tracking</div>';
    } else if (schema.type === 'store_hours') {
      html += '<div style="color:#666;">Store hours</div>';
    }
    return html;
  };

  BotWidget.prototype.addFeedbackButtons = function (msgEl, messageId) {
    var self = this;
    var feedback = document.createElement('div');
    feedback.className = 'bw-msg-feedback';
    feedback.innerHTML = '\
      <button class="bw-feedback-btn" data-rating="positive">👍 Helpful</button>\
      <button class="bw-feedback-btn" data-rating="negative">👎 Not helpful</button>\
    ';
    msgEl.appendChild(feedback);

    var buttons = feedback.querySelectorAll('.bw-feedback-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rating = btn.getAttribute('data-rating');
        buttons.forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        submitFeedback(state.sessionId, messageId, rating);
      });
    });
  };

  BotWidget.prototype.showTyping = function () {
    var self = this;
    state.isTyping = true;
    var typing = document.createElement('div');
    typing.className = 'bw-typing';
    typing.id = 'bw-typing';
    typing.innerHTML = '<div class="bw-typing-dot"></div><div class="bw-typing-dot"></div><div class="bw-typing-dot"></div>';
    self.messagesEl.appendChild(typing);
    self.scrollToBottom();
  };

  BotWidget.prototype.hideTyping = function () {
    var self = this;
    state.isTyping = false;
    var typing = self.shadow.getElementById('bw-typing');
    if (typing) typing.remove();
  };

  BotWidget.prototype.scrollToBottom = function () {
    var self = this;
    self.messagesEl.scrollTop = self.messagesEl.scrollHeight;
  };

  BotWidget.prototype.updateStatus = function () {
    var self = this;
    var statusEl = self.shadow.querySelector('.bw-status');
    if (statusEl) {
      statusEl.textContent = state.online ? (state.afterHours ? 'After Hours' : 'Online') : 'Offline';
    }
    // Toggle offline banner
    var existing = self.shadow.querySelector('.bw-offline');
    if (!state.online && !existing) {
      var offline = document.createElement('div');
      offline.className = 'bw-offline';
      offline.textContent = 'You are offline. Messages will be sent when connection returns.';
      self.panel.insertBefore(offline, self.messagesEl);
    } else if (state.online && existing) {
      existing.remove();
    }
  };

  // ====================
  // AUTO-INIT
  // ====================

  var widget = new BotWidget();

  // Expose globally
  window.BotWidget = {
    init: function (opts) { widget.init(opts); },
    open: function () { if (widget.panel) widget.showPanel(); },
    close: function () { if (widget.panel) widget.closePanel(); },
    destroy: function () {
      if (widget.host) {
        widget.host.remove();
        widget.host = null;
      }
    },
  };

  // Auto-init from script attributes
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  if (currentScript) {
    var tenantId = currentScript.getAttribute('data-tenant-id');
    var embedKey = currentScript.getAttribute('data-embed-key');
    if (tenantId || embedKey) {
      var pageContext = currentScript.getAttribute('data-page-context');
      widget.init({ tenantId: tenantId, embedKey: embedKey, pageContext: pageContext });
    }
  }
})();
