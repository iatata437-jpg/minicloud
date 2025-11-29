console.log("REGISTER.JS LOADED");

const registerForm = document.getElementById("registerForm");

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

        const body = { login: email, password: pass };

        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log("REGISTER RESPONSE:", data);

        if (!data.success) {
            alert("Ошибка: " + data.message);
            return;
        }

        alert("Аккаунт создан!");
        window.location.href = "/index.html";
    });
}
