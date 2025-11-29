const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// ==== middlewares ====
app.use(express.json());
app.use(express.static("public"));

// ==== ensure users.json exists ====
const usersFile = path.join(__dirname, "users.json");
if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, "{}");
}

// ==== load users ====
let users = JSON.parse(fs.readFileSync(usersFile, "utf8"));

// ==== API: REGISTER ====
app.post("/api/register", (req, res) => {
    console.log("REGISTER BODY:", req.body);

    const { login, password } = req.body;

    if (!login || !password) {
        console.log("Ошибка: пустые поля");
        return res.json({ success: false, message: "Заполните все поля" });
    }

    if (users[login]) {
        console.log("Ошибка: пользователь уже существует");
        return res.json({ success: false, message: "Пользователь уже существует" });
    }

    // создаём пользователя
    users[login] = {
        password: password,
        token: "token_" + Math.random().toString(36).slice(2)
    };

    // сохраняем
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    console.log("Пользователь создан:", login);

    return res.json({ success: true, message: "Пользователь создан" });
});


// ==== API: LOGIN ====
app.post("/api/login", (req, res) => {
    console.log("LOGIN BODY:", req.body);

    const { login, password } = req.body;

    if (!users[login]) {
        return res.json({ success: false, message: "Нет такого пользователя" });
    }

    if (users[login].password !== password) {
        return res.json({ success: false, message: "Неверный пароль" });
    }

    return res.json({
        success: true,
        token: users[login].token
    });
});


// ========= PRIVATE STORAGE SYSTEM ==========
function getUserStorage(login) {
    const dir = path.join(__dirname, "storage", login);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function auth(req, res, next) {
    const token = req.headers.authorization;
    const user = Object.keys(users).find(u => users[u].token === token);

    if (!user) return res.status(401).json({ error: "Не авторизован" });

    req.user = user;
    next();
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, getUserStorage(req.user));
    },
    filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage });

app.post("/upload", auth, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });

    res.json({ success: true, file: req.file.originalname });
});

// ========= START SERVER ==========
app.listen(PORT, () => {
    console.log(`🔥 Сервер запущен: http://localhost:${PORT}`);
});

// ==== СПИСОК ФАЙЛОВ ====
app.get("/files", auth, (req, res) => {
    const dir = getUserStorage(req.user);
    if (!fs.existsSync(dir)) {
        return res.json({ files: [] });
    }

    const list = fs.readdirSync(dir).map(name => {
        const stat = fs.statSync(path.join(dir, name));
        return {
            name,
            size: stat.size
        };
    });

    res.json({ files: list });
});


// ==== СКАЧИВАНИЕ ФАЙЛА ====
app.get("/files/:name", auth, (req, res) => {
    const filePath = path.join(getUserStorage(req.user), req.params.name);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Файл не найден" });
    }

    res.download(filePath);
});


// ==== УДАЛЕНИЕ ФАЙЛА ====
app.delete("/files/:name", auth, (req, res) => {
    const filePath = path.join(getUserStorage(req.user), req.params.name);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Файл не найден" });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true });
});

