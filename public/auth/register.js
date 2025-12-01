console.log("REGISTER.JS LOADED");

// Поля формы
const registerForm = document.getElementById("registerForm");

// ШАГ 1 — запрос кода подтверждения
async function sendVerificationCode(email, password) {
    const res = await fetch("/api/register/sendCode", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.success) {
        alert("Ошибка: " + data.message);
        return false;
    }

    return true;
}

// ШАГ 2 — подтверждение регистрации по коду
async function confirmRegistration(email, code) {
    const res = await fetch("/api/register/confirm", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, code })
    });

    return await res.json();
}


// ==== ОБРАБОТКА ОТПРАВКИ ФОРМЫ ====
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const pass = document.getElementById("pass").value.trim();
        const pass2 = document.getElementById("pass2").value.trim();

        if (!email || !pass) {
            alert("Введите email и пароль");
            return;
        }

        if (pass !== pass2) {
            alert("Пароли не совпадают!");
            return;
        }

        // Шаг 1 — отправляем код на почту
        const sent = await sendVerificationCode(email, pass);
        if (!sent) return;

        const code = prompt("Введите код подтверждения, отправленный на email:");

        if (!code) {
            alert("Вы не ввели код!");
            return;
        }

        // Шаг 2 — подтверждаем регистрацию
        const result = await confirmRegistration(email, code);

        if (!result.success) {
            alert("Ошибка: " + result.message);
            return;
        }

        alert("Регистрация подтверждена! Теперь можете войти.");
        window.location.href = "/index.html";
    });
}
