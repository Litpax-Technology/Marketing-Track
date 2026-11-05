// ── LOGIN PAGE ─────────────────────────────────────────
const ROLE_PAGE = { owner: 'owner.html', employee: 'employee.html', agency: 'agency.html' };
const ROLE_LABEL = { owner: 'Owner', employee: 'Employee', agency: 'Marketing Agency' };
const boxes = Array.from(document.querySelectorAll('.pin-box'));
let busy = false;

(function init() {
  const s = getSession();
  if (s && ROLE_PAGE[s.role]) { window.location.href = ROLE_PAGE[s.role]; return; }

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      box.classList.toggle('filled', !!box.value);
      clearError();
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
      if (getPin().length === 4) doLogin();          // 4 digit hote hi auto login
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].value = ''; boxes[i - 1].classList.remove('filled'); boxes[i - 1].focus();
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
      if (e.key === 'Enter') doLogin();
    });
    box.addEventListener('paste', e => {
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      if (!digits) return;
      e.preventDefault();
      boxes.forEach((b, j) => { b.value = digits[j] || ''; b.classList.toggle('filled', !!b.value); });
      (boxes[digits.length] || boxes[3]).focus();
      if (digits.length === 4) doLogin();
    });
    box.addEventListener('focus', () => box.select());
  });

  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('pinToggle').addEventListener('click', togglePin);
  setTimeout(() => boxes[0].focus(), 450);

  // Card halka sa mouse ke saath tilt (sirf desktop)
  const card = document.getElementById('lgCard');
  if (window.matchMedia('(hover: hover) and (min-width: 900px)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg');
      card.style.setProperty('--ry', (x * 6).toFixed(2) + 'deg');
      card.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  }
})();

function getPin() { return boxes.map(b => b.value).join(''); }

function togglePin() {
  const show = boxes[0].type === 'password';
  boxes.forEach(b => b.type = show ? 'text' : 'password');
  document.getElementById('pinToggle').textContent = show ? '🙈 Hide PIN' : '👁 Show PIN';
}

function clearError() {
  document.getElementById('errMsg').classList.remove('show');
  document.getElementById('pinRow').classList.remove('error');
}

function showErr(msg) {
  const err = document.getElementById('errMsg');
  const row = document.getElementById('pinRow');
  const form = document.getElementById('stateForm');
  err.textContent = msg;
  err.classList.add('show');
  row.classList.add('error');
  form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
}

function setLoading(on) {
  const btn = document.getElementById('loginBtn');
  btn.disabled = on;
  btn.classList.toggle('loading', on);
  btn.querySelector('.btn-label').textContent = on ? 'Checking…' : 'Login';
  boxes.forEach(b => b.disabled = on);
}

async function doLogin() {
  if (busy) return;
  const pin = getPin();
  if (!/^\d{4}$/.test(pin)) { showErr('Please enter all 4 digits.'); return; }
  busy = true;
  clearError();
  setLoading(true);
  try {
    const data = await api({ action: 'login', pin });
    if (data.success && ROLE_PAGE[data.role]) {
      // PIN session mein rehta hai taaki har API call server pe verify ho
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: data.name, role: data.role, userId: data.userId, pin }));
      showSuccess(data);
      return;
    }
    setLoading(false);
    showErr('Incorrect PIN. Please try again.');
    resetBoxes();
  } catch (e) {
    setLoading(false);
    showErr('Network error. Please check your connection.');
  }
  busy = false;
}

function resetBoxes() {
  setTimeout(() => {
    boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
    boxes[0].focus();
  }, 450);
}

function showSuccess(data) {
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.role === data.role));
  document.getElementById('pinRow').classList.add('ok');
  setTimeout(() => {
    document.getElementById('welcomeName').textContent = 'Welcome, ' + data.name + '!';
    document.getElementById('welcomeRole').textContent = 'Opening ' + ROLE_LABEL[data.role] + ' dashboard…';
    document.getElementById('lgCard').classList.add('success');
    document.body.classList.add('theme-' + data.role);
  }, 350);
  setTimeout(() => { window.location.href = ROLE_PAGE[data.role]; }, 1700);
}
