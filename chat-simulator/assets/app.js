const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

const state = {
  preset: 'friendly',
  theme: 'dark',
  messages: [],
};

const PRESET_BEHAVIORS = {
  friendly: (text) => `ได้เลยครับ 😊  ${text}\nนี่คือคำตอบแบบเป็นกันเองและช่วยเหลือกันสุดๆ!`,
  professional: (text) => `รับทราบครับ ผมจะช่วยอธิบายอย่างเป็นขั้นตอน:\n- ประเด็น: ${text}\n- ทางเลือก: A/B\n- คำแนะนำ: เลือกที่สอดคล้องกับเป้าหมาย`,
  concise: (text) => `${text} -> สรุป: ใช้ทางเลือกที่ง่ายและชัดเจนที่สุด`,
  helper: (text) => `ถ้าคุณสนใจสินค้าเกี่ยวกับ "${text}" ผมแนะนำรุ่น Pro ช่วยประหยัดเวลาและใช้งานง่ายกว่าเดิมครับ`,
};

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createMessageEl({ role, content, time }) {
  const item = document.createElement('div');
  item.className = `msg ${role}`;
  const safe = escapeHtml(String(content));
  item.innerHTML = `
    <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div>
      <div class="bubble">${safe}</div>
      <div class="meta">${role === 'user' ? 'คุณ' : 'แชทบอท'} · ${time ?? formatTime()}</div>
    </div>
  `;
  return item;
}

function createTypingEl() {
  const item = document.createElement('div');
  item.className = 'msg bot';
  item.innerHTML = `
    <div class="avatar">🤖</div>
    <div>
      <div class="bubble"><span class="typing"><span class="dotty"></span><span class="dotty"></span><span class="dotty"></span></span></div>
      <div class="meta">กำลังพิมพ์…</div>
    </div>
  `;
  return item;
}

function scrollToBottom() {
  const el = $('#messages');
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

function setTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light', isLight);
  state.theme = isLight ? 'light' : 'dark';
  $('#themeSwitch').checked = isLight;
  $('#themeLabel').textContent = isLight ? 'โหมดสว่าง' : 'โหมดมืด';
  try { localStorage.setItem('chat_theme', state.theme); } catch {}
}

function setPreset(preset) {
  state.preset = preset;
  $$('.preset').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset));
  try { localStorage.setItem('chat_preset', state.preset); } catch {}
}

function resetChat() {
  state.messages = [];
  $('#messages').innerHTML = '';
}

async function simulateBotReply(userText) {
  const messagesEl = $('#messages');
  const typing = createTypingEl();
  messagesEl.appendChild(typing);
  scrollToBottom();

  const min = 500, max = 1400;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(r => setTimeout(r, delay));

  const behavior = PRESET_BEHAVIORS[state.preset] || PRESET_BEHAVIORS.friendly;
  const reply = behavior(userText);

  typing.replaceWith(createMessageEl({ role: 'bot', content: reply, time: formatTime() }));
  // synthesize slight delay to mimic thinking for multi-line replies
  await new Promise(r => setTimeout(r, 50));
  scrollToBottom();
}

function initEvents() {
  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#messageInput');
    const text = input.value.trim();
    if (!text) return;

    const msg = createMessageEl({ role: 'user', content: text, time: formatTime() });
    $('#messages').appendChild(msg);
    scrollToBottom();
    input.value = '';
    input.style.height = 'auto';

    simulateBotReply(text);
  });

  $('#newChatBtn').addEventListener('click', () => {
    resetChat();
  });

  $$('.preset').forEach(btn => {
    btn.addEventListener('click', () => setPreset(btn.dataset.preset));
  });

  $('#themeSwitch').addEventListener('change', (e) => {
    setTheme(e.target.checked ? 'light' : 'dark');
  });

  // autoresize textarea & send on Enter
  const input = $('#messageInput');
  const autoResize = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  };
  input.addEventListener('input', autoResize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#composer').requestSubmit();
    }
  });
}

function boot() {
  // restore theme & preset
  let savedTheme = 'dark';
  let savedPreset = 'friendly';
  try {
    savedTheme = localStorage.getItem('chat_theme') || savedTheme;
    savedPreset = localStorage.getItem('chat_preset') || savedPreset;
  } catch {}
  setTheme(savedTheme);
  setPreset(savedPreset);

  // greeting
  const welcome = createMessageEl({
    role: 'bot',
    content: 'สวัสดีครับ ยินดีต้อนรับสู่หน้าเว็บจำลองการสนทนา! ลองพิมพ์ข้อความเพื่อเริ่มต้นได้เลย 🎉',
    time: formatTime()
  });
  $('#messages').appendChild(welcome);
}

window.addEventListener('DOMContentLoaded', () => {
  initEvents();
  boot();
});
