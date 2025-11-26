const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public')); // Раздача веб-морды

// ---- БАЗА ПОЛЬЗОВАТЕЛЕЙ ----
const users = [
  { login: "admin", password: "12345", token: "supersecret-token" }
];

// ---- АУТЕНТИФИКАЦИЯ ----
app.post('/login', (req, res) => {
  const { login, password } = req.body;

  const user = users.find(u => u.login === login && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  res.json({ token: user.token });
});

// ---- MIDDLEWARE: ПРОВЕРКА ТОКЕНА ----
function auth(req, res, next) {
  const token = req.headers.authorization || req.query.token;

  const user = users.find(u => u.token === token);

  if (!user) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  req.user = user; // сохраняем пользователя
  next();
}

// ---- НАСТРОЙКА ХРАНИЛИЩА ----
function getUserStorage(login) {
  const dir = path.join(__dirname, 'storage', login);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

function getUserUsedSpace(login) {
  const dir = getUserStorage(login);
  const files = fs.readdirSync(dir);

  let total = 0;
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    total += stat.size;
  }

  return total; // в байтах
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getUserStorage(req.user.login);
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({ storage });

// ---- ПРОВЕРКА СЕРВЕРА ----
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'mini-cloud is alive' });
});

const MAX_SPACE = 15 * 1024 * 1024 * 1024; // 15 ГБ

app.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

  const used = getUserUsedSpace(req.user.login);

  if (used + req.file.size > MAX_SPACE) {
    // удаляем загруженный файл (multer уже сохранил)
    fs.unlinkSync(req.file.path);

    return res.status(400).json({
      error: 'Превышен лимит хранилища 15 ГБ'
    });
  }

  res.json({
    message: 'Файл загружен',
    fileName: req.file.originalname,
    size: req.file.size
  });
});



// ---- ЗАГРУЗКА ФАЙЛОВ ----
app.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

  res.json({
    message: 'Файл загружен',
    fileName: req.file.originalname,
    size: req.file.size
  });
});

// ---- СПИСОК ФАЙЛОВ ----
app.get('/files', auth, (req, res) => {
  const dir = getUserStorage(req.user.login);

  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Ошибка чтения папки' });

    res.json({ files });
  });
});

// ---- СКАЧИВАНИЕ ФАЙЛОВ ----
app.delete('/files/:name', auth, (req, res) => {
  const dir = getUserStorage(req.user.login);
  const filePath = path.join(dir, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Файл не найден" });
  }

  fs.unlinkSync(filePath);
  res.json({ message: "Файл удалён" });
});

async function deleteFile(name) {
  if (!confirm(`Удалить файл "${name}"?`)) return;

  await fetch('/files/' + name, {
    method: 'DELETE',
    headers: { 'Authorization': token }
  });

  loadFiles();
}


// ---- СТАРТ СЕРВЕРА ----
app.listen(PORT, () =>
  console.log(`Mini-cloud started → http://localhost:${PORT}`)
);
