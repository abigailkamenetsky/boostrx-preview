const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'boostrx-dev-secret';
const dbPath = path.join(__dirname, 'data', 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [], participants: [], checkins: [] });

const seedUsers = [
  {
    id: 'u-admin-1',
    email: 'admin@boostrx.test',
    name: 'Dr. Chen',
    role: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 10)
  },
  {
    id: 'u-participant-1',
    email: 'linda@boostrx.test',
    name: 'Linda Parker',
    role: 'participant',
    studyId: 'BRX-1042',
    passwordHash: bcrypt.hashSync('patient123', 10)
  },
  {
    id: 'u-participant-2',
    email: 'marcos@boostrx.test',
    name: 'Marcos Ruiz',
    role: 'participant',
    studyId: 'BRX-2107',
    passwordHash: bcrypt.hashSync('patient123', 10)
  }
];

const seedParticipants = [
  {
    id: 'p-1',
    studyId: 'BRX-1042',
    name: 'Linda Parker',
    status: 'active',
    week: 3,
    day: 16,
    cohort: 'Intervention',
    lastCheckin: '2026-01-19',
    email: 'linda@boostrx.test'
  },
  {
    id: 'p-2',
    studyId: 'BRX-2107',
    name: 'Marcos Ruiz',
    status: 'active',
    week: 2,
    day: 11,
    cohort: 'Control',
    lastCheckin: '2026-01-12',
    email: 'marcos@boostrx.test'
  }
];

const seedCheckins = [
  {
    id: 'c-1',
    participantId: 'p-1',
    date: '2026-01-19',
    breakfast: 'logged',
    goalProtein: true,
    fruitServings: 2,
    drinkCups: 3,
    sideEffects: ['Fatigue'],
    mood: 3,
    weight: 150.8,
    activeMinutes: 32
  },
  {
    id: 'c-2',
    participantId: 'p-2',
    date: '2026-01-12',
    breakfast: 'not-logged',
    goalProtein: false,
    fruitServings: 1,
    drinkCups: 4,
    sideEffects: ['Nausea'],
    mood: 2,
    weight: 172.4,
    activeMinutes: 18
  }
];

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function buildToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function initDb() {
  await db.read();

  if (!db.data.users || db.data.users.length === 0) {
    db.data.users = seedUsers;
  }

  if (!db.data.participants || db.data.participants.length === 0) {
    db.data.participants = seedParticipants;
  }

  if (!db.data.checkins || db.data.checkins.length === 0) {
    db.data.checkins = seedCheckins;
  }

  await db.write();
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Boost Rx backend', time: new Date().toISOString() });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.data.users.find((entry) => entry.email.toLowerCase() === String(email).toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = bcrypt.compareSync(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = buildToken(user);

  res.json({
    token,
    user: sanitizeUser(user)
  });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.data.users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: sanitizeUser(user) });
});

app.get('/api/participants', authRequired, (req, res) => {
  if (req.user.role === 'admin') {
    return res.json({ participants: db.data.participants });
  }

  const participant = db.data.participants.find((entry) => entry.email === req.user.email || entry.studyId === req.user.studyId);

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  return res.json({ participants: [participant] });
});

app.get('/api/participants/:id', authRequired, (req, res) => {
  const participant = db.data.participants.find((entry) => entry.id === req.params.id);

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  if (req.user.role !== 'admin' && participant.email !== req.user.email) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ participant });
});

app.get('/api/participants/:id/checkins', authRequired, (req, res) => {
  const participant = db.data.participants.find((entry) => entry.id === req.params.id);

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  if (req.user.role !== 'admin' && participant.email !== req.user.email) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const checkins = db.data.checkins.filter((entry) => entry.participantId === req.params.id);

  res.json({ participant, checkins });
});

app.post('/api/participants/:id/checkin', authRequired, (req, res) => {
  const participant = db.data.participants.find((entry) => entry.id === req.params.id);

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  if (req.user.role !== 'admin' && participant.email !== req.user.email) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { date = new Date().toISOString().slice(0, 10), ...payload } = req.body || {};

  const existingIndex = db.data.checkins.findIndex((entry) => entry.participantId === req.params.id && entry.date === date);

  const newEntry = {
    id: existingIndex >= 0 ? db.data.checkins[existingIndex].id : `c-${Date.now()}`,
    participantId: req.params.id,
    date,
    ...payload
  };

  if (existingIndex >= 0) {
    db.data.checkins[existingIndex] = newEntry;
  } else {
    db.data.checkins.push(newEntry);
  }

  participant.lastCheckin = date;
  db.data.participants = db.data.participants.map((entry) => (entry.id === req.params.id ? participant : entry));
  db.write();

  res.status(201).json({ ok: true, checkin: newEntry });
});

app.get('/api/admin/summary', authRequired, adminOnly, (req, res) => {
  const summary = {
    totalParticipants: db.data.participants.length,
    activeParticipants: db.data.participants.filter((entry) => entry.status === 'active').length,
    recentCheckins: db.data.checkins.length,
    averageMood: (() => {
      const moods = db.data.checkins.map((entry) => entry.mood).filter((value) => typeof value === 'number');
      if (!moods.length) return 0;
      return (moods.reduce((sum, value) => sum + value, 0) / moods.length).toFixed(1);
    })()
  };

  res.json({ summary });
});

app.get('/api/admin/export', authRequired, adminOnly, (req, res) => {
  const sheet = db.data.participants.map((participant) => {
    const latestCheckin = db.data.checkins
      .filter((entry) => entry.participantId === participant.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

    return {
      studyId: participant.studyId,
      name: participant.name,
      status: participant.status,
      cohort: participant.cohort,
      lastCheckin: participant.lastCheckin,
      fruitServings: latestCheckin?.fruitServings ?? null,
      drinkCups: latestCheckin?.drinkCups ?? null,
      mood: latestCheckin?.mood ?? null
    };
  });

  res.json({ rows: sheet });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/screens', (req, res) => {
  res.sendFile(path.join(__dirname, 'screens.html'));
});

app.use((req, res) => {
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '/screens') {
    return res.sendFile(path.join(__dirname, req.path === '/screens' ? 'screens.html' : 'index.html'));
  }

  res.status(404).json({ error: 'Not found' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Boost Rx backend running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
