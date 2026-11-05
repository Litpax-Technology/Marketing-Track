// ═══════════════════════════════════════════════════════
//  OWNER PANEL
// ═══════════════════════════════════════════════════════
let user = null;
let allTasks = [];
let taskFor = TASK_FOR_INTERNAL;
const tFilter = { bucket: 'todo', forType: 'all' };

window.onload = () => {
  user = requireUser('owner');
  if (!user) return;
  initUserChip(user);
  refreshAll();
};

function refreshAll() { loadDashboard(); loadTasks(); }

// ── DASHBOARD ──────────────────────────────────────────
async function loadDashboard() {
  try {
    const d = await api({ action: 'getDashboard' });
    if (!d.success) return showToast(d.message || 'Error');
    const s = d.stats;
    document.getElementById('stat-active').textContent   = s.created + s.inProgress + s.review + s.rejected;
    document.getElementById('stat-review').textContent   = s.review;
    document.getElementById('stat-rejected').textContent = s.rejected;
    document.getElementById('stat-overdue').textContent  = s.overdue;
    document.getElementById('stat-approved').textContent = s.approved;
    document.getElementById('stat-internal').textContent = s.internalTasks;
    document.getElementById('stat-agency').textContent   = s.agencyTasks;
    document.getElementById('stat-avg').textContent      = d.avgDays === null ? '—' : d.avgDays;
    document.getElementById('stat-ontime').textContent   = d.agencyOnTimePct === null ? '—' : d.agencyOnTimePct + '%';
    setCount('c-review', s.review);

    const types = Object.keys(d.byType).sort((a, b) => d.byType[b].total - d.byType[a].total);
    document.getElementById('type-tbody').innerHTML = !types.length ? emptyRow(4, 'No data yet') :
      types.map(k => {
        const x = d.byType[k];
        return `<tr><td><strong>${esc(k)}</strong></td><td>${x.total}</td><td>${x.done}</td>
          <td>${x.total ? Math.round(x.done / x.total * 100) : 0}%</td></tr>`;
      }).join('');
  } catch (e) { if (e.message !== 'auth') showToast('Error loading dashboard'); }
}

// ── TASKS ──────────────────────────────────────────────
async function loadTasks() {
  try {
    const d = await api({ action: 'getTasks' });
    if (!d.success) return showToast(d.message || 'Error loading tasks');
    allTasks = d.tasks;
    const counts = { todo: 0, agency: 0, review: 0 };
    allTasks.forEach(t => { const b = bucketOf(t); if (b in counts) counts[b]++; });
    ['todo', 'agency', 'review'].forEach(k =>
      document.getElementById('tc-' + k).textContent = counts[k] ? '(' + counts[k] + ')' : '');
    renderAlerts(document.getElementById('alerts'), allTasks, 'viewTask');
    renderReviewQueue();
    renderTasks();
  } catch (e) { if (e.message !== 'auth') showToast('Error loading tasks'); }
}

function renderReviewQueue() {
  const review = sortByDue(allTasks.filter(t => t.Status === 'Review'));
  document.getElementById('review-tbody').innerHTML = !review.length ? emptyRow(7, 'No reviews pending ✅') :
    review.map(t => {
      const id = esc(t.Task_ID);
      return `<tr>
        <td><strong>${esc(t.Title)}</strong> ${reworkHtml(t)}</td>
        <td>${esc(t.Type || '—')}</td>
        <td>${taskForBadge(t)}</td>
        <td>${esc(t.Agency_Person || '—')}</td>
        <td class="small muted">${formatDate(t.Last_Updated)}</td>
        <td>${dueHtml(t)}</td>
        <td><button class="action-btn btn-view" onclick="viewTask('${id}')">Review</button></td>
      </tr>`;
    }).join('');
}

