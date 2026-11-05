// ═══════════════════════════════════════════════════════
//  EMPLOYEE PANEL
// ═══════════════════════════════════════════════════════
let user = null;
let allTasks = [];
let doneFilter = 'all';

window.onload = () => {
  user = requireUser('employee');
  if (!user) return;
  initUserChip(user);
  loadTasks();
  loadAgencyRequests();
};

async function loadTasks() {
  try {
    const d = await api({ action: 'getTasks' });
    if (!d.success) return showToast(d.message || 'Error loading tasks');
    allTasks = d.tasks;
    renderAll();
  } catch (e) { if (e.message !== 'auth') showToast('Error loading tasks'); }
}

function renderAll() {
  const b = { todo: [], agency: [], review: [], done: [] };
  allTasks.forEach(t => b[bucketOf(t)].push(t));
  const active = allTasks.filter(t => !FINAL.includes(t.Status));

  document.getElementById('s-todo').textContent    = b.todo.length;
  document.getElementById('s-agency').textContent  = b.agency.length;
  document.getElementById('s-review').textContent  = b.review.length;
  document.getElementById('s-overdue').textContent = active.filter(t => dueState(t) === 'overdue').length;
  setCount('c-todo', b.todo.length);
  setCount('c-agency', b.agency.length);
  setCount('c-review', b.review.length);

  renderAlerts(document.getElementById('alerts'), active, 'viewTask');
  renderTodo(sortByDue(b.todo));
  renderAgency(sortByDue(b.agency));
  renderReview(sortByDue(b.review));
  renderDone();
}

