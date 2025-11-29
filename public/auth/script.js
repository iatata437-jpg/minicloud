console.log("SCRIPT.JS LOADED");

// Форма логина ЕСТЬ только на index.html
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const login = document.getElementById("login").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!login || !password) {
            alert("Введите логин и пароль");
            return;
        }

        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login, password })
        });

        const data = await res.json();
        console.log("LOGIN RESPONSE:", data);

        if (!data.success) {
            alert(data.message);
            return;
        }

        // сохранить токен
        localStorage.setItem("token", data.token);

        // переход в панель
        window.location.href = "/panel.html";
    });
}