function renderTasks() {
  let tasks = allTasks.slice();
  if (tFilter.bucket !== 'all') tasks = tasks.filter(t => bucketOf(t) === tFilter.bucket);
  if (tFilter.forType === 'internal') tasks = tasks.filter(t => !isAgencyTask(t));
  if (tFilter.forType === 'agency') tasks = tasks.filter(t => isAgencyTask(t));
  tasks = tFilter.bucket === 'done' ? sortByCompleted(tasks) : sortByDue(tasks);

  const tbody = document.getElementById('tasks-tbody');
  if (!tasks.length) { tbody.innerHTML = emptyRow(9, 'No tasks'); return; }
  tbody.innerHTML = tasks.map(t => {
    const id = esc(t.Task_ID);
    const canTick = !isAgencyTask(t) && !FINAL.includes(t.Status);
    const cls = t.Status === 'Cancelled' ? 'row-cancelled' : '';
    return `<tr id="row-${id}" class="${cls}">
      <td class="td-check">${canTick ? `<input type="checkbox" class="chk" title="Complete" onchange="tickTask('${id}', this)"/>` : ''}</td>
      <td><strong>${esc(t.Title)}</strong><br><small class="muted">${esc(t.Created_By || '')} · ${formatDate(t.Created_Date)}</small></td>
      <td>${esc(t.Type || '—')}</td>
      <td>${taskForBadge(t)}</td>
      <td>${priorityHtml(t.Priority)}</td>
      <td>${badgeHtml(t.Status)} ${reworkHtml(t)}</td>
      <td>${esc(t.Agency_Person || '—')}</td>
      <td>${FINAL.includes(t.Status) ? formatDate(t.Due_Date) : dueHtml(t)}</td>
      <td><button class="action-btn btn-view" onclick="viewTask('${id}')">View</button></td>
    </tr>`;
  }).join('');
}

// ── TASK ACTIONS ───────────────────────────────────────
function afterChange(msg, opts) { showToast(msg, opts); closeModal(); loadTasks(); loadDashboard(); }

async function tickTask(taskId, chk) {
  const row = document.getElementById('row-' + taskId);
  chk.disabled = true;
  row && row.classList.add('row-done');
  if (await taskOp(taskId, 'complete')) {
    afterChange('✅ Task completed', { undo: () => reopenTask(taskId) });
  } else { chk.checked = false; chk.disabled = false; row && row.classList.remove('row-done'); }
}

async function reopenTask(taskId) {
  if (await taskOp(taskId, 'reopen')) afterChange('↺ Moved back to To-Do');
}

async function approveTask(taskId) {
  const reason = (document.getElementById('m-remarks') || {}).value || '';
  if (await taskOp(taskId, 'approve', { reason })) afterChange('✅ Approved');
}

async function rejectTask(taskId) {
  const el = document.getElementById('m-remarks');
  const reason = el ? el.value.trim() : '';
  if (!reason) { el && el.classList.add('input-error'); return showToast('Please add a rejection reason — the agency will see it'); }
  if (await taskOp(taskId, 'reject', { reason })) afterChange('Task rejected — sent back for rework');
}

async function forwardTask(taskId) {
  const agencyPerson = document.getElementById('m-agency').value;
  if (!agencyPerson) return showToast('Please select an agency.');
  if (await taskOp(taskId, 'forward', { agencyPerson })) afterChange('✅ Forwarded to agency');
}

async function completeTask(taskId) {
  if (await taskOp(taskId, 'complete')) afterChange('✅ Task completed', { undo: () => reopenTask(taskId) });
}

async function cancelTask(taskId) {
  const reason = await askReason('Cancel task', 'Reason (required)', true);
  if (reason === null) return;
  if (await taskOp(taskId, 'cancel', { reason })) afterChange('Task cancelled');
}

