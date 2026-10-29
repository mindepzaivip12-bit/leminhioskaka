// =========================================================
// TOOL AUTO LC79 — frontend logic
// =========================================================

const socket = io('/ws', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  pingInterval: 20000,
  pingTimeout: 60000,
  forceNew: false,
});

let SID = null;
const $ = (id) => document.getElementById(id);
const fmt = (n) => (n || 0).toLocaleString('en-US');

// Keep-alive worker
const keepAliveWorker = new Worker(URL.createObjectURL(new Blob([`
  let timer;
  self.onmessage = e => {
    if (e.data === 'start') timer = setInterval(() => self.postMessage('tick'), 15000);
    else if (e.data === 'stop') clearInterval(timer);
  };
`], { type: 'application/javascript' })));

keepAliveWorker.onmessage = () => {
  if (socket.connected) socket.emit('ping_keepalive', { ts: Date.now() });
  else socket.connect();
};
keepAliveWorker.postMessage('start');

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !socket.connected) socket.connect();
});
setInterval(() => { if (!socket.connected) socket.connect(); }, 5000);

function appendLog(level, msg) {
  const el = $('log');
  const t = new Date().toLocaleTimeString('vi-VN');
  const d = document.createElement('div');
  d.className = 'entry ' + (level || 'info');
  d.innerHTML = `<span class="t">${t}</span>${String(msg).replace(/</g, '&lt;')}`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 400) el.removeChild(el.firstChild);
}

function renderPredHistory(s) {
  const hist = s.pred_history || [];
  const correct = s.ai_correct || 0;
  const wrong = s.ai_wrong || 0;
  const total = correct + wrong;

  $('phTotal').textContent = total;
  $('phCorrect').textContent = correct;
  $('phWrong').textContent = wrong;
  $('phRate').textContent = total ? ((correct / total) * 100).toFixed(1) + '%' : '—';

  const tbody = $('predHistoryBody');
  if (!hist.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Chưa có dự đoán nào</td></tr>';
    return;
  }

  tbody.innerHTML = hist.slice().reverse().map((item) => {
    const predClass = item.pred === 'TAI' ? 'pred-tai' : 'pred-xiu';
    const actualClass = item.actual === 'TAI' ? 'pred-tai' : 'pred-xiu';
    const badgeClass = item.correct ? 'ok-badge' : 'err-badge';
    const badgeTxt = item.correct ? '✓ ĐÚNG' : '✗ SAI';
    const diceHtml = (item.dices && item.dices.length === 3)
      ? `<span class="dice-mini"><span>${item.dices[0]}</span><span>${item.dices[1]}</span><span>${item.dices[2]}</span></span>`
      : '—';
    return `<tr>
      <td class="session-id">#${item.session || '?'}</td>
      <td class="${predClass}">${item.pred}</td>
      <td class="${actualClass}">${item.actual}</td>
      <td>${diceHtml}</td>
      <td class="${badgeClass}">${badgeTxt}</td>
    </tr>`;
  }).join('');
}

function renderState(s) {
  if (!s) return;

  if (s.logged_in) {
    $('loginCard').classList.add('hidden');
    $('dashCard').classList.remove('hidden');
  }

  $('sNick').textContent = s.nickname || '—';
  $('sBalance').textContent = fmt(s.balance);
  $('bigSession').textContent = s.session_id ? '#' + s.session_id : '—';
  $('sBet').textContent = fmt(s.current_bet);
  $('sStep').textContent = s.bet_step === 0 ? 'GỐC' : 'X2 GỠ';
  $('sWL').textContent = `${s.win_count || 0} / ${s.lose_count || 0}`;
  $('sPattern').textContent = s.last_pattern || '—';

  const bp = $('bigPred');
  if (s.current_prediction === 'TAI') { bp.textContent = 'TÀI'; bp.className = 'val tai'; }
  else if (s.current_prediction === 'XIU') { bp.textContent = 'XỈU'; bp.className = 'val xiu'; }
  else { bp.textContent = '—'; bp.className = 'val idle'; }

  let stTxt = 'Idle';
  if (s.is_paused) stTxt = 'TẠM DỪNG';
  else if (s.auto_bet_enabled) stTxt = 'Đang chạy';
  $('sStatus').textContent = stTxt;

  $('pillAuto').className = 'pill ' + (s.auto_bet_enabled ? 'on' : 'off');
  $('txtAuto').textContent = 'AUTO · ' + (s.auto_bet_enabled ? 'ON' : 'OFF');
  $('btnToggleAuto').innerHTML = s.auto_bet_enabled
    ? '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> TẮT AUTO'
    : '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> BẬT AUTO';

  const pc = $('pillConn');
  if (s.is_paused) { pc.className = 'pill pause'; $('txtConn').textContent = 'Tạm dừng'; }
  else if (s.logged_in) { pc.className = 'pill on'; $('txtConn').textContent = 'Online'; }
  else { pc.className = 'pill off'; $('txtConn').textContent = 'Offline'; }

  const hl = $('cauList');
  if (s.history && s.history.length) {
    hl.innerHTML = s.history.slice(-40).reverse()
      .map((h) => `<span class="die ${h === 'TAI' ? 'tai' : 'xiu'}">${h === 'TAI' ? 'T' : 'X'}</span>`)
      .join('');
  }

  renderPredHistory(s);
}

socket.on('connect', () => {
  SID = socket.id;
  appendLog('ok', 'Web socket kết nối: ' + SID);
});
socket.on('disconnect', () => appendLog('warn', 'Web socket mất kết nối — đang thử lại...'));
socket.on('reconnect', () => appendLog('ok', 'Web socket đã kết nối lại'));
socket.on('connect_error', (err) => appendLog('err', 'Lỗi kết nối: ' + (err && err.message ? err.message : err)));
socket.on('state', renderState);
socket.on('log', (d) => appendLog(d.level, d.msg));

$('btnLogin').onclick = async () => {
  const u = $('username').value.trim();
  const p = $('password').value.trim();
  const msg = $('loginMsg');
  if (!u || !p) { msg.textContent = 'Nhập đủ tài khoản + mật khẩu'; msg.className = 'msg err'; return; }
  msg.textContent = 'Đang đăng nhập...'; msg.className = 'msg';
  const btn = $('btnLogin'); btn.disabled = true;
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid: SID, username: u, password: p }),
    });
    const j = await r.json();
    if (j.ok) { msg.textContent = `OK — ${j.nickname} — ${fmt(j.money)}`; msg.className = 'msg ok'; }
    else { msg.textContent = j.error; msg.className = 'msg err'; }
  } catch (e) {
    msg.textContent = e.message; msg.className = 'msg err';
  }
  btn.disabled = false;
};

$('btnSetBet').onclick = () => {
  const amt = parseInt($('betAmount').value);
  if (!amt || amt < 1000) { appendLog('err', 'Tối thiểu 1.000'); return; }
  socket.emit('set_bet', { amount: amt });
  appendLog('ok', 'Đã set cược gốc: ' + fmt(amt));
};

$('btnToggleAuto').onclick = () => socket.emit('toggle_auto');
$('btnStop').onclick = () => socket.emit('stop_bot');

$('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('btnLogin').click();
});

window.addEventListener('load', () => appendLog('info', 'Sẵn sàng — nhập tài khoản để bắt đầu'));
