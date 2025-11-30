const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// ============================================================
// ==================== АДМИН НАСТРОЙКИ =======================
// ============================================================

const ADMIN_PASSWORD = "12345";   // пароль от админки
let ADMIN_TOKEN = "";             // генерируется при входе

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

// users.json
const usersFile = path.join(__dirname, "users.json");
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "{}");

let users = JSON.parse(fs.readFileSync(usersFile, "utf8"));

// Онлайн-активность
let activity = {}; // login → timestamp последнего запроса

// 👁 ГЛОБАЛЬНОЕ middleware ДОЛЖНО БЫТЬ ВВЕРХУ !
// Запоминаем активность каждого авторизованного юзера
app.use((req, res, next) => {
    const token = req.headers.authorization;
    const user = Object.keys(users).find(u => users[u].token === token);

    if (user) {
        activity[user] = Date.now();
    }

    next();
});

// Вернёт список онлайн-пользователей
function getOnlineUsers() {
    const now = Date.now();
    let online = [];

    for (let login in activity) {
        if (now - activity[login] < 5 * 60 * 1000) { // последние 5 минут
            online.push({
                login,
                time: new Date(activity[login]).toLocaleString()
            });
        }
    }

    return online;
}

// ============================================================
// ======================== REGISTER ==========================
// ============================================================

app.post("/api/register", (req, res) => {
    const { login, password } = req.body;

    if (!login || !password)
        return res.json({ success: false, message: "Введите все поля" });

    if (users[login])
        return res.json({ success: false, message: "Пользователь уже существует" });

    users[login] = {
        password,
        token: "token_" + Math.random().toString(36).slice(2)
    };

    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    res.json({ success: true, message: "Пользователь создан" });
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

    activity[login] = Date.now();

    res.json({ success: true, token: users[login].token });
});

// ============================================================
// ==================== USER FILE STORAGE ======================
// ============================================================

function getUserStorage(user) {
    const dir = path.join(__dirname, "storage", user);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function auth(req, res, next) {
    const token = req.headers.authorization;
    const user = Object.keys(users).find(u => users[u].token === token);
    if (!user) return res.status(401).json({ error: "Не авторизован" });

    req.user = user;
    activity[user] = Date.now();
    next();
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, getUserStorage(req.user)),
    filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage });

// Загрузка файла
app.post("/upload", auth, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
    res.json({ success: true });
});

// Список файлов
app.get("/files", auth, (req, res) => {
    const dir = getUserStorage(req.user);

    const list = fs.readdirSync(dir).map(name => ({
        name,
        size: fs.statSync(path.join(dir, name)).size
    }));

    res.json({ files: list });
});

// Скачать
app.get("/files/:name", auth, (req, res) => {
    const filePath = path.join(getUserStorage(req.user), req.params.name);

    if (!fs.existsSync(filePath))
        return res.status(404).json({ error: "Файл не найден" });

    res.download(filePath);
});

// Удалить
app.delete("/files/:name", auth, (req, res) => {
    const filePath = path.join(getUserStorage(req.user), req.params.name);

    if (!fs.existsSync(filePath))
        return res.status(404).json({ error: "Файл не найден" });

    fs.unlinkSync(filePath);
    res.json({ success: true });
});

// ============================================================
// ======================== ADMIN PANEL ========================
// ============================================================

// Страница админа
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Логин админа
app.post("/admin/login", (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD)
        return res.json({ success: false });

    ADMIN_TOKEN = "admin_" + Math.random().toString(36).slice(2);

    res.json({ success: true, token: ADMIN_TOKEN });
});

// Пользователи
app.get("/admin/users", adminAuth, (req, res) => {
    res.json({
        users,
        online: getOnlineUsers()
    });
});

// Файлы всех пользователей
app.get("/admin/files", adminAuth, (req, res) => {
    const root = path.join(__dirname, "storage");
    const result = {};

    const folders = fs.readdirSync(root);

    folders.forEach(user => {
        const dir = path.join(root, user);
        const files = fs.readdirSync(dir).map(f => ({
            name: f,
            size: fs.statSync(path.join(dir, f)).size
        }));
        result[user] = files;
    });

    res.json({ files: result });
});

// Скачать любой файл
app.get("/admin/download/:user/:file", adminAuth, (req, res) => {
    const { user, file } = req.params;

    const filePath = path.join(__dirname, "storage", user, file);
    if (!fs.existsSync(filePath))
        return res.status(404).json({ error: "Файл не найден" });

    res.download(filePath);
});

// Онлайн-пользователи
app.get("/admin/online", adminAuth, (req, res) => {
    res.json({ online: getOnlineUsers() });
});

// ============================================================
// ======================== START SERVER =======================
// ============================================================

app.listen(PORT, () => {
    console.log(`🔥 Сервер запущен: http://localhost:${PORT}`);
});
