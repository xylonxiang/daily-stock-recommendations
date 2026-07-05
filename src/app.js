const strategies = {
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

const techButton = document.querySelector("#techButton");
const lowPriceButton = document.querySelector("#lowPriceButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const recommendations = document.querySelector("#recommendations");
const historyList = document.querySelector("#history");
const runMeta = document.querySelector("#runMeta");
const modeTitle = document.querySelector("#modeTitle");
const strategyBadge = document.querySelector("#strategyBadge");
const strategyText = document.querySelector("#strategyText");

let stocks = [];
let activeMode = loadJson("daily-stock-active-mode", "tech");
let history = loadJson("daily-stock-history", []);

init();

async function init() {
  renderHistory();

  try {
    const response = await fetch("data/stocks.json");
    stocks = await response.json();
    runRecommendation(activeMode);
  } catch (error) {
    recommendations.className = "recommendations empty-state";
    recommendations.innerHTML = "<p>无法读取 A 股股票池数据。请通过本地服务器打开项目，或检查 data/stocks.json。</p>";
  }
}

techButton.addEventListener("click", () => runRecommendation("tech"));
lowPriceButton.addEventListener("click", () => runRecommendation("lowPrice"));

clearHistoryButton.addEventListener("click", () => {
  history = [];
  saveJson("daily-stock-history", history);
  renderHistory();
});

function runRecommendation(mode) {
  activeMode = mode;
  saveJson("daily-stock-active-mode", activeMode);
  const strategy = strategies[mode];
  const picks = recommendStocks(stocks, strategy, 10);
  const run = {
    date: new Date().toISOString(),
    mode,
    title: strategy.title,
    picks
  };

  history = [run, ...history].slice(0, 20);
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
  modeTitle.textContent = strategy.title;
  runMeta.textContent = strategy.meta;
  strategyBadge.textContent = strategy.badge;
  techButton.classList.toggle("active", mode === "tech");
  lowPriceButton.classList.toggle("active", mode === "lowPrice");
  strategyText.innerHTML = strategy.description.map((item) => `<p>${item}</p>`).join("");
}

function renderRecommendations(picks, isoDate, mode) {
  if (!picks.length) {
    recommendations.className = "recommendations empty-state";
    recommendations.innerHTML = "<p>当前股票池没有满足条件的 A 股候选。请更新 data/stocks.json 后重试。</p>";
    return;
  }

  runMeta.textContent = `${formatDate(isoDate)} · ${strategies[mode].meta}`;
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
    return;
  }

  historyList.className = "history-list";
  historyList.innerHTML = history
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
