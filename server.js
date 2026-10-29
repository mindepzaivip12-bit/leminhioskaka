const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ API LOGIN ============
// TODO: thay bằng logic đăng nhập game thật
app.post('/api/login', (req, res) => {
  const { sid, username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Thiếu username/password' });
  }
  console.log(`[login] sid=${sid} user=${username}`);
  res.json({ ok: true, nickname: username, money: 0 });
});

// ============ SOCKET.IO /ws ============
const wsNsp = io.of('/ws');

wsNsp.on('connection', (socket) => {
  console.log('[ws] connected:', socket.id);

  // State ban đầu gửi cho client
  socket.emit('state', {
    logged_in: false,
    nickname: '',
    balance: 0,
    session_id: null,
    current_bet: 10000,
    bet_step: 0,
    win_count: 0,
    lose_count: 0,
    current_prediction: null,
    auto_bet_enabled: false,
    is_paused: false,
    last_pattern: '',
    history: [],
    pred_history: [],
    ai_correct: 0,
    ai_wrong: 0,
  });

  socket.on('set_bet', (data = {}) => {
    console.log('[ws] set_bet:', data.amount);
    socket.emit('log', { level: 'ok', msg: 'Đã set cược gốc: ' + (data.amount || 0) });
  });

  socket.on('toggle_auto', () => {
    console.log('[ws] toggle_auto');
    socket.emit('log', { level: 'info', msg: 'Toggle AUTO' });
  });

  socket.on('stop_bot', () => {
    console.log('[ws] stop_bot');
    socket.emit('log', { level: 'warn', msg: 'Dừng bot' });
  });

  socket.on('ping_keepalive', () => { /* keep-alive */ });

  socket.on('disconnect', () => {
    console.log('[ws] disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
