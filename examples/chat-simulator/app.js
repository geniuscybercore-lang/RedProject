const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  theme: localStorage.getItem('theme') || 'dark',
  history: [],
  isBotTyping: false,
};

const scripts = {
  intro: [
    { role: 'bot', text: 'สวัสดีค่ะ! ฉันคือแชทบอท ช่วยอะไรคุณได้บ้างคะ?' },
    { role: 'user', text: 'อยากรู้ว่าฟีเจอร์มีอะไรบ้าง' },
    { role: 'bot', text: 'เรามีการตอบอัตโนมัติ โหมดสว่าง/มืด และการพิมพ์แบบสมจริงค่ะ' },
  ],
  faq: [
    { role: 'user', text: 'ขอช่วยตอบคำถามที่พบบ่อย' },
    { role: 'bot', text: 'แน่นอนค่ะ! 1) เวลาทำการ 9:00-18:00 น. จ.-ศ. 2) ติดต่อทีมงานได้ทางอีเมล support@example.com' },
  ],
  handoff: [
    { role: 'user', text: 'อยากคุยกับเจ้าหน้าที่ค่ะ' },
    { role: 'bot', text: 'ได้เลยค่ะ กำลังโอนให้เจ้าหน้าที่ โปรดรอสักครู่...' },
  ],
};

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  state.theme = theme;
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

function formatTime(d = new Date()) {
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function typingDots() {
  return el('span', { class: 'typing', 'aria-hidden': 'true' }, [
    el('span', { class: 'dot' }),
    el('span', { class: 'dot' }),
    el('span', { class: 'dot' }),
  ]);
}

function appendMessage({ role, text, time = formatTime() }) {
  const chat = $('#chat');
  const isUser = role === 'user';
  const avatar = isUser ? '🙂' : '🤖';
  const msg = el('div', { class: `message ${isUser ? 'user' : 'bot'}` }, [
    el('div', { class: 'avatar', 'aria-hidden': 'true' }, avatar),
    el('div', { class: 'content' }, [
      el('div', { class: 'bubble' }, text),
      el('div', { class: 'meta' }, `${isUser ? 'คุณ' : 'บอท'} • ${time}`),
    ]),
  ]);
  chat.append(msg);
  chat.scrollTop = chat.scrollHeight;
}

function appendTyping() {
  const chat = $('#chat');
  const msg = el('div', { class: 'message bot typing-row' }, [
    el('div', { class: 'avatar', 'aria-hidden': 'true' }, '🤖'),
    el('div', { class: 'content' }, [
      el('div', { class: 'bubble' }, typingDots()),
      el('div', { class: 'meta' }, `บอท • ${formatTime()}`),
    ]),
  ]);
  chat.append(msg);
  chat.scrollTop = chat.scrollHeight;
  return msg;
}

async function botReply(text) {
  if (state.isBotTyping) return;
  state.isBotTyping = true;
  const typingEl = appendTyping();
  const delay = Math.min(2000, Math.max(600, text.length * 40));
  await new Promise((r) => setTimeout(r, delay));
  typingEl.remove();
  appendMessage({ role: 'bot', text });
  state.isBotTyping = false;
}

async function handleUserSend(raw) {
  const text = raw.trim();
  if (!text) return;
  appendMessage({ role: 'user', text });
  state.history.push({ role: 'user', text, t: Date.now() });

  // simple canned logic
  const lower = text.toLowerCase();
  if (lower.includes('ราคา') || lower.includes('เท่าไหร่')) {
    botReply('แพ็กเกจเริ่มต้นที่ 299 บาท/เดือน และมีเวอร์ชันทดลองใช้งานฟรีค่ะ');
    return;
  }
  if (lower.includes('ช่วย') || lower.includes('อย่างไร')) {
    botReply('ฉันช่วยตอบคำถาม แนะนำการใช้งาน และส่งต่อให้ทีมงานได้ค่ะ');
    return;
  }
  if (lower.includes('มืด') || lower.includes('สว่าง')) {
    toggleTheme();
    botReply('สลับธีมให้แล้วค่ะ ✨');
    return;
  }

  const fallbacks = [
    'รับทราบค่ะ มีรายละเอียดเพิ่มเติมไหมคะ?',
    'ขอข้อมูลเพิ่มอีกนิด เพื่อช่วยคุณได้ดีกว่านี้ค่ะ',
    'โอเคค่ะ เดี๋ยวช่วยค้นหาคำตอบให้นะคะ',
  ];
  const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  botReply(reply);
}

function wireEvents() {
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#message');
    handleUserSend(input.value);
    input.value = '';
    input.focus();
  });
  $$('#scriptList button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.script;
      const steps = scripts[key] || [];
      for (const step of steps) {
        if (step.role === 'user') {
          appendMessage({ role: 'user', text: step.text });
        } else {
          await botReply(step.text);
        }
      }
    });
  });

  $('#message').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#send').click();
    }
  });
}

function init() {
  applyTheme(state.theme);
  appendMessage({ role: 'bot', text: 'สวัสดีค่ะ! เริ่มคุยกับฉันได้เลย 👋' });
  wireEvents();
}

document.addEventListener('DOMContentLoaded', init);
