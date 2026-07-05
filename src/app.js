const defaultStrategy = {
  name: "均衡成长策略",
  version: 1,
  liquidityWeight: 0.2,
  momentumWeight: 0.3,
  valuationWeight: 0.2,
  qualityWeight: 0.25,
  riskPenaltyWeight: 0.15
};

const fields = {
  name: document.querySelector("#strategyName"),
  liquidityWeight: document.querySelector("#liquidityWeight"),
  momentumWeight: document.querySelector("#momentumWeight"),
  valuationWeight: document.querySelector("#valuationWeight"),
  qualityWeight: document.querySelector("#qualityWeight"),
  riskPenaltyWeight: document.querySelector("#riskPenaltyWeight")
};

const runButton = document.querySelector("#runButton");
const saveStrategyButton = document.querySelector("#saveStrategyButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const recommendations = document.querySelector("#recommendations");
const historyList = document.querySelector("#history");
const runMeta = document.querySelector("#runMeta");
const strategyVersion = document.querySelector("#strategyVersion");

let stocks = [];
let strategy = loadJson("daily-stock-strategy", defaultStrategy);
let history = loadJson("daily-stock-history", []);

init();

async function init() {
  fillStrategyForm(strategy);
  renderHistory();

  try {
    const response = await fetch("data/stocks.json");
    stocks = await response.json();
  } catch (error) {
    recommendations.className = "recommendations empty-state";
    recommendations.innerHTML = "<p>无法读取股票池数据。请通过本地服务器打开项目，或检查 data/stocks.json。</p>";
  }
}

runButton.addEventListener("click", () => {
  strategy = readStrategyForm();
  const picks = recommendStocks(stocks, strategy, 10);
  const run = {
    date: new Date().toISOString(),
    strategy: { ...strategy },
    picks
  };

  history = [run, ...history].slice(0, 20);
  saveJson("daily-stock-history", history);
  renderRecommendations(picks, run.date);
  renderHistory();
});

saveStrategyButton.addEventListener("click", () => {
  strategy = {
    ...readStrategyForm(),
    version: Number(strategy.version || 1) + 1
  };
  saveJson("daily-stock-strategy", strategy);
  fillStrategyForm(strategy);
});

clearHistoryButton.addEventListener("click", () => {
  history = [];
  saveJson("daily-stock-history", history);
  renderHistory();
});

function recommendStocks(stockPool, activeStrategy, limit) {
  return stockPool
    .map((stock) => {
      const score =
        stock.liquidityScore * activeStrategy.liquidityWeight +
        stock.momentumScore * activeStrategy.momentumWeight +
        stock.valuationScore * activeStrategy.valuationWeight +
        stock.qualityScore * activeStrategy.qualityWeight -
        stock.riskScore * activeStrategy.riskPenaltyWeight;

      return {
        ...stock,
        score: Math.round(score * 100) / 100
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function fillStrategyForm(activeStrategy) {
  fields.name.value = activeStrategy.name;
  fields.liquidityWeight.value = activeStrategy.liquidityWeight;
  fields.momentumWeight.value = activeStrategy.momentumWeight;
  fields.valuationWeight.value = activeStrategy.valuationWeight;
  fields.qualityWeight.value = activeStrategy.qualityWeight;
  fields.riskPenaltyWeight.value = activeStrategy.riskPenaltyWeight;
  strategyVersion.textContent = `strategy v${activeStrategy.version || 1}`;
}

function readStrategyForm() {
  return {
    ...strategy,
    name: fields.name.value.trim() || defaultStrategy.name,
    liquidityWeight: Number(fields.liquidityWeight.value || 0),
    momentumWeight: Number(fields.momentumWeight.value || 0),
    valuationWeight: Number(fields.valuationWeight.value || 0),
    qualityWeight: Number(fields.qualityWeight.value || 0),
    riskPenaltyWeight: Number(fields.riskPenaltyWeight.value || 0)
  };
}

function renderRecommendations(picks, isoDate) {
  runMeta.textContent = `${formatDate(isoDate)}，策略：${strategy.name}`;
  recommendations.className = "recommendations";
  recommendations.innerHTML = picks
    .map(
      (stock, index) => `
        <article class="stock-card">
          <div class="stock-topline">
            <div>
              <strong>${index + 1}. ${stock.name}</strong>
              <div class="stock-code">${stock.symbol} · ${stock.market} · ${stock.industry}</div>
            </div>
            <div class="score">${stock.score}</div>
          </div>
          <div>${stock.reason}</div>
          <div class="metrics">
            <span>动量 ${stock.momentumScore}</span>
            <span>估值 ${stock.valuationScore}</span>
            <span>质量 ${stock.qualityScore}</span>
            <span>风险 ${stock.riskScore}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderHistory() {
  if (!history.length) {
    historyList.className = "history-list empty-state";
    historyList.innerHTML = "<p>暂无历史记录。</p>";
    return;
  }

  historyList.className = "history-list";
  historyList.innerHTML = history
    .map(
      (run) => `
        <div class="history-item">
          <div>
            <strong>${formatDate(run.date)}</strong>
            <div class="history-symbols">${run.picks.map((stock) => stock.symbol).join(" / ")}</div>
          </div>
          <span class="badge">v${run.strategy.version || 1}</span>
        </div>
      `
    )
    .join("");
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
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
