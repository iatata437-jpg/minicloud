// =====================================================
//                АВТОРИЗАЦИЯ АДМИНИСТРАТОРА
// =====================================================

// Вход администратора → сервер выдаёт токен
async function adminLogin() {
    const password = prompt("Введите пароль администратора:");

    if (!password) return alert("Пароль не введён!");

    const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (!data.success) {
        alert("Неверный пароль!");
        return;
    }

    localStorage.setItem("adminToken", data.token);
    alert("Админ-вход выполнен!");
}

// Получение токена
function getToken() {
    return localStorage.getItem("adminToken") || "";
}



// =====================================================
//                      ПОЛЬЗОВАТЕЛИ
// =====================================================

async function loadUsers() {
    const token = getToken();
    if (!token) return adminLogin();

    const res = await fetch("/admin/users", {
        headers: { "x-admin-token": token }
    });

    const data = await res.json();

    if (data.error) {
        alert("Админ-сессия истекла, войдите заново");
        return adminLogin();
    }

    let html = `
        <h3>Пользователи (онлайн: ${data.online})</h3>
        <table>
            <tr>
                <th>Логин</th>
                <th>Пароль</th>
                <th>Токен</th>
            </tr>
    `;

    for (let user in data.users) {
        html += `
            <tr>
                <td>${user}</td>
                <td>${data.users[user].password}</td>
                <td>${data.users[user].token}</td>
            </tr>
        `;
    }

    html += "</table>";
    document.getElementById("output").innerHTML = html;
}



// =====================================================
//                        ФАЙЛЫ
// =====================================================

async function loadFiles() {
    const token = getToken();
    if (!token) return adminLogin();

    const res = await fetch("/admin/files", {
        headers: { "x-admin-token": token }
    });

    const data = await res.json();

    if (data.error) {
        alert("Админ-сессия истекла, войдите заново");
        return adminLogin();
    }

    let html = `<h3>Файлы пользователей:</h3>`;

    for (let user in data.files) {
        html += `
            <h4>${user}</h4>
            <table>
                <tr>
                    <th>Файл</th>
                    <th>Размер</th>
                    <th>Скачать</th>
                </tr>
        `;

        data.files[user].forEach(file => {
            html += `
                <tr>
                    <td>${file.name}</td>
                    <td>${(file.size / 1024 / 1024).toFixed(2)} MB</td>
                    <td>
                        <a class="btn" 
                           href="/admin/download/${user}/${file.name}?t=${token}">
                           Скачать
                        </a>
                    </td>
                </tr>
            `;
        });

        html += "</table>";
    }

    document.getElementById("output").innerHTML = html;
}





// =====================================================
//                  ONLINE USERS
// =====================================================

async function loadOnline() {
    const token = getToken();
    if (!token) return adminLogin();

    const res = await fetch("/admin/online", {
        headers: { "x-admin-token": token }
    });

    const data = await res.json();

    if (data.error) {
        alert("Сессия истекла — войдите заново");
        return adminLogin();
    }

    let html = `
        <h3>Онлайн пользователи (${data.online.length})</h3>
        <table>
            <tr>
                <th>Логин</th>
                <th>Последняя активность</th>
            </tr>
    `;

    data.online.forEach(u => {
        html += `
            <tr>
                <td>${u.login}</td>
                <td>${u.time}</td>
            </tr>
        `;
    });

    html += "</table>";
    document.getElementById("output").innerHTML = html;
}
