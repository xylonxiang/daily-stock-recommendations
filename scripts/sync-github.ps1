param(
  [string]$Message = "Update daily stock recommendation project"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $ProjectRoot "config/github.config.json"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "未找到 git 命令。请先安装 Git for Windows，并确认 git 已加入 PATH。"
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "缺少 config/github.config.json。请复制 config/github.config.example.json 后填入 GitHub 用户名、Token 和仓库地址。"
}

$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

if (-not $Config.repositoryUrl) {
  throw "github.config.json 中缺少 repositoryUrl。"
}

Set-Location -LiteralPath $ProjectRoot

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
  git init
  git branch -M $Config.defaultBranch
}

$remoteExists = git remote | Select-String -SimpleMatch "origin"
if (-not $remoteExists) {
  git remote add origin $Config.repositoryUrl
}

git add .
git commit -m $Message
git push -u origin $Config.defaultBranch
