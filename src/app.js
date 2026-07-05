const defaultUsers = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    status: "active",
    createdAt: "2026-07-05T09:00:00.000Z"
  }
];

const defaultManagedStrategies = [
  {
    id: "strategy-tech-core",
    type: "tech",
    name: "热点科技成长策略",
    weights: "热点26%、成长24%、研发18%、风险扣分18%",
    filters: "A股；科技热点赛道；isTechHotspot=true；流动性评分优先",
    riskRules: "扣除估值压力、短期涨幅过热和经营风险；风险评分越高扣分越多",
    universe: "A股科技热点池：AI算力、半导体、机器人、低空经济、AI应用",
    description: "聚焦 AI 算力、半导体、机器人、低空经济等热点科技赛道，优先选择成长和研发评分高的 A 股。",
    createdBy: "admin",
    createdAt: "2026-07-05T09:00:00.000Z"
  },
  {
    id: "strategy-low-price-core",
    type: "lowPrice",
    name: "5元内低位成长策略",
    weights: "低位30%、成长24%、质量16%、风险扣分20%",
    filters: "A股；当前价格≤5元；近三年价格区间位置≤35%；必须存在三年价格曲线",
    riskRules: "低价不等于低风险；扣除经营风险、周期波动和流动性不足风险",
    universe: "5元内低价低位池：低价、低位、具备成长或修复潜力的A股",
    description: "筛选当前价不高于 5 元，且处于近三年价格低位区间的成长修复型股票。",
    createdBy: "admin",
    createdAt: "2026-07-05T09:00:00.000Z"
  }
];

const baseStrategies = {
  tech: {
    title: "科技股推荐",
    badge: "热点科技成长",
    meta: "AI算力、半导体、机器人、低空经济等热点科技赛道",
    description: [
      "只筛选中国 A 股科技方向股票。",
      "优先选择处于当前热点科技赛道、研发投入和营收成长评分较高、流动性较好的公司。",
      "评分会扣除估值压力、短期涨幅过热和经营风险。"
    ],
    filter: (stock) => stock.market === "A股" && stock.isTechHotspot,
    score: (stock) =>
      stock.hotspotScore * 0.26 +
      stock.growthScore * 0.24 +
      stock.researchScore * 0.18 +
      stock.qualityScore * 0.14 +
      stock.liquidityScore * 0.1 +
      stock.priceLowScore * 0.08 -
      stock.riskScore * 0.18
  },
  lowPrice: {
    title: "低单价股票推荐",
    badge: "5元内低位成长",
    meta: "当前股价低于 5 元，并处于近三年历史价格低位",
    description: [
      "只筛选当前价格不高于 5 元的中国 A 股股票。",
      "必须有近三年价格曲线，并且当前价格位于三年价格区间的低位区域。",
      "在低价与低位基础上，继续按成长潜力、质量和风险进行排序。"
    ],
    filter: (stock) => stock.market === "A股" && stock.currentPrice <= 5 && stock.pricePositionPercent <= 35,
    score: (stock) =>
      stock.priceLowScore * 0.3 +
      stock.growthScore * 0.24 +
      stock.qualityScore * 0.16 +
      stock.turnaroundScore * 0.14 +
      stock.liquidityScore * 0.08 +
      stock.valuationScore * 0.08 -
      stock.riskScore * 0.2
  }
};

const authView = document.querySelector("#authView");
const appView = document.querySelector("#appView");
const adminView = document.querySelector("#adminView");

const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const loginUsername = document.querySelector("#loginUsername");
const loginPassword = document.querySelector("#loginPassword");
const registerUsername = document.querySelector("#registerUsername");
const registerPassword = document.querySelector("#registerPassword");
const authMessage = document.querySelector("#authMessage");