function viewTask(taskId) {
  const t = allTasks.find(x => x.Task_ID === taskId);
  if (!t) return;
  const id = esc(taskId);
  let actions = '';
  if (t.Status === 'Review') {
    actions = `<input class="remarks-input" id="m-remarks" placeholder="Remarks — required to reject (visible to agency)"/>
      <div class="action-row">
        <button class="btn-primary" style="background:#2e7d32" onclick="approveTask('${id}')">✓ Approve</button>
        <button class="btn-primary" style="background:#c62828" onclick="rejectTask('${id}')">✗ Reject</button>
      </div>`;
  } else if (isAgencyTask(t) && t.Status === 'Created') {
    actions = `<div class="action-row"><select id="m-agency"></select>
      <button class="btn-primary" onclick="forwardTask('${id}')">→ Forward to agency</button></div>`;
  } else if (!isAgencyTask(t) && !FINAL.includes(t.Status)) {
    actions = `<button class="btn-primary" onclick="completeTask('${id}')">✓ Complete</button>`;
  } else if (!isAgencyTask(t) && t.Status === 'Approved') {
    actions = `<button class="btn-ghost" onclick="reopenTask('${id}')">↺ Reopen</button>`;
  }
  if (!FINAL.includes(t.Status)) {
    actions += `<br><button class="btn-danger-text" onclick="cancelTask('${id}')">Cancel task</button>`;
  }
  openTaskModal(t, actions).then(() => {
    const sel = document.getElementById('m-agency');
    if (sel) fillAgencySelect(sel, t.Agency_Person);
  });
}

// ── CREATE TASK ────────────────────────────────────────
function prepCreate() { fillAgencySelect(document.getElementById('f-agency'), document.getElementById('f-agency').value); }

function setTaskFor(val) {
  taskFor = val;
  document.getElementById('btn-internal').classList.toggle('active', val === TASK_FOR_INTERNAL);
  document.getElementById('btn-agency').classList.toggle('active', val === TASK_FOR_AGENCY);
  document.getElementById('agency-field-wrap').classList.toggle('show', val === TASK_FOR_AGENCY);
}

async function createTask() {
  const title = document.getElementById('f-title').value.trim();
  const type = document.getElementById('f-type').value;
  const priority = document.getElementById('f-priority').value;
  const description = document.getElementById('f-desc').value.trim();
  const dueDate = document.getElementById('f-due').value;
  const agencyPerson = taskFor === TASK_FOR_AGENCY ? document.getElementById('f-agency').value : '';
  if (!title || !type || !priority) return showToast('Title, Type and Priority are required.');
  const btn = document.getElementById('createBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating...';
  try {
    const d = await api({ action: 'createTask', title, type, priority, description, dueDate, agencyPerson, taskFor });
    if (d.success) {
      showToast('✅ Task created!');
      ['f-title', 'f-type', 'f-priority', 'f-desc', 'f-due', 'f-agency'].forEach(id => document.getElementById(id).value = '');
      setTaskFor(TASK_FOR_INTERNAL);
      refreshAll();
    } else showToast(d.message || 'Error');
  } catch (e) { showToast('Network error'); }
  btn.disabled = false; btn.innerHTML = 'Create Task';
}

// ── AGENCY REQUESTS (read-only) ────────────────────────
async function loadAgencyRequests() {
  try {
    const d = await api({ action: 'getAgencyRequests' });
    if (!d.success) return;
    const reqs = d.requests;
    document.getElementById('ar-pending').textContent  = reqs.filter(r => r.Status === 'Pending').length;
    document.getElementById('ar-done').textContent     = reqs.filter(r => r.Status === 'Done').length;
    document.getElementById('ar-rejected').textContent = reqs.filter(r => r.Status === 'Rejected').length;
    document.getElementById('requests-grid').innerHTML = !reqs.length
      ? '<div class="empty-state"><p>No requests</p></div>'
      : reqs.map(r => `<div class="req-card status-${esc((r.Status || 'pending').toLowerCase())}">
          <div class="req-card-head"><h3>${esc(r.Title)}</h3>${badgeHtml(r.Status || 'Pending')}</div>
          <p class="pre-wrap" style="color:#555;margin-bottom:8px">${esc(r.Description || '—')}</p>
          <div class="req-meta">
            <div class="req-meta-item">Type: <strong>${esc(r.Type || '—')}</strong></div>
            <div class="req-meta-item">Due: <strong>${formatDate(r.Due_Date)}</strong></div>
            <div class="req-meta-item">From: <strong>${esc(r.Created_By || '—')}</strong></div>
            <div class="req-meta-item">Sent: <strong>${formatDate(r.Created_At)}</strong></div>
            ${r.Remarks ? `<div class="req-meta-item">Remarks: <strong>${esc(r.Remarks)}</strong></div>` : ''}
          </div>
        </div>`).join('');
  } catch (e) { if (e.message !== 'auth') showToast('Error loading requests'); }
}
