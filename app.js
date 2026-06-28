// ═══════════════════════════════════════════════════════════════
// Wedding Manager — app.js
// All JavaScript logic separated from HTML
// ═══════════════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────────────
let guests    = [];
let settings  = {};
let driveLink = '';
let activeTpl = null;

// ── DEFAULT TEMPLATES ──────────────────────────────────────────
const DEFAULT_TPLS = {
  invite: `🌸 *Wedding Invitation*

Dear {name},

You're warmly invited to the wedding of *{bride} & {groom}*!

📅 {date} at {time}
📍 {venue}
{address}
🗺️ Directions: {maps}
📸 Our Photo: {photo}

We look forward to celebrating with you! 💕`,

  reminder4: `⏰ *4-Day Reminder*

Dear {name},

Just a reminder — the wedding of *{bride} & {groom}* is in 4 days!

📅 {date} at {time}
📍 {venue}
🗺️ Directions: {maps}

We can't wait to see you! 💕`,

  reminder2: `🔔 *2-Day Reminder*

Dear {name},

The big day is almost here! *{bride} & {groom}*'s wedding is in just 2 days!

📅 {date} at {time}
📍 {venue}
🗺️ Directions: {maps}

See you there! 💕`,

  photo: `📸 *Wedding Photos Are Here!*

Dear {name},

Thank you so much for being part of our special day! 🌸

View & download your wedding photos here:
👉 {album}

With love,
{bride} & {groom} 💕`
};

// ── INIT ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  settings  = JSON.parse(localStorage.getItem('wm_settings')  || '{}');
  driveLink = localStorage.getItem('wm_drive') || '';

  loadSettingsFields();
  loadTemplatesFromStorage();
  updateReminderDates();

  const dl = document.getElementById('drive-link');
  if (dl && driveLink) dl.value = driveLink;

  if (settings.sheetUrl) loadGuests();
});

// ── NAV ────────────────────────────────────────────────────────
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'reminders') updateMsgPreview();
}

// ── SETTINGS ───────────────────────────────────────────────────
function loadSettingsFields() {
  const map = {
    'sheetUrl': 's-sheet-url',
    'bride':    's-bride',
    'groom':    's-groom',
    'date':     's-date',
    'time':     's-time',
    'venue':    's-venue',
    'address':  's-address',
    'maps':     's-maps',
    'photo':    's-photo',
    'token':    's-token'
  };
  Object.entries(map).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (el && settings[key]) el.value = settings[key];
  });
}

function saveSettings() {
  const map = {
    'sheetUrl': 's-sheet-url',
    'bride':    's-bride',
    'groom':    's-groom',
    'date':     's-date',
    'time':     's-time',
    'venue':    's-venue',
    'address':  's-address',
    'maps':     's-maps',
    'photo':    's-photo',
    'token':    's-token'
  };
  Object.entries(map).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (el) settings[key] = el.value.trim();
  });
  localStorage.setItem('wm_settings', JSON.stringify(settings));
  updateReminderDates();
  toast('✅ Settings saved!');
}

function updateReminderDates() {
  if (!settings.date) return;
  const w  = new Date(settings.date);
  const d4 = new Date(w); d4.setDate(d4.getDate() - 4);
  const d2 = new Date(w); d2.setDate(d2.getDate() - 2);
  const fmt = d => d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
  const e4 = document.getElementById('reminder-4day');
  const e2 = document.getElementById('reminder-2day');
  if (e4) e4.textContent = fmt(d4);
  if (e2) e2.textContent = fmt(d2);
}

// ── GOOGLE SHEETS API ──────────────────────────────────────────
async function sheetsAPI(action, params = {}) {
  const url = settings.sheetUrl;
  if (!url) {
    toast('❌ Sheet URL not set. Go to Setup tab.');
    return null;
  }
  try {
    const qs = new URLSearchParams({ action, ...params });
    const r  = await fetch(url + '?' + qs.toString());
    return await r.json();
  } catch (e) {
    toast('❌ Connection failed: ' + e.message);
    return null;
  }
}