const techButton = document.querySelector("#techButton");
const lowPriceButton = document.querySelector("#lowPriceButton");
const consoleButton = document.querySelector("#consoleButton");
const logoutButton = document.querySelector("#logoutButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const backToAppButton = document.querySelector("#backToAppButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const recommendations = document.querySelector("#recommendations");
const historyList = document.querySelector("#history");
const historyPanel = document.querySelector("#historyPanel");
const historyPagination = document.querySelector("#historyPagination");
const historyPrevButton = document.querySelector("#historyPrevButton");
const historyNextButton = document.querySelector("#historyNextButton");
const historyPageInfo = document.querySelector("#historyPageInfo");
const runMeta = document.querySelector("#runMeta");
const modeTitle = document.querySelector("#modeTitle");
const strategyBadge = document.querySelector("#strategyBadge");
const strategyText = document.querySelector("#strategyText");
const currentUserBadge = document.querySelector("#currentUserBadge");

const usersTable = document.querySelector("#usersTable");
const userCountBadge = document.querySelector("#userCountBadge");
const strategyForm = document.querySelector("#strategyForm");
const strategyType = document.querySelector("#strategyType");
const strategyName = document.querySelector("#strategyName");
const strategyWeights = document.querySelector("#strategyWeights");
const strategyFilters = document.querySelector("#strategyFilters");
const strategyRiskRules = document.querySelector("#strategyRiskRules");
const strategyUniverse = document.querySelector("#strategyUniverse");
const strategyDescription = document.querySelector("#strategyDescription");
const strategiesTable = document.querySelector("#strategiesTable");
const strategyCountBadge = document.querySelector("#strategyCountBadge");

let stocks = [];
let activeMode = loadJson("daily-stock-active-mode", "tech");
let history = loadJson("daily-stock-history", []);
let historyPage = 1;
let users = loadJson("daily-stock-users", defaultUsers);
let managedStrategies = loadJson("daily-stock-managed-strategies", defaultManagedStrategies);
let currentUser = loadJson("daily-stock-current-user", null);

managedStrategies = normalizeManagedStrategies(managedStrategies);

init();

async function init() {
  saveJson("daily-stock-users", users);
  saveJson("daily-stock-managed-strategies", managedStrategies);
  bindEvents();

  try {
    const response = await fetch("data/stocks.json");
    stocks = await response.json();
  } catch (error) {
    recommendations.className = "recommendations empty-state";
    recommendations.innerHTML = "<p>无法读取 A 股股票池数据。请通过本地服务器打开项目，或检查 data/stocks.json。</p>";
  }

  if (currentUser) {
    showApp();
    runRecommendation(activeMode);
  } else {
    showAuth();
  }
}

function bindEvents() {
  loginTab.addEventListener("click", () => setAuthMode("login"));
  registerTab.addEventListener("click", () => setAuthMode("register"));
  loginForm.addEventListener("submit", handleLogin);
  registerForm.addEventListener("submit", handleRegister);
  techButton.addEventListener("click", () => runRecommendation("tech"));
  lowPriceButton.addEventListener("click", () => runRecommendation("lowPrice"));
  consoleButton.addEventListener("click", showAdmin);
  logoutButton.addEventListener("click", logout);
  adminLogoutButton.addEventListener("click", logout);
  backToAppButton.addEventListener("click", showApp);
  strategyForm.addEventListener("submit", handleStrategyCreate);

  clearHistoryButton.addEventListener("click", () => {
    history = [];
    historyPage = 1;
    saveJson("daily-stock-history", history);
    renderHistory();
  });
  historyPrevButton.addEventListener("click", () => {
    historyPage = Math.max(1, historyPage - 1);
    renderHistory();
  });
  historyNextButton.addEventListener("click", () => {
    historyPage = Math.min(getHistoryTotalPages(), historyPage + 1);
    renderHistory();
  });
}

function setAuthMode(mode) {
  const isLogin = mode === "login";
  loginTab.classList.toggle("active", isLogin);
  registerTab.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
  authMessage.textContent = "";
}

function handleLogin(event) {
  event.preventDefault();
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  const user = users.find((item) => item.username === username && item.password === password);

  if (!user) {
    authMessage.textContent = "用户名或密码错误。";
    return;
  }

  if (user.status !== "active") {
    authMessage.textContent = "账号已被禁用，请联系管理员。";
    return;
  }

  currentUser = publicUser(user);
  saveJson("daily-stock-current-user", currentUser);
  showApp();
  runRecommendation(activeMode);
}

function handleRegister(event) {
  event.preventDefault();
  const username = registerUsername.value.trim();
  const password = registerPassword.value;

  if (username.length < 3 || password.length < 6) {
    authMessage.textContent = "用户名至少 3 位，密码至少 6 位。";
    return;
  }

  if (users.some((user) => user.username === username)) {
    authMessage.textContent = "用户名已存在。";
    return;
  }

  const user = {
    username,
    password,
    role: "user",
    status: "active",
    createdAt: new Date().toISOString()
  };
  users = [...users, user];
  saveJson("daily-stock-users", users);
  currentUser = publicUser(user);
  saveJson("daily-stock-current-user", currentUser);
  showApp();
  runRecommendation(activeMode);
}

function logout() {
  currentUser = null;
  localStorage.removeItem("daily-stock-current-user");
  showAuth();
}

function showAuth() {
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
  adminView.classList.add("hidden");
}

function showApp() {
  if (!currentUser) {
    showAuth();
    return;
  }

  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  adminView.classList.add("hidden");
  currentUserBadge.textContent = `${currentUser.username} · ${roleText(currentUser.role)}`;
  consoleButton.disabled = currentUser.role !== "admin";
  consoleButton.title = currentUser.role === "admin" ? "进入后台管理" : "仅管理员可进入控制台";
  historyPanel.classList.toggle("hidden", currentUser.role !== "admin");
  if (currentUser.role === "admin") {
    renderHistory();
  }
}

function showAdmin() {
  if (!currentUser || currentUser.role !== "admin") {
    return;
  }

  authView.classList.add("hidden");
  appView.classList.add("hidden");
  adminView.classList.remove("hidden");
  renderUsersTable();
  renderStrategiesTable();
}

function runRecommendation(mode) {
  if (!stocks.length) {
    return;
  }

  activeMode = mode;
  saveJson("daily-stock-active-mode", activeMode);
  const strategy = baseStrategies[mode];
  const picks = recommendStocks(stocks, strategy, 10);
  const run = {
    date: new Date().toISOString(),
    mode,
    title: strategy.title,
    picks
  };

  history = [run, ...history].slice(0, 20);
  historyPage = 1;
  saveJson("daily-stock-history", history);
  renderMode(strategy, mode);
  renderRecommendations(picks, run.date, mode);
  renderHistory();
}

function recommendStocks(stockPool, strategy, limit) {
  return stockPool
    .filter(strategy.filter)
    .map((stock) => ({
      ...stock,
      score: Math.round(strategy.score(stock) * 100) / 100
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function renderMode(strategy, mode) {
  const customStrategies = managedStrategies.filter((item) => item.type === mode);
  modeTitle.textContent = strategy.title;
  runMeta.textContent = strategy.meta;
  strategyBadge.textContent = `${strategy.badge} · ${customStrategies.length}条策略`;
  techButton.classList.toggle("active", mode === "tech");
  lowPriceButton.classList.toggle("active", mode === "lowPrice");
  strategyText.innerHTML = [
    ...strategy.description,
    ...customStrategies.map((item) => `${item.name}：${item.description}`)
  ]
    .map((item) => `<p>${item}</p>`)
    .join("");
}

function renderRecommendations(picks, isoDate, mode) {
  if (!picks.length) {
    recommendations.className = "recommendations empty-state";
    recommendations.innerHTML = "<p>当前股票池没有满足条件的 A 股候选。请更新 data/stocks.json 后重试。</p>";
    return;
  }

  runMeta.textContent = `${formatDate(isoDate)} · ${baseStrategies[mode].meta}`;
  recommendations.className = "recommendations";
  recommendations.innerHTML = picks
    .map(
      (stock, index) => `
        <article class="stock-card">
          <div class="stock-topline">
            <div>
              <strong>${index + 1}. ${stock.name}</strong>
              <div class="stock-code">${stock.symbol} · ${stock.exchange} · ${stock.track}</div>
            </div>
            <div class="score">${stock.score}</div>
          </div>
          <div class="price-line">
            <span class="price">¥${stock.currentPrice.toFixed(2)}</span>
            <span>三年区间位置 ${stock.pricePositionPercent}%</span>
          </div>
          <div class="sparkline" aria-label="${stock.name} 近三年价格曲线">
            ${renderSparkline(stock.priceHistory)}
          </div>
          <p class="reason">${stock.reason}</p>
          <div class="tags">${stock.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
          <div class="metrics">
            <span>成长 ${stock.growthScore}</span>
            <span>质量 ${stock.qualityScore}</span>
            <span>低位 ${stock.priceLowScore}</span>
            <span>风险 ${stock.riskScore}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSparkline(points) {
  const width = 220;
  const height = 52;
  const padding = 4;
  const prices = points.map((point) => point.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = (width - padding * 2) / (points.length - 1 || 1);
  const d = points
    .map((point, index) => {
      const x = padding + index * step;
      const y = height - padding - ((point.close - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" focusable="false">
      <path class="spark-area" d="${d} L${width - padding} ${height - padding} L${padding} ${height - padding} Z"></path>
      <path class="spark-line" d="${d}"></path>
    </svg>
  `;
}

function renderHistory() {
  if (!history.length) {
    historyList.className = "history-list empty-state";
    historyList.innerHTML = "<p>暂无历史记录。</p>";
    historyPagination.classList.add("hidden");
    return;
  }

  const totalPages = getHistoryTotalPages();
  historyPage = Math.min(Math.max(1, historyPage), totalPages);
  const pageSize = 10;
  const startIndex = (historyPage - 1) * pageSize;
  const visibleHistory = history.slice(startIndex, startIndex + pageSize);

  historyList.className = "history-list";
  historyList.innerHTML = visibleHistory
    .map(
      (run) => `
        <div class="history-item">
          <div>
            <strong>${formatDate(run.date)} · ${run.title}</strong>
            <div class="history-symbols">${run.picks.map((stock) => stock.symbol).join(" / ")}</div>
          </div>
          <span class="badge">${run.picks.length}只</span>
        </div>
      `
    )
    .join("");

  historyPagination.classList.toggle("hidden", totalPages <= 1);
  historyPageInfo.textContent = `第 ${historyPage} / ${totalPages} 页`;
  historyPrevButton.disabled = historyPage <= 1;
  historyNextButton.disabled = historyPage >= totalPages;
}

function getHistoryTotalPages() {
  return Math.max(1, Math.ceil(history.length / 10));
}

function renderUsersTable() {
  userCountBadge.textContent = `${users.length}人`;
  usersTable.innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${user.username}</td>
          <td>${roleText(user.role)}</td>
          <td>${user.status === "active" ? "启用" : "禁用"}</td>
          <td>${formatDate(user.createdAt)}</td>
          <td>
            <button class="table-button" data-user-action="toggle-status" data-username="${user.username}" ${user.username === "admin" ? "disabled" : ""}>
              ${user.status === "active" ? "禁用" : "启用"}
            </button>
          </td>
        </tr>
      `
    )
    .join("");

  usersTable.querySelectorAll("[data-user-action='toggle-status']").forEach((button) => {
    button.addEventListener("click", () => toggleUserStatus(button.dataset.username));
  });
}

function renderStrategiesTable() {
  strategyCountBadge.textContent = `${managedStrategies.length}条`;
  strategiesTable.innerHTML = managedStrategies
    .map(
      (strategy) => `
        <tr>
          <td>${baseStrategies[strategy.type]?.title || strategy.type}</td>
          <td>${strategy.name}</td>
          <td><div class="logic-cell">${strategy.filters}</div></td>
          <td><div class="logic-cell strong">${strategy.weights}</div></td>
          <td><div class="logic-cell">${strategy.riskRules}</div></td>
          <td><div class="logic-cell">${strategy.universe}</div></td>
          <td><div class="logic-cell">${strategy.description}</div></td>
          <td>${strategy.createdBy}</td>
          <td>${formatDate(strategy.createdAt)}</td>
          <td>
            <button class="table-button danger" data-strategy-id="${strategy.id}">删除</button>
          </td>
        </tr>
      `
    )
    .join("");

  strategiesTable.querySelectorAll("[data-strategy-id]").forEach((button) => {
    button.addEventListener("click", () => deleteStrategy(button.dataset.strategyId));
  });
}

function handleStrategyCreate(event) {
  event.preventDefault();
  const strategy = {
    id: `strategy-${Date.now()}`,
    type: strategyType.value,
    name: strategyName.value.trim(),
    weights: strategyWeights.value.trim(),
    filters: strategyFilters.value.trim(),
    riskRules: strategyRiskRules.value.trim(),
    universe: strategyUniverse.value.trim(),
    description: strategyDescription.value.trim(),
    createdBy: currentUser.username,
    createdAt: new Date().toISOString()
  };

  managedStrategies = [strategy, ...managedStrategies];
  saveJson("daily-stock-managed-strategies", managedStrategies);
  strategyForm.reset();
  renderStrategiesTable();
  renderMode(baseStrategies[activeMode], activeMode);
}

function toggleUserStatus(username) {
  users = users.map((user) => {
    if (user.username !== username) {
      return user;
    }

    return {
      ...user,
      status: user.status === "active" ? "disabled" : "active"
    };
  });
  saveJson("daily-stock-users", users);
  renderUsersTable();
}

function deleteStrategy(strategyId) {
  managedStrategies = managedStrategies.filter((strategy) => strategy.id !== strategyId);
  saveJson("daily-stock-managed-strategies", managedStrategies);
  renderStrategiesTable();
  renderMode(baseStrategies[activeMode], activeMode);
}

function publicUser(user) {
  return {
    username: user.username,
    role: user.role,
    status: user.status
  };
}

function normalizeManagedStrategies(strategies) {
  return strategies.map((strategy) => {
    const fallback = defaultManagedStrategies.find((item) => item.type === strategy.type) || defaultManagedStrategies[0];

    return {
      ...strategy,
      filters: strategy.filters || fallback.filters,
      riskRules: strategy.riskRules || fallback.riskRules,
      universe: strategy.universe || fallback.universe
    };
  });
}

function roleText(role) {
  return role === "admin" ? "管理员" : "普通用户";
}

function loadJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      return fallback;
    }
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoDate));
}
