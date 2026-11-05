// ── LOGIN PAGE ─────────────────────────────────────────
const ROLE_PAGE = { owner: 'owner.html', employee: 'employee.html', agency: 'agency.html' };

(function init() {
  const s = getSession();
  if (s && ROLE_PAGE[s.role]) { window.location.href = ROLE_PAGE[s.role]; return; }
  document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('pinInput').focus();
})();

function showErr(msg) {
  const err = document.getElementById('errMsg');
  err.style.display = 'block'; err.textContent = msg;
}

async function doLogin() {
  const pin = document.getElementById('pinInput').value.trim();
  const btn = document.getElementById('loginBtn');
  if (!/^\d{4}$/.test(pin)) return showErr('4-digit PIN daalo.');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Checking...';
  document.getElementById('errMsg').style.display = 'none';
  try {
    const data = await api({ action: 'login', pin });
    if (data.success && ROLE_PAGE[data.role]) {
      // PIN session mein rehta hai taaki har API call server pe verify ho
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: data.name, role: data.role, userId: data.userId, pin }));
      window.location.href = ROLE_PAGE[data.role];
      return;
    }
    showErr('Invalid PIN. Dobara try karo.');
  } catch (e) {
    showErr('Network error. Internet check karo.');
  }
  btn.disabled = false; btn.innerHTML = 'Login';
}