async function testConnection() {
  const box = document.getElementById('conn-status-box');
  box.classList.remove('hidden');
  box.innerHTML = `<div class="conn-status"><div class="conn-dot checking"></div><span>Testing connection...</span></div>`;
  const res = await sheetsAPI('ping');
  if (res && res.status === 'ok') {
    box.innerHTML = `<div class="conn-status"><div class="conn-dot ok"></div><span style="color:var(--green)">✅ ${res.message}</span></div>`;
    loadGuests();
    toast('✅ Connected to Google Sheets!');
  } else {
    box.innerHTML = `<div class="conn-status"><div class="conn-dot err"></div><span style="color:var(--red)">❌ Failed — check your URL and deployment settings</span></div>`;
  }
}

// ── GUESTS ─────────────────────────────────────────────────────
async function loadGuests() {
  const tbody = document.getElementById('guest-tbody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--muted)">
    <span class="spinner spinner-dark"></span> Loading from Google Sheets...
  </td></tr>`;

  const res = await sheetsAPI('getGuests');
  if (!res) return;

  guests = res.guests || [];
  renderGuests();
  updateStats();
}

async function addGuest() {
  const name  = document.getElementById('g-name').value.trim();
  const phone = document.getElementById('g-phone').value.trim();
  const group = document.getElementById('g-group').value;

  if (!name || !phone) { toast('Please enter name and phone'); return; }
  if (!phone.startsWith('+')) { toast('Phone must start with + and country code'); return; }

  const res = await sheetsAPI('addGuest', { name, phone, group });
  if (res && res.success) {
    guests.unshift({ id: res.id, name, phone, group, rsvp: 'Pending', notified: 'No' });
    renderGuests();
    updateStats();
    document.getElementById('g-name').value  = '';
    document.getElementById('g-phone').value = '';
    toast(`${name} added ✓`);
  }
}

async function removeGuest(id, name) {
  if (!confirm(`Delete ${name}?`)) return;
  const res = await sheetsAPI('deleteGuest', { id });
  if (res && res.success) {
    guests = guests.filter(g => g.id !== id);
    renderGuests();
    updateStats();
    toast('Guest deleted');
  }
}

async function updateRSVP(id, val) {
  await sheetsAPI('updateRSVP', { id, rsvp: val });
  const g = guests.find(g => g.id === id);
  if (g) { g.rsvp = val; updateStats(); }
}

function renderGuests() {
  const tbody = document.getElementById('guest-tbody');
  if (!guests.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>No guests yet.<br/>Add your first guest above.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = guests.map(g => `
    <tr>
      <td><strong style="font-weight:500">${escHtml(g.name)}</strong></td>
      <td class="text-muted">${escHtml(g.phone)}</td>
      <td><span class="badge badge-muted">${escHtml(g.group)}</span></td>
      <td>
        <select class="rsvp-select" onchange="updateRSVP('${g.id}', this.value)">
          <option ${g.rsvp==='Pending'   ? 'selected' : ''}>Pending</option>
          <option ${g.rsvp==='Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option ${g.rsvp==='Declined'  ? 'selected' : ''}>Declined</option>
        </select>
      </td>
      <td>
        ${g.notified === 'Yes'
          ? '<span class="badge badge-green">Sent</span>'
          : '<span class="badge badge-muted">Not sent</span>'}
      </td>
      <td>
        <div class="flex" style="gap:5px;flex-wrap:wrap">
          <button class="btn btn-green btn-sm" onclick="sendToOne('${g.id}','${escAttr(g.name)}','${escAttr(g.phone)}')">📱 Send</button>
          <button class="btn btn-danger btn-sm" onclick="removeGuest('${g.id}','${escAttr(g.name)}')">🗑 Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateStats() {
  document.getElementById('stat-total').textContent     = guests.length;
  document.getElementById('stat-invited').textContent   = guests.filter(g => g.notified === 'Yes').length;
  document.getElementById('stat-confirmed').textContent = guests.filter(g => g.rsvp === 'Confirmed').length;
  document.getElementById('stat-declined').textContent  = guests.filter(g => g.rsvp === 'Declined').length;
}

// ── TEMPLATES ──────────────────────────────────────────────────
function loadTemplatesFromStorage() {
  const saved = JSON.parse(localStorage.getItem('wm_templates') || '{}');
  ['invite', 'reminder4', 'reminder2', 'photo'].forEach(k => {
    const el = document.getElementById('tpl-' + k);
    if (el) el.value = saved[k] || DEFAULT_TPLS[k];
  });
}

function saveTemplates() {
  const tpls = {};
  ['invite', 'reminder4', 'reminder2', 'photo'].forEach(k => {
    const el = document.getElementById('tpl-' + k);
    if (el) tpls[k] = el.value;
  });
  localStorage.setItem('wm_templates', JSON.stringify(tpls));
  toast('✅ Templates saved!');
}

function setActiveTpl(el) { activeTpl = el; }

function insertVar(v) {
  if (!activeTpl) { toast('Click inside a template first, then click a variable'); return; }
  const s   = activeTpl.selectionStart;
  const e   = activeTpl.selectionEnd;
  const val = activeTpl.value;
  activeTpl.value = val.slice(0, s) + v + val.slice(e);
  activeTpl.selectionStart = activeTpl.selectionEnd = s + v.length;
  activeTpl.focus();
}

function resetTpl(k) {
  if (!confirm('Reset to default template?')) return;
  const el = document.getElementById('tpl-' + k);
  if (el) el.value = DEFAULT_TPLS[k];
  toast('Template reset to default');
}

function getTpl(k) {
  const saved = JSON.parse(localStorage.getItem('wm_templates') || '{}');
  return saved[k] || DEFAULT_TPLS[k];
}

function buildMsg(guestName, tplKey) {
  const s       = settings;
  const dateStr = s.date
    ? new Date(s.date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : '';
  return getTpl(tplKey)
    .replace(/{name}/g,    guestName)
    .replace(/{bride}/g,   s.bride   || '')
    .replace(/{groom}/g,   s.groom   || '')
    .replace(/{date}/g,    dateStr)
    .replace(/{time}/g,    s.time    || '')
    .replace(/{venue}/g,   s.venue   || '')
    .replace(/{address}/g, s.address || '')
    .replace(/{maps}/g,    s.maps    || '')
    .replace(/{photo}/g,   s.photo   || '')
    .replace(/{album}/g,   driveLink || '');
}

function previewTpl(k) {
  const labels = { invite:'Invitation', reminder4:'4-Day Reminder', reminder2:'2-Day Reminder', photo:'Photo Album' };
  document.getElementById('preview-title').textContent = labels[k] || 'Preview';
  document.getElementById('preview-body').textContent  = buildMsg('Ravi', k);
  document.getElementById('preview-modal').classList.add('open');
}
function closePreview() { document.getElementById('preview-modal').classList.remove('open'); }

function updateMsgPreview() {
  const el = document.getElementById('msg-preview');
  if (el) el.textContent = buildMsg('Ravi', 'invite');
}

// ── WHATSAPP SENDING ───────────────────────────────────────────
async function wasenderSend(to, body) {
  if (!settings.token) return { ok: false, error: 'API token not set. Go to Setup tab.' };
  try {
    const r = await fetch('https://www.wasenderapi.com/api/send-message', {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + settings.token,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ to, text: body })
    });
    const data = await r.json();
    const ok   = data.success === true || (data.data && data.data.status);
    return ok ? { ok: true } : { ok: false, error: data.message || JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function sendToOne(id, name, phone) {
  openModal('Sending to ' + name, 'Sending WhatsApp message...');
  const res = await wasenderSend(phone, buildMsg(name, 'invite'));
  if (res.ok) {
    await sheetsAPI('updateNotified', { id, notified: 'Yes' });
    const g = guests.find(x => x.id === id);
    if (g) g.notified = 'Yes';
    renderGuests();
    updateStats();
    setModalResult(`✅ Message sent to ${name}`);
  } else {
    setModalResult(`❌ Failed: ${res.error}`);
  }
}

async function sendBulkInvite() {
  if (!guests.length) { toast('No guests added yet'); return; }
  openModal('Sending Invitations', `Sending to ${guests.length} guests...`);
  let ok = 0, fail = 0;
  for (const g of guests) {
    const res = await wasenderSend(g.phone, buildMsg(g.name, 'invite'));
    if (res.ok) {
      await sheetsAPI('updateNotified', { id: g.id, notified: 'Yes' });
      g.notified = 'Yes'; ok++;
    } else fail++;
    setModalResult(`Sent: ${ok} &nbsp;|&nbsp; Failed: ${fail}`);
  }
  renderGuests(); updateStats();
  setModalResult(`✅ Done! Sent: ${ok} | Failed: ${fail}`);
}

async function sendReminder(tplKey) {
  if (!guests.length) { toast('No guests added yet'); return; }
  const label = tplKey === 'reminder4' ? '4-Day' : '2-Day';
  openModal(`Sending ${label} Reminders`, `Sending to ${guests.length} guests...`);
  let ok = 0, fail = 0;
  for (const g of guests) {
    const res = await wasenderSend(g.phone, buildMsg(g.name, tplKey));
    if (res.ok) ok++; else fail++;
    setModalResult(`Sent: ${ok} &nbsp;|&nbsp; Failed: ${fail}`);
  }
  setModalResult(`✅ ${label} reminders done! Sent: ${ok} | Failed: ${fail}`);
}

async function sendBlast() {
  const msg = document.getElementById('blast-msg').value.trim();
  if (!msg)           { toast('Please type a message first'); return; }
  if (!guests.length) { toast('No guests added yet'); return; }
  openModal('Sending Custom Blast', `Sending to ${guests.length} guests...`);
  let ok = 0, fail = 0;
  for (const g of guests) {
    const res = await wasenderSend(g.phone, msg.replace(/{name}/g, g.name));
    if (res.ok) ok++; else fail++;
    setModalResult(`Sent: ${ok} &nbsp;|&nbsp; Failed: ${fail}`);
  }
  setModalResult(`✅ Done! Sent: ${ok} | Failed: ${fail}`);
}

async function sendPhotoLink() {
  if (!driveLink)     { toast('Please save a Google Drive link first'); return; }
  if (!guests.length) { toast('No guests added yet'); return; }
  openModal('Sending Photo Album', `Sending album link to ${guests.length} guests...`);
  let ok = 0, fail = 0;
  for (const g of guests) {
    const res = await wasenderSend(g.phone, buildMsg(g.name, 'photo'));
    if (res.ok) ok++; else fail++;
    setModalResult(`Sent: ${ok} &nbsp;|&nbsp; Failed: ${fail}`);
  }
  setModalResult(`✅ Album link sent! Sent: ${ok} | Failed: ${fail}`);
}

// ── CSV IMPORT / EXPORT ────────────────────────────────────────
function exportCSV() {
  const rows = [
    ['Name', 'Phone', 'Group', 'RSVP', 'Notified'],
    ...guests.map(g => [g.name, g.phone, g.group, g.rsvp, g.notified])
  ];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'wedding-guests.csv';
  a.click();
}

function importCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const lines = e.target.result.split('\n').slice(1);
    let added = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
      const [name, phone, group] = cols;
      if (name && phone) {
        const res = await sheetsAPI('addGuest', { name, phone, group: group || 'Other' });
        if (res && res.success) added++;
      }
    }
    await loadGuests();
    toast(`✅ ${added} guests imported!`);
  };
  reader.readAsText(file);
  input.value = '';
}

// ── DRIVE LINK ─────────────────────────────────────────────────
function saveDriveLink() {
  driveLink = document.getElementById('drive-link').value.trim();
  localStorage.setItem('wm_drive', driveLink);
  toast('✅ Drive link saved!');
}

// ── MODAL ──────────────────────────────────────────────────────
function openModal(title, sub) {
  document.getElementById('modal-title').textContent    = title;
  document.getElementById('modal-sub').textContent      = sub;
  document.getElementById('modal-progress').innerHTML   =
    '<p style="font-size:13px;color:var(--muted);margin-top:8px"><span class="spinner spinner-dark"></span> Sending...</p>';
  document.getElementById('send-modal').classList.add('open');
}
function setModalResult(html) {
  document.getElementById('modal-progress').innerHTML =
    `<p style="font-size:13px;margin-top:8px">${html}</p>`;
}
function closeModal()  { document.getElementById('send-modal').classList.remove('open'); }
function closePreview(){ document.getElementById('preview-modal').classList.remove('open'); }

// ── TOAST ──────────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── UTILS ──────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
