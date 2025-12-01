// ============================================================
// =============== ИМПОРТЫ И НАСТРОЙКИ СЕРВЕРА ================
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;


// ============================================================
// ======================= SMTP НАСТРОЙКИ ======================
// ============================================================

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "iatata437@gmail.com",
        pass: "iwzp eieu mzpp avcn"
    }
});


// ============================================================
// ==================== АДМИН НАСТРОЙКИ =======================
// ============================================================

const ADMIN_PASSWORD = "12345";
let ADMIN_TOKEN = "";

function adminAuth(req, res, next) {
    const token = req.headers["x-admin-token"] || req.query.t;
    if (!token || token !== ADMIN_TOKEN) {
        return res.status(403).json({ error: "Нет доступа (admin)" });
    }
    next();
}


// ============================================================
// ===================== ИНИЦИАЛИЗАЦИЯ =========================
// ============================================================

app.use(express.json());
app.use(express.static("public"));

const usersFile = path.join(__dirname, "users.json");
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "{}");

let users = JSON.parse(fs.readFileSync(usersFile, "utf8"));


// =================== ОНЛАЙН АКТИВНОСТЬ ======================

let activity = {};

app.use((req, res, next) => {
    const token = req.headers.authorization;
    const user = Object.keys(users).find(u => users[u].token === token);
    if (user) activity[user] = Date.now();
    next();
});

function getOnlineUsers() {
    const now = Date.now();
    return Object.keys(activity)
        .filter(login => now - activity[login] < 5 * 60 * 1000)
        .map(login => ({
            login,
            time: new Date(activity[login]).toLocaleString()
        }));
}


// ============================================================
// ============= РЕГИСТРАЦИЯ + ПОДТВЕРЖДЕНИЕ EMAIL ============
// ============================================================

app.post("/api/register/sendCode", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.json({ success: false, message: "Заполните все поля" });

    if (users[email])
        return res.json({ success: false, message: "Такой пользователь уже существует" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    users[email] = {
        password,
        email,
        verified: false,
        verifyCode: code,
        token: "token_" + Math.random().toString(36).slice(2)
    };

    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    await transporter.sendMail({
        from: "MiniCloud <iatata430@gmail.com>",
        to: email,
        subject: "Код подтверждения регистрации",
        text: `Ваш код: ${code}`
    });

    res.json({ success: true });
});


app.post("/api/register/confirm", (req, res) => {
    const { email, code } = req.body;

    if (!users[email])
        return res.json({ success: false, message: "Такого пользователя нет" });

    if (users[email].verifyCode !== code)
        return res.json({ success: false, message: "Код неверный" });

    users[email].verified = true;
    delete users[email].verifyCode;

    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    res.json({ success: true });
});


// ============================================================
// =========================== LOGIN ===========================
// ============================================================

app.post("/api/login", (req, res) => {
    const { login, password } = req.body;

    if (!users[login])
        return res.json({ success: false, message: "Нет такого пользователя" });

    if (users[login].password !== password)
        return res.json({ success: false, message: "Неверный пароль" });

    if (!users[login].verified)
        return res.json({ success: false, message: "Email не подтверждён!" });

    activity[login] = Date.now();
    res.json({ success: true, token: users[login].token });
});


// ============================================================
// ===================== ФАЙЛОВОЕ ХРАНИЛИЩЕ ====================
// ============================================================

// Папка пользователя + путь
function getUserStorage(user, subPath = "") {
    const base = path.join(__dirname, "storage", user);
    const target = path.join(base, subPath);

    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

    return target;
}

// Безопасный путь (без ../)
function safePath(subPath) {
    if (!subPath) return "";
    subPath = subPath.replace(/\\/g, "/");
    if (subPath.startsWith("/")) subPath = subPath.slice(1);
    if (subPath.includes("..")) return "";
    return subPath;
}

// Авторизация
function auth(req, res, next) {
    const token = req.headers.authorization;
    const user = Object.keys(users).find(u => users[u].token === token);
    if (!user) return res.status(401).json({ error: "Не авторизован" });

    req.user = user;
    activity[user] = Date.now();
    next();
}

// Multer с подпапками
const storageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
        const sub = safePath(req.query.path || "");
        cb(null, getUserStorage(req.user, sub));
    },
    filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage: storageEngine });


// === Создать папку ===
app.post("/create-folder", auth, (req, res) => {
    const { name, path: folderPath } = req.body;

    if (!name || name.trim() === "")
        return res.json({ success: false, message: "Введите имя папки" });

    const safeFolder = safePath(folderPath || "");
    const base = getUserStorage(req.user, safeFolder);

    const newFolder = path.join(base, name);

    if (fs.existsSync(newFolder))
        return res.json({ success: false, message: "Папка уже существует" });

    fs.mkdirSync(newFolder);
    res.json({ success: true });
});


// === Загрузка файла ===
app.post("/upload", auth, upload.single("file"), (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "Файл не загружен" });

    res.json({ success: true });
});


// === Получить список ===
app.get("/files", auth, (req, res) => {
    const sub = safePath(req.query.path || "");
    const dir = getUserStorage(req.user, sub);

    const list = fs.readdirSync(dir).map(name => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);

        return {
            name,
            isFolder: stat.isDirectory(),
            size: stat.isDirectory() ? 0 : stat.size
        };
    });

    res.json({ path: sub, files: list });
});


// === Скачать файл ===
app.get("/files/:name", auth, (req, res) => {
    const sub = safePath(req.query.path || "");
    const full = path.join(getUserStorage(req.user, sub), req.params.name);

    if (!fs.existsSync(full))
        return res.status(404).json({ error: "Файл не найден" });

    res.download(full);
});


// === Удалить файл или папку ===
app.delete("/files/:name", auth, (req, res) => {
    const sub = safePath(req.query.path || "");
    const full = path.join(getUserStorage(req.user, sub), req.params.name);

    if (!fs.existsSync(full))
        return res.status(404).json({ error: "Не найдено" });

    fs.rmSync(full, { recursive: true, force: true });

    res.json({ success: true });
});


// ============================================================
// ======================== ADMIN PANEL ========================
// ============================================================

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/admin/login", (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD)
        return res.json({ success: false });

    ADMIN_TOKEN = "admin_" + Math.random().toString(36).slice(2);
    res.json({ success: true, token: ADMIN_TOKEN });
});

app.get("/admin/users", adminAuth, (req, res) => {
    res.json({ users, online: getOnlineUsers() });
});

app.get("/admin/files", adminAuth, (req, res) => {
    const root = path.join(__dirname, "storage");

    const result = {};
    if (!fs.existsSync(root)) return res.json({ files: {} });

    for (const user of fs.readdirSync(root)) {
        const dir = path.join(root, user);
        if (!fs.statSync(dir).isDirectory()) continue;

        result[user] = fs.readdirSync(dir).map(f => ({
            name: f,
            size: fs.statSync(path.join(dir, f)).size
        }));
    }

    res.json({ files: result });
});

app.get("/admin/download/:user/:file", adminAuth, (req, res) => {
    const { user, file } = req.params;
    const full = path.join(__dirname, "storage", user, file);

    if (!fs.existsSync(full))
        return res.status(404).json({ error: "Файл не найден" });

    res.download(full);
});

app.get("/admin/online", adminAuth, (req, res) => {
    res.json({ online: getOnlineUsers() });
});


// ============================================================
// ======================== START SERVER =======================
// ============================================================

app.listen(PORT, () => {
    console.log(`🔥 Сервер запущен: http://localhost:${PORT}`);
});
