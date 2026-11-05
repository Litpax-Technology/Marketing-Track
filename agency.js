// ═══════════════════════════════════════════════════════
//  AGENCY PANEL
// ═══════════════════════════════════════════════════════
let user = null;
let allTasks = [];
let aFilter = 'active';

window.onload = () => {
  user = requireUser('agency');
  if (!user) return;
  initUserChip(user);
  loadTasks();
};

async function loadTasks() {
  try {
    const d = await api({ action: 'getTasks' });
    if (!d.success) return showToast(d.message || 'Error loading tasks');
    allTasks = d.tasks;
    const active = allTasks.filter(t => ['In Progress', 'Rejected'].includes(t.Status));
    document.getElementById('s-active').textContent = allTasks.filter(t => t.Status === 'In Progress').length;
    document.getElementById('s-rework').textContent = allTasks.filter(t => t.Status === 'Rejected').length;
    document.getElementById('s-review').textContent = allTasks.filter(t => t.Status === 'Review').length;
    document.getElementById('s-done').textContent   = allTasks.filter(t => t.Status === 'Approved').length;
    setCount('c-active', active.length);
    renderAlerts(document.getElementById('alerts'), active, 'viewTask');
    renderTaskCards();
  } catch (e) { if (e.message !== 'auth') showToast('Error loading tasks'); }
}

function renderTaskCards() {
  const pick = {
    active: t => ['In Progress', 'Rejected'].includes(t.Status),
    review: t => t.Status === 'Review',
    done:   t => t.Status === 'Approved'
  }[aFilter];
  let tasks = allTasks.filter(pick);
  tasks = aFilter === 'done' ? sortByCompleted(tasks) : sortByDue(tasks);

  const grid = document.getElementById('tasks-grid');
  if (!tasks.length) {
    grid.innerHTML = `<div class="empty-state"><p>${aFilter === 'active' ? 'Nothing pending ✅' : 'Nothing here'}</p></div>`;
    return;
  }
  grid.innerHTML = tasks.map(t => {
    const id = esc(t.Task_ID);
    const workable = ['In Progress', 'Rejected'].includes(t.Status);
    return `<div class="task-card priority-${esc(t.Priority || 'Low')}">
      <div class="task-card-head"><h3>${esc(t.Title)}</h3>${badgeHtml(t.Status)}</div>
      ${t.Status === 'Rejected' && t.Reject_Reason
        ? `<div class="reject-box">❌ <strong>What needs fixing:</strong> ${esc(t.Reject_Reason)} ${reworkHtml(t)}</div>` : ''}
      <p class="task-desc">${esc(t.Description || 'No description')}</p>
      <div class="task-meta">
        <div class="task-meta-item">Type: <strong>${esc(t.Type || '—')}</strong></div>
        <div class="task-meta-item">Due: <strong>${t.Status === 'Approved' ? formatDate(t.Due_Date) : dueHtml(t)}</strong></div>
        ${t.Status === 'Approved' ? `<div class="task-meta-item">Approved: <strong>${formatDate(t.Completed_At)}</strong></div>` : ''}
      </div>
      <div class="task-actions">
        ${workable ? `<button class="btn-sm btn-upload" onclick="openUpload('${id}')">📁 Upload</button>
                      <button class="btn-sm btn-done" onclick="submitTask('${id}')">✓ Submit for Review</button>` : ''}
        <button class="btn-sm btn-view" onclick="viewTask('${id}')">💬 Details</button>
      </div>
    </div>`;
  }).join('');
}

function viewTask(taskId) {
  const t = allTasks.find(x => x.Task_ID === taskId);
  if (!t) return;
  const id = esc(taskId);
  const actions = ['In Progress', 'Rejected'].includes(t.Status)
    ? `<div class="action-row">
         <button class="btn-sm btn-upload" onclick="openUpload('${id}')">📁 Upload</button>
         <button class="btn-primary" onclick="submitTask('${id}')">✓ Submit for Review</button>
       </div>` : '';
  openTaskModal(t, actions);
}

// ── UPLOAD (status nahi badalta — Submit alag button hai) ──
async function openUpload(taskId) {
  const t = allTasks.find(x => x.Task_ID === taskId);
  if (!t) return;
  closeModal();
  document.getElementById('up-title').textContent = 'Upload — ' + t.Title;
  ['up-file', 'up-link', 'up-desc'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('up-btn').onclick = () => doUpload(taskId);
  openModal('uploadModal');
  renderPrevUploads(taskId);
}

async function renderPrevUploads(taskId) {
  const el = document.getElementById('up-prev');
  el.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const d = await api({ action: 'getDeliverables', taskId });
    const dels = d.success ? d.deliverables : [];
    el.innerHTML = dels.length ? dels.map(x => `<div class="del-item">
        <a href="${safeUrl(x.File_Link)}" target="_blank" rel="noopener">🔗 ${esc(x.Description || 'File')}</a>
        <div class="del-meta">${formatDateTime(x.Upload_Date)} · ${badgeHtml(x.Status)}${x.Owner_Remarks ? ' · ' + esc(x.Owner_Remarks) : ''}</div>
      </div>`).join('') : '<p class="muted">Nothing uploaded yet</p>';
  } catch (e) { el.innerHTML = ''; }
}

