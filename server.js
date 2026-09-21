require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!ACCESS_SECRET || ACCESS_SECRET.length < 32) {
  console.error("JWT_ACCESS_SECRET must be set and contain at least 32 characters.");
  process.exit(1);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const users = new Map();
const refreshSessions = new Map();
const REFRESH_COOKIE = "refresh_token";
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validCredentials(username, password) {
  return /^[a-z0-9_]{3,24}$/.test(username)
    && typeof password === "string"
    && password.length >= 8
    && password.length <= 72;
}

function createAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: "15m", issuer: "qifan-auth-demo", audience: "qifan-web" }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueRefreshToken(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  refreshSessions.set(hashToken(token), {
    userId,
    expiresAt: Date.now() + REFRESH_MAX_AGE_MS
  });
  return token;
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: REFRESH_MAX_AGE_MS
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api"
  });
}

function publicUser(user) {
  return { id: user.id, username: user.username };
}

function requireAccessToken(req, res, next) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);

  if (!match) {
    return res.status(401).json({ error: "缺少 Access Token" });
  }

  try {
    req.auth = jwt.verify(match[1], ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: "qifan-auth-demo",
      audience: "qifan-web"
    });
    next();
  } catch {
    res.status(401).json({ error: "Access Token 无效或已过期" });
  }
}

app.post("/api/register", async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = req.body.password;

  if (!validCredentials(username, password)) {
    return res.status(400).json({
      error: "用户名须为 3–24 位字母、数字或下划线，密码须为 8–72 位"
    });
  }
  if (users.has(username)) {
    return res.status(409).json({ error: "用户名已存在" });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await bcrypt.hash(password, 12)
  };
  users.set(username, user);
  res.status(201).json({ message: "注册成功", user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = req.body.password;
  const user = users.get(username);

  if (!user || typeof password !== "string"
      || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "用户名或密码错误" });
  }

  const refreshToken = issueRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);
  res.json({
    message: "登录成功",
    accessToken: createAccessToken(user),
    expiresIn: 900,
    user: publicUser(user)
  });
});

app.post("/api/refresh", (req, res) => {
  const oldToken = req.cookies[REFRESH_COOKIE];
  if (!oldToken) {
    return res.status(401).json({ error: "缺少 Refresh Token" });
  }

  const oldHash = hashToken(oldToken);
  const session = refreshSessions.get(oldHash);
  refreshSessions.delete(oldHash);

  if (!session || session.expiresAt <= Date.now()) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Refresh Token 无效或已过期" });
  }

  const user = [...users.values()].find((item) => item.id === session.userId);
  if (!user) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "用户不存在" });
  }

  const newRefreshToken = issueRefreshToken(user.id);
  setRefreshCookie(res, newRefreshToken);
  res.json({
    accessToken: createAccessToken(user),
    expiresIn: 900,
    user: publicUser(user)
  });
});

app.post("/api/logout", (req, res) => {
  const token = req.cookies[REFRESH_COOKIE];
  if (token) refreshSessions.delete(hashToken(token));
  clearRefreshCookie(res);
  res.json({ message: "已退出登录" });
});

app.get("/api/me", requireAccessToken, (req, res) => {
  res.json({
    message: "Access Token 验证成功",
    user: { id: req.auth.sub, username: req.auth.username }
  });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "接口不存在" });
});

app.listen(PORT, () => {
  console.log(`Authentication demo: http://localhost:${PORT}`);
});
