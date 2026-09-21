let accessToken = "";
const $ = (id) => document.getElementById(id);
const result = $("result");
const tokenBox = $("token");

function credentials() {
  return { username: $("username").value, password: $("password").value };
}

function show(data) {
  result.textContent = JSON.stringify(data, null, 2);
}

function saveAccessToken(token) {
  accessToken = token || "";
  tokenBox.textContent = accessToken || "尚未登录";
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  const data = await response.json();
  show({ status: response.status, ...data });
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

$("register").onclick = async () => {
  try {
    await request("/api/register", {
      method: "POST",
      body: JSON.stringify(credentials())
    });
  } catch {}
};

$("login").onclick = async () => {
  try {
    const data = await request("/api/login", {
      method: "POST",
      body: JSON.stringify(credentials())
    });
    saveAccessToken(data.accessToken);
  } catch {}
};

$("me").onclick = async () => {
  try {
    await request("/api/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch {}
};

$("refresh").onclick = async () => {
  try {
    const data = await request("/api/refresh", { method: "POST" });
    saveAccessToken(data.accessToken);
  } catch {
    saveAccessToken("");
  }
};

$("logout").onclick = async () => {
  try {
    await request("/api/logout", { method: "POST" });
  } finally {
    saveAccessToken("");
  }
};
