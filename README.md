# Node.js 登录认证示例

这是一个用于学习认证流程的最小项目，包含：

- 用户注册与登录
- 使用 bcrypt 哈希密码
- 短期 Access Token（JWT）
- 长期 Refresh Token（随机字符串）
- Refresh Token 通过 HttpOnly Cookie 传递
- 刷新、退出登录和受保护接口
- 简单中文网页界面

## 运行

需要 Node.js 18 或更高版本。

```bash
npm install
cp .env.example .env
npm start
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env
npm start
```

打开 http://localhost:3000 。

## 认证组件

| 组件 | 职责 |
|---|---|
| `public/app.js` | 调用注册、登录、刷新和受保护接口；Access Token 只保存在页面内存中 |
| `server.js` | 验证输入、哈希密码、签发和校验令牌 |
| Access Token | JWT，有效期 15 分钟；通过 `Authorization: Bearer ...` 发送 |
| Refresh Token | 256 位随机值，有效期 7 天；存入 HttpOnly Cookie |
| 用户存储 | 演示项目使用内存 Map；重启服务后清空 |

## 请求流程

1. 注册：浏览器提交用户名和密码，服务端用 bcrypt 哈希密码后保存。
2. 登录：服务端比较密码哈希；成功后返回 Access Token，并设置 Refresh Token Cookie。
3. 访问受保护接口：浏览器把 Access Token 放入 Authorization 请求头。
4. Access Token 失效：浏览器调用 `POST /api/refresh`，Cookie 自动携带 Refresh Token，服务端轮换并返回新 Access Token。
5. 退出：服务端撤销 Refresh Token，并清除 Cookie。

## 凭据与令牌安全

- 密码不会明文保存，只保存 bcrypt 哈希。
- JWT 密钥来自环境变量，不能提交到 Git。
- Access Token 不写入 localStorage，降低令牌被持久窃取的风险。
- Refresh Token 不直接存储；服务端只保留 SHA-256 摘要。
- 每次刷新都会轮换 Refresh Token，旧令牌立即失效。
- 生产环境必须使用 HTTPS，并把 `NODE_ENV` 设置为 `production`。
- 本例数据仅在内存中，学习之外应换成数据库，并增加限流、账户锁定、邮件验证和审计日志。
