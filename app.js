// ═══════════════════════════════════════════════════════
//  Litpax Marketing Hub — shared helpers (saare pages)
//  Depends on: config.js
// ═══════════════════════════════════════════════════════

const SESSION_KEY = 'lmh_user';
const FINAL = ['Approved', 'Cancelled'];

// ── SESSION ────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}

function requireUser(role) {
  const u = getSession();
  if (!u || u.role !== role) { window.location.href = 'index.html'; return null; }
  return u;
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ── API (har call ke saath PIN jaata hai, server verify karta hai) ──
async function api(body) {
  const s = getSession();
  const payload = Object.assign({}, body, { pin: body.pin || (s && s.pin) });
  const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.auth === false) {
    sessionStorage.clear();
    alert(data.message || 'Session expire. Dobara login karo.');
    window.location.href = 'index.html';
    throw new Error('auth');
  }
  return data;
}

// ── HTML ESCAPE (title mein ' ya < aaye toh page na toote) ──
function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(u) {
  return /^https?:\/\//i.test(String(u || '')) ? esc(u) : '#';
}

// ── DATES ──────────────────────────────────────────────
// ISO (naya data), "2026-11-10", aur purani "29/6/2026, 12:06:57" — teeno samajhta hai
function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (m) {
    let hh = +(m[4] || 0);
    if (m[7]) { const pm = m[7].toLowerCase() === 'pm'; if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
    return new Date(+m[3], +m[2] - 1, +m[1], hh, +(m[5] || 0), +(m[6] || 0));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad2 = n => String(n).padStart(2, '0');

function formatDate(v) {
  const d = parseDate(v);
  return d ? pad2(d.getDate()) + '-' + MONTHS[d.getMonth()] + '-' + d.getFullYear() : '—';
}

function formatDateTime(v) {
  const d = parseDate(v);
  return d ? formatDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '—';
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

// 'overdue' | 'today' | ''
function dueState(t) {
  if (FINAL.includes(t.Status)) return '';
  const d = parseDate(t.Due_Date);
  if (!d) return '';
  const today = startOfToday();
  if (d < today) return 'overdue';
  if (d.getTime() === today.getTime()) return 'today';
  return '';
}

function dueHtml(t) {
  const st = dueState(t);
  const label = formatDate(t.Due_Date);
  if (st === 'overdue') return `<span class="due-overdue">${label}</span>`;
  if (st === 'today')   return `<span class="due-today">Aaj</span>`;
  return label;
}

// ── TASK HELPERS ───────────────────────────────────────
function isAgencyTask(t) { return t.Task_For === TASK_FOR_AGENCY; }

// Employee/Owner ke liye bucket
function bucketOf(t) {
  if (FINAL.includes(t.Status)) return 'done';
  if (t.Status === 'Review') return 'review';
  if (isAgencyTask(t) && ['In Progress', 'Rejected'].includes(t.Status)) return 'agency';
  return 'todo';
}

function sortByDue(tasks) {
  return tasks.slice().sort((a, b) => {
    const da = parseDate(a.Due_Date), db = parseDate(b.Due_Date);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}

function sortByCompleted(tasks) {
  return tasks.slice().sort((a, b) =>
    (parseDate(b.Completed_At || b.Last_Updated) || 0) - (parseDate(a.Completed_At || a.Last_Updated) || 0));
}

// ── BADGES ─────────────────────────────────────────────
function badgeHtml(status) {
  const map = {
    'Created': 'badge-created', 'Assigned': 'badge-assigned', 'In Progress': 'badge-inprogress',
    'Review': 'badge-review', 'Approved': 'badge-approved', 'Rejected': 'badge-rejected',
    'Cancelled': 'badge-cancelled', 'Pending': 'badge-pending', 'Done': 'badge-done',
    'Pending Review': 'badge-review',
    'owner': 'badge-created', 'employee': 'badge-approved', 'agency': 'badge-review'
  };
  return `<span class="badge ${map[status] || 'badge-created'}">${esc(status || '—')}</span>`;
}

function priorityHtml(p) {
  const cls = p === 'High' ? 'priority-high' : p === 'Medium' ? 'priority-medium' : 'priority-low';
  return `<span class="${cls}">${esc(p || '—')}</span>`;
}

function taskForBadge(t) {
  return isAgencyTask(t)
    ? '<span class="tag tag-agency">🏢 Agency</span>'
    : '<span class="tag tag-internal">👤 Internal</span>';
}

function reworkHtml(t) {
  const n = Number(t.Rework_Count) || 0;
  return n ? `<span class="tag tag-rework">🔁 ${n}</span>` : '';
}

// Overdue + Aaj due box. onClickFn = page ka viewTask
function renderAlerts(el, tasks, onClickFn) {
  const overdue = sortByDue(tasks.filter(t => dueState(t) === 'overdue'));
  const today   = tasks.filter(t => dueState(t) === 'today');
  const item = t => `<div class="alert-item" onclick="${onClickFn}('${esc(t.Task_ID)}')">
      ${taskForBadge(t)} <strong>${esc(t.Title)}</strong>
      <span class="meta">${badgeHtml(t.Status)} · ${formatDate(t.Due_Date)}</span></div>`;
  el.innerHTML =
    (overdue.length ? `<div class="alert-box"><h4>⚠️ Overdue (${overdue.length})</h4>${overdue.map(item).join('')}</div>` : '') +
    (today.length ? `<div class="alert-box today"><h4>📅 Aaj due (${today.length})</h4>${today.map(item).join('')}</div>` : '');
}

// ── UI: SECTIONS / TABS ────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  const nav = document.getElementById('nav-' + name);
  if (nav) nav.classList.add('active');
}

function setActiveBtn(btn) {
  btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setCount(id, n) {
  const el = document.getElementById(id);
  if (el) { el.textContent = n; el.style.display = n ? '' : 'none'; }
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="empty-state"><p>${esc(msg)}</p></td></tr>`;
}

// ── TOAST (optional Undo button) ───────────────────────
let toastTimer = null;
function showToast(msg, opts) {
  const t = document.getElementById('toast');
  t.innerHTML = esc(msg);
  if (opts && opts.undo) {
    const b = document.createElement('button');
    b.className = 'toast-undo'; b.textContent = 'Undo';
    b.onclick = () => { t.classList.remove('show'); opts.undo(); };
    t.appendChild(b);
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), (opts && opts.undo) ? 6000 : 3000);
}

// ── MODAL ──────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal() {
  document.querySelectorAll('.modal-overlay:not(#reasonModal)').forEach(m => m.classList.remove('open'));
}

// Reason maangne ke liye (prompt() ki jagah). Promise<string|null>
function askReason(title, placeholder, required) {
  return new Promise(resolve => {
    let ov = document.getElementById('reasonModal');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'modal-overlay'; ov.id = 'reasonModal';
      ov.innerHTML = `<div class="modal modal-sm">
        <div class="modal-head"><h3 id="rm-title"></h3></div>
        <textarea class="remarks-input" id="rm-text" rows="3"></textarea>
        <div class="modal-actions">
          <button class="btn-primary" id="rm-ok">OK</button>
          <button class="btn-ghost" id="rm-cancel">Cancel</button>
        </div></div>`;
      document.body.appendChild(ov);
    }
    document.getElementById('rm-title').textContent = title;
    const ta = document.getElementById('rm-text');
    ta.value = ''; ta.placeholder = placeholder || '';
    ov.classList.add('open'); ta.focus();
    const done = val => { ov.classList.remove('open'); resolve(val); };
    document.getElementById('rm-ok').onclick = () => {
      const v = ta.value.trim();
      if (required && !v) { ta.classList.add('input-error'); return; }
      ta.classList.remove('input-error'); done(v);
    };
    document.getElementById('rm-cancel').onclick = () => done(null);
  });
}

// ── TASK ACTION (saare status change yahin se) ─────────
async function taskOp(taskId, op, extra) {
  try {
    const d = await api(Object.assign({ action: 'taskAction', taskId, op }, extra || {}));
    if (!d.success) { showToast(d.message || 'Error'); return false; }
    return true;
  } catch (e) {
    if (e.message !== 'auth') showToast('Network error');
    return false;
  }
}

// ── AGENCY DROPDOWN ────────────────────────────────────
let agencyCache = null;
async function fillAgencySelect(selectEl, selected) {
  if (!agencyCache) {
    try { const d = await api({ action: 'getAgencies' }); agencyCache = d.success ? d.agencies : []; }
    catch (e) { agencyCache = []; }
  }
  selectEl.innerHTML = '<option value="">Agency select karo</option>' +
    agencyCache.map(a => `<option ${a === selected ? 'selected' : ''}>${esc(a)}</option>`).join('');
}

// ── FILE → BASE64 ──────────────────────────────────────
function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ── TASK DETAIL MODAL (details + deliverables + comments) ──
// actionsHtml: page apne buttons deta hai
async function openTaskModal(task, actionsHtml) {
  document.getElementById('modal-title').textContent = task.Title;
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="detail-row">
      <div class="detail-item"><label>Status</label><p>${badgeHtml(task.Status)} ${reworkHtml(task)}</p></div>
      <div class="detail-item"><label>Task For</label><p>${taskForBadge(task)}</p></div>
      <div class="detail-item"><label>Priority</label><p>${priorityHtml(task.Priority)}</p></div>
    </div>
    <div class="detail-row">
      <div class="detail-item"><label>Type</label><p>${esc(task.Type || '—')}</p></div>
      <div class="detail-item"><label>Agency</label><p>${esc(task.Agency_Person || '—')}</p></div>
      <div class="detail-item"><label>Due</label><p>${dueHtml(task)}</p></div>
    </div>
    <div class="detail-row">
      <div class="detail-item"><label>Created By</label><p>${esc(task.Created_By || '—')}</p></div>
      <div class="detail-item"><label>Created</label><p>${formatDate(task.Created_Date)}</p></div>
      <div class="detail-item"><label>${task.Status === 'Cancelled' ? 'Cancelled' : 'Completed'}</label>
        <p>${task.Completed_At ? formatDateTime(task.Completed_At) + ' · ' + esc(task.Completed_By || '') : '—'}</p></div>
    </div>
    ${task.Status === 'Rejected' && task.Reject_Reason ? `<div class="reject-box">❌ <strong>Reject reason:</strong> ${esc(task.Reject_Reason)}</div>` : ''}
    <div class="detail-item" style="margin-bottom:12px"><label>Description</label>
      <p class="pre-wrap">${esc(task.Description || '—')}</p></div>
    <div class="deliverables-list"><h4>📁 Deliverables</h4><div id="m-dels"><p class="muted">Loading...</p></div></div>
    <div class="comments"><h4>💬 Comments</h4>
      <div id="m-cmts"><p class="muted">Loading...</p></div>
      <div class="comment-form">
        <input class="remarks-input" id="m-cmt-text" placeholder="Comment likho..." maxlength="1000"/>
        <button class="btn-sm btn-view" onclick="postComment('${esc(task.Task_ID)}')">Send</button>
      </div>
    </div>
    <div class="modal-actions-wrap">${actionsHtml || ''}</div>`;
  openModal('taskModal');
  document.getElementById('m-cmt-text').addEventListener('keydown', e => {
    if (e.key === 'Enter') postComment(task.Task_ID);
  });
  loadModalDeliverables(task.Task_ID);
  loadComments(task.Task_ID);
}

async function loadModalDeliverables(taskId) {
  const el = document.getElementById('m-dels');
  try {
    const d = await api({ action: 'getDeliverables', taskId });
    const dels = d.success ? d.deliverables : [];
    el.innerHTML = dels.length ? dels.map(x => `
      <div class="del-item">
        <a href="${safeUrl(x.File_Link)}" target="_blank" rel="noopener">🔗 ${esc(x.Description || 'File')}</a>
        <div class="del-meta">${esc(x.Uploaded_By)} · ${formatDateTime(x.Upload_Date)} · ${badgeHtml(x.Status)}
          ${x.Owner_Remarks ? ' · ' + esc(x.Owner_Remarks) : ''}</div>
      </div>`).join('') : '<p class="muted">Koi deliverable nahi</p>';
  } catch (e) { el.innerHTML = '<p class="muted">Load nahi hua</p>'; }
}

async function loadComments(taskId) {
  const el = document.getElementById('m-cmts');
  if (!el) return;
  try {
    const d = await api({ action: 'getComments', taskId });
    const list = d.success ? d.comments : [];
    el.innerHTML = list.length ? list.map(c => `
      <div class="cmt cmt-${esc(c.User_Role)}">
        <div class="cmt-head"><strong>${esc(c.User_Name)}</strong> ${badgeHtml(c.User_Role)}
          <span class="cmt-time">${formatDateTime(c.Timestamp)}</span></div>
        <div class="pre-wrap">${esc(c.Comment)}</div>
      </div>`).join('') : '<p class="muted">Abhi koi comment nahi</p>';
    el.scrollTop = el.scrollHeight;
  } catch (e) { el.innerHTML = '<p class="muted">Load nahi hua</p>'; }
}

async function postComment(taskId) {
  const input = document.getElementById('m-cmt-text');
  const text = input.value.trim();
  if (!text) return;
  input.disabled = true;
  try {
    const d = await api({ action: 'addComment', taskId, text });
    if (d.success) { input.value = ''; loadComments(taskId); }
    else showToast(d.message || 'Error');
  } catch (e) { showToast('Network error'); }
  input.disabled = false; input.focus();
}

// ── ACTIVITY LOG (owner + employee) ────────────────────
async function loadLog() {
  const tbody = document.getElementById('log-tbody');
  try {
    const d = await api({ action: 'getActivityLog' });
    tbody.innerHTML = (d.success && d.logs.length) ? d.logs.map(l => `<tr>
        <td class="small muted">${formatDateTime(l.Timestamp)}</td>
        <td><strong>${esc(l.User_Name)}</strong></td>
        <td>${badgeHtml(l.User_Role)}</td>
        <td>${esc(l.Action)}</td>
        <td class="small muted">${esc(l.Task_Title || '—')}</td>
        <td class="small muted">${esc(l.Remarks || '—')}</td>
      </tr>`).join('') : emptyRow(6, 'Koi activity nahi');
  } catch (e) { tbody.innerHTML = emptyRow(6, 'Load nahi hua'); }
}

// ── USER CHIP ──────────────────────────────────────────
function initUserChip(user) {
  const a = document.getElementById('userAvatar');
  const n = document.getElementById('userName');
  if (a) a.textContent = (user.name || '?')[0].toUpperCase();
  if (n) n.textContent = user.name;
}

// Modal ke bahar click / Esc se band
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('modal-overlay') && e.target.id !== 'reasonModal') closeModal();
});
document.addEventListener('keydown', e => {
  const rm = document.getElementById('reasonModal');
  if (e.key === 'Escape' && !(rm && rm.classList.contains('open'))) closeModal();
});