// ── TO-DO ──────────────────────────────────────────────
function renderTodo(tasks) {
  const tbody = document.getElementById('todo-tbody');
  if (!tasks.length) { tbody.innerHTML = emptyRow(7, 'All caught up ✅'); return; }
  tbody.innerHTML = tasks.map(t => {
    const id = esc(t.Task_ID);
    const internal = !isAgencyTask(t);
    return `<tr id="row-${id}">
      <td class="td-check">${internal
        ? `<input type="checkbox" class="chk" title="Complete" onchange="tickTask('${id}', this)"/>` : ''}</td>
      <td><strong>${esc(t.Title)}</strong><br><small class="muted">${esc(t.Created_By || '')}</small></td>
      <td>${esc(t.Type || '—')}</td>
      <td>${taskForBadge(t)}</td>
      <td>${priorityHtml(t.Priority)}</td>
      <td>${dueHtml(t)}</td>
      <td>
        <button class="action-btn btn-view" onclick="viewTask('${id}')">View</button>
        ${!internal ? `<button class="action-btn btn-forward" onclick="forwardTask('${id}')">→ Send to agency</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function tickTask(taskId, chk) {
  const row = document.getElementById('row-' + taskId);
  chk.disabled = true;
  row && row.classList.add('row-done');
  const ok = await taskOp(taskId, 'complete');
  if (!ok) { chk.checked = false; chk.disabled = false; row && row.classList.remove('row-done'); return; }
  const t = allTasks.find(x => x.Task_ID === taskId);
  showToast('✅ Done: ' + (t ? t.Title : ''), { undo: () => reopenTask(taskId) });
  setTimeout(loadTasks, 500);
}

async function reopenTask(taskId) {
  if (await taskOp(taskId, 'reopen')) { showToast('↺ Moved back to To-Do'); closeModal(); loadTasks(); }
}

// ── AGENCY KE PAAS ─────────────────────────────────────
function renderAgency(tasks) {
  const tbody = document.getElementById('agency-tbody');
  if (!tasks.length) { tbody.innerHTML = emptyRow(6, 'Nothing with the agency right now'); return; }
  tbody.innerHTML = tasks.map(t => {
    const id = esc(t.Task_ID);
    return `<tr>
      <td><strong>${esc(t.Title)}</strong>${t.Status === 'Rejected' && t.Reject_Reason
        ? `<br><small class="due-overdue">❌ ${esc(t.Reject_Reason)}</small>` : ''}</td>
      <td>${esc(t.Type || '—')}</td>
      <td>${esc(t.Agency_Person || '—')}</td>
      <td>${badgeHtml(t.Status)} ${reworkHtml(t)}</td>
      <td>${dueHtml(t)}</td>
      <td>
        <button class="action-btn btn-view" onclick="viewTask('${id}')">View</button>
        <button class="action-btn btn-progress" onclick="sendReview('${id}')">→ Send for review</button>
      </td>
    </tr>`;
  }).join('');
}

// ── OWNER REVIEW ───────────────────────────────────────
function renderReview(tasks) {
  const tbody = document.getElementById('review-tbody');
  if (!tasks.length) { tbody.innerHTML = emptyRow(6, 'Nothing pending with the owner'); return; }
  tbody.innerHTML = tasks.map(t => `<tr>
      <td><strong>${esc(t.Title)}</strong></td>
      <td>${taskForBadge(t)}</td>
      <td>${esc(t.Agency_Person || '—')}</td>
      <td class="small muted">${formatDate(t.Last_Updated)}</td>
      <td>${dueHtml(t)}</td>
      <td><button class="action-btn btn-view" onclick="viewTask('${esc(t.Task_ID)}')">View</button></td>
    </tr>`).join('');
}

// ── COMPLETED ──────────────────────────────────────────
function renderDone() {
  const tbody = document.getElementById('done-tbody');
  let tasks = allTasks.filter(t => FINAL.includes(t.Status));
  if (doneFilter !== 'all') tasks = tasks.filter(t => t.Status === doneFilter);
  tasks = sortByCompleted(tasks);
  if (!tasks.length) { tbody.innerHTML = emptyRow(6, 'No records yet'); return; }
  tbody.innerHTML = tasks.map(t => {
    const id = esc(t.Task_ID);
    return `<tr class="${t.Status === 'Cancelled' ? 'row-cancelled' : ''}">
      <td><strong>${esc(t.Title)}</strong></td>
      <td>${taskForBadge(t)}</td>
      <td>${badgeHtml(t.Status)}</td>
      <td class="small">${formatDateTime(t.Completed_At || t.Last_Updated)}</td>
      <td class="small">${esc(t.Completed_By || '—')}</td>
      <td>
        <button class="action-btn btn-view" onclick="viewTask('${id}')">View</button>
        ${!isAgencyTask(t) && t.Status === 'Approved'
          ? `<button class="action-btn btn-progress" onclick="reopenTask('${id}')">↺ Reopen</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// ── ACTIONS ────────────────────────────────────────────
async function forwardTask(taskId) {
  const t = allTasks.find(x => x.Task_ID === taskId);
  if (!t) return;
  await openTaskModal(t, `
    <div class="action-row">
      <select id="fw-agency"></select>
      <input class="remarks-input" id="fw-remarks" placeholder="Instructions for the agency (optional)"/>
      <button class="btn-primary" onclick="doForward('${esc(taskId)}')">→ Forward</button>
    </div>`);
  fillAgencySelect(document.getElementById('fw-agency'), t.Agency_Person);
}

async function doForward(taskId) {
  const agencyPerson = document.getElementById('fw-agency').value;
  const reason = document.getElementById('fw-remarks').value.trim();
  if (!agencyPerson) return showToast('Please select an agency.');
  if (await taskOp(taskId, 'forward', { agencyPerson, reason })) {
    showToast('✅ Forwarded to agency'); closeModal(); loadTasks();
  }
}

async function sendReview(taskId) {
  const reason = await askReason('Send to owner for review', 'Remarks (optional)', false);
  if (reason === null) return;
  if (await taskOp(taskId, 'submit', { reason: reason || 'Sent for review by employee' })) {
    showToast('✅ Sent for owner review'); closeModal(); loadTasks();
  }
}

async function cancelTask(taskId) {
  const reason = await askReason('Cancel task', 'Reason (required)', true);
  if (reason === null) return;
  if (await taskOp(taskId, 'cancel', { reason })) { showToast('Task cancelled'); closeModal(); loadTasks(); }
}

async function completeFromModal(taskId) {
  if (await taskOp(taskId, 'complete')) {
    showToast('✅ Done', { undo: () => reopenTask(taskId) }); closeModal(); loadTasks();
  }
}

function viewTask(taskId) {
  const t = allTasks.find(x => x.Task_ID === taskId);
  if (!t) return;
  const id = esc(taskId);
  const b = bucketOf(t);
  let actions = '';
  if (b === 'todo' && !isAgencyTask(t)) {
    actions = `<button class="btn-primary" onclick="completeFromModal('${id}')">✓ Complete</button>`;
  } else if (b === 'todo') {
    return forwardTask(taskId);
  } else if (b === 'agency') {
    actions = `<button class="btn-primary" onclick="sendReview('${id}')">→ Send for owner review</button>`;
  } else if (b === 'done' && !isAgencyTask(t) && t.Status === 'Approved') {
    actions = `<button class="btn-ghost" onclick="reopenTask('${id}')">↺ Reopen</button>`;
  }
  if (!FINAL.includes(t.Status) && t.Created_By === user.name) {
    actions += `<br><button class="btn-danger-text" onclick="cancelTask('${id}')">Cancel task</button>`;
  }
  openTaskModal(t, actions);
}

// ── ASSIGN TO AGENCY ───────────────────────────────────
function prepAssign() {
  fillAgencySelect(document.getElementById('a-agency'), document.getElementById('a-agency').value);
}

async function assignToAgency() {
  const title = document.getElementById('a-title').value.trim();
  const type = document.getElementById('a-type').value;
  const priority = document.getElementById('a-priority').value;
  const description = document.getElementById('a-desc').value.trim();
  const agencyPerson = document.getElementById('a-agency').value;
  const dueDate = document.getElementById('a-due').value;
  if (!title || !type || !priority || !agencyPerson) return showToast('Please fill all required fields.');
  const btn = document.getElementById('assignBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Assigning...';
  try {
    const d = await api({ action: 'createEmployeeTask', title, type, priority, description, agencyPerson, dueDate });
    if (d.success) {
      showToast('✅ Assigned to agency');
      ['a-title', 'a-type', 'a-priority', 'a-desc', 'a-due'].forEach(id => document.getElementById(id).value = '');
      loadTasks();
    } else showToast(d.message || 'Error');
  } catch (e) { showToast('Network error'); }
  btn.disabled = false; btn.innerHTML = 'Assign to Agency';
}

// ── AGENCY REQUESTS ────────────────────────────────────
async function loadAgencyRequests() {
  try {
    const d = await api({ action: 'getAgencyRequests' });
    if (!d.success) return;
    const reqs = d.requests;
    const pending = reqs.filter(r => r.Status === 'Pending').length;
    document.getElementById('ar-pending').textContent  = pending;
    document.getElementById('ar-done').textContent     = reqs.filter(r => r.Status === 'Done').length;
    document.getElementById('ar-rejected').textContent = reqs.filter(r => r.Status === 'Rejected').length;
    setCount('c-req', pending);
    const grid = document.getElementById('requests-grid');
    grid.innerHTML = !reqs.length ? '<div class="empty-state"><p>No requests</p></div>' : reqs.map(r => {
      const st = (r.Status || 'Pending').toLowerCase();
      return `<div class="req-card status-${esc(st)}">
        <div class="req-card-head"><h3>${esc(r.Title)}</h3>${badgeHtml(r.Status || 'Pending')}</div>
        <p class="pre-wrap" style="color:#555;margin-bottom:8px">${esc(r.Description || '—')}</p>
        <div class="req-meta">
          <div class="req-meta-item">Type: <strong>${esc(r.Type || '—')}</strong></div>
          <div class="req-meta-item">Due: <strong>${r.Status === 'Pending' ? dueHtml(r) : formatDate(r.Due_Date)}</strong></div>
          <div class="req-meta-item">From: <strong>${esc(r.Created_By || '—')}</strong></div>
          ${r.Remarks ? `<div class="req-meta-item">Remarks: <strong>${esc(r.Remarks)}</strong></div>` : ''}
        </div>
        ${r.Status === 'Pending' ? `<div class="action-row">
          <button class="action-btn btn-approve" onclick="updateRequest('${esc(r.Req_ID)}','Done')">✓ Mark Done</button>
          <button class="action-btn btn-reject" onclick="updateRequest('${esc(r.Req_ID)}','Rejected')">✗ Reject</button>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch (e) { if (e.message !== 'auth') showToast('Error loading requests'); }
}

async function updateRequest(reqId, newStatus) {
  let reason = '';
  if (newStatus === 'Rejected') {
    reason = await askReason('Reject request', 'Reason (required)', true);
    if (reason === null) return;
  }
  try {
    const d = await api({ action: 'updateAgencyRequest', reqId, newStatus, reason });
    if (d.success) { showToast('✅ Request ' + newStatus); loadAgencyRequests(); }
    else showToast(d.message || 'Error');
  } catch (e) { showToast('Network error'); }
}
