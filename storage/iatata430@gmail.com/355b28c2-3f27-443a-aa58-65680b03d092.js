const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

function switchToRegister() {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
}

function switchToLogin() {
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
}

// отправка запроса на регистрацию
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let login = document.getElementById("newLogin").value;
    let pass = document.getElementById("newPassword").value;
    let pass2 = document.getElementById("confirmPassword").value;

    if (pass !== pass2) {
        alert("Пароли не совпадают!");
        return;
    }

    const res = await fetch("/api/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ login, pass })
    });

    const data = await res.json();
    alert(data.message);
});

// отправка запроса на логин
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let login = document.getElementById("login").value;
    let password = document.getElementById("password").value;

    const res = await fetch("/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ login, password })
    });

    const data = await res.json();

    if (data.success) {
        location.href = "/";
    } else {
        alert(data.message);
    }
});