async function doUpload(taskId) {
  const t = allTasks.find(x => x.Task_ID === taskId);
  const file = document.getElementById('up-file').files[0];
  const fileLink = document.getElementById('up-link').value.trim();
  const description = document.getElementById('up-desc').value.trim();
  if (!file && !fileLink) return showToast('Please choose a file or add a link.');
  if (!description) return showToast('Please add a description.');
  if (file && file.size > MAX_UPLOAD_MB * 1024 * 1024) return showToast('File is larger than ' + MAX_UPLOAD_MB + 'MB — please share a Drive link instead');

  const btn = document.getElementById('up-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Uploading...';
  try {
    const body = { action: 'addDeliverable', taskId, description };
    if (file) Object.assign(body, { fileName: file.name, mimeType: file.type, fileData: await readFileBase64(file) });
    else body.fileLink = fileLink;
    const d = await api(body);
    if (d.success) {
      ['up-file', 'up-link', 'up-desc'].forEach(i => document.getElementById(i).value = '');
      renderPrevUploads(taskId);
      showToast('✅ Uploaded. When the work is complete, click "Submit for Review".');
    } else showToast(d.message || 'Error');
  } catch (e) { if (e.message !== 'auth') showToast('Upload failed — please check your connection'); }
  btn.disabled = false; btn.innerHTML = 'Upload';
}

async function submitTask(taskId) {
  const t = allTasks.find(x => x.Task_ID === taskId);
  const reason = await askReason('Submit for review', 'Note for Litpax (optional)', false);
  if (reason === null) return;
  if (await taskOp(taskId, 'submit', { reason: reason || (t && t.Status === 'Rejected' ? 'Resubmitted after rework' : 'Work completed') })) {
    showToast('✅ Submitted for review'); closeModal(); loadTasks();
  }
}

// ── MY UPLOADS ─────────────────────────────────────────
async function loadDeliverables() {
  const tbody = document.getElementById('del-tbody');
  try {
    const d = await api({ action: 'getDeliverables' });
    const mine = d.success ? d.deliverables : [];
    tbody.innerHTML = !mine.length ? emptyRow(6, 'No uploads yet') : mine.map(x => `<tr>
        <td><strong>${esc(x.Task_Title || '—')}</strong></td>
        <td>${esc(x.Description || '—')}</td>
        <td><a href="${safeUrl(x.File_Link)}" target="_blank" rel="noopener" style="color:#4a148c;font-weight:500">🔗 Open</a></td>
        <td class="small muted">${formatDate(x.Upload_Date)}</td>
        <td>${badgeHtml(x.Status)}</td>
        <td class="small">${esc(x.Owner_Remarks || '—')}</td>
      </tr>`).join('');
  } catch (e) { if (e.message !== 'auth') tbody.innerHTML = emptyRow(6, 'Could not load'); }
}

// ── REQUESTS ───────────────────────────────────────────
async function loadMyRequests() {
  const tbody = document.getElementById('req-tbody');
  try {
    const d = await api({ action: 'getAgencyRequests' });
    const mine = d.success ? d.requests : [];
    tbody.innerHTML = !mine.length ? emptyRow(6, 'No requests') : mine.map(r => `<tr>
        <td><strong>${esc(r.Title || '—')}</strong><br><small class="muted">${esc(r.Description || '')}</small></td>
        <td>${esc(r.Type || '—')}</td>
        <td>${formatDate(r.Due_Date)}</td>
        <td class="small">${esc(r.Remarks || '—')}</td>
        <td>${badgeHtml(r.Status || 'Pending')}</td>
        <td class="small muted">${formatDate(r.Created_At)}</td>
      </tr>`).join('');
  } catch (e) { if (e.message !== 'auth') tbody.innerHTML = emptyRow(6, 'Could not load'); }
}

async function submitRequest() {
  const title = document.getElementById('r-title').value.trim();
  const type = document.getElementById('r-type').value;
  const dueDate = document.getElementById('r-due').value;
  const description = document.getElementById('r-desc').value.trim();
  const remarks = document.getElementById('r-remarks').value.trim();
  if (!title || !type || !description) return showToast('Title, Type and Description are required.');
  const btn = document.getElementById('reqBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending...';
  try {
    const d = await api({ action: 'createAgencyRequest', title, type, dueDate, description, remarks });
    if (d.success) {
      showToast('✅ Request sent');
      ['r-title', 'r-type', 'r-due', 'r-desc', 'r-remarks'].forEach(i => document.getElementById(i).value = '');
      showSection('requests'); loadMyRequests();
    } else showToast(d.message || 'Error');
  } catch (e) { if (e.message !== 'auth') showToast('Network error'); }
  btn.disabled = false; btn.innerHTML = '📨 Send Request';
}
