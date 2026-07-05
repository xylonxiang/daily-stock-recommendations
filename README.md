# 每日股票推荐系统

这是一个零依赖静态 Web 项目，用于按不断迭代的 A 股选股策略，每日从中国 A 股候选股票池中推荐 10 只股票。

## 使用方式

1. 在 cmd 中运行 `scripts\serve.cmd`，或在 PowerShell 中运行 `powershell -ExecutionPolicy Bypass -File scripts/serve.ps1`。
2. 打开 `http://localhost:4173/`。
3. 点击“科技股推荐”查看 A 股热点科技赛道候选。
4. 点击“低单价股票推荐”查看 5 元以内且处于近三年价格低位的候选。

## 当前策略

- 科技股推荐：聚焦 AI 算力、半导体、机器人、低空经济、AI 应用等热点科技赛道，综合热点、成长、研发、质量、流动性和风险评分。
- 低单价股票推荐：只筛选当前价格不高于 5 元、近三年价格区间位置不高于 35% 的股票，并展示近三年价格曲线。

## 账号与后台

- 普通用户需要注册后登录才能查看推荐页面。
- 默认管理员账号：`admin`，默认密码：`admin123`。
- 管理员登录后点击“控制台”，可管理用户状态，并维护不同选股类型的策略表格。
- 策略表格会展示选股类型、筛选条件、评分权重、风控约束、适用股票池和策略说明。

## 每天 17 点数据更新

手动执行一次数据更新：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/update-data.ps1
```

注册 Windows 每日 17:00 定时任务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-daily-update.ps1
```

定时任务会更新 `data/stocks.json` 中的价格、三年价格区间位置和低位评分，并把最近更新记录写入 `data/update-log.json`。

## 后续迭代方向

- 把 `data/stocks.json` 替换为每日自动更新的 A 股行情、财务和风险数据。
- 在 `src/app.js` 中扩展评分函数，例如加入均线、盈利预期、行业轮动、最大回撤和三年价格分位过滤。
- 增加后端任务，在每天固定时间生成并保存推荐结果。
- 增加用户登录、策略版本管理和推荐结果回测。

## GitHub 同步配置

复制配置模板：

```powershell
Copy-Item config/github.config.example.json config/github.config.json
```

填写 `config/github.config.json`：

```json
{
  "githubUsername": "your-github-username",
  "githubToken": "ghp_xxx_or_fine_grained_token",
  "repositoryUrl": "https://github.com/your-github-username/daily-stock-recommendations.git",
  "defaultBranch": "main"
}
```

建议使用 GitHub Personal Access Token，不要使用 GitHub 登录密码。真实配置文件 `config/github.config.json` 已加入 `.gitignore`，不会随项目提交。

同步到 GitHub：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-github.ps1 -Message "Initial project"
```

如果仓库是私有仓库，首次 push 时 Git 会要求认证。用户名填 GitHub 用户名，密码位置填 Personal Access Token。

## 风险提示

本项目当前包含的是策略系统样例和模拟数据，不构成投资建议。接入真实行情数据后，仍应加入回测、风控和人工复核流程。
