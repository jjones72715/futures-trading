const BASE = "app5RPYcCy7hqCu41";
const PERF_TABLE = "tblhM1DWRiWXnhSKb";
const EVAL_TABLE = "tblWeri8TXWPQY9Dc";

const accountMap = new Map();
let loaded = false;
let scheduled = false;

function normalizeName(name) {
  return String(name || "")
    .replace(/\s*[-|:]*\s*\bLive\b\s*/gi, " ")
    .replace(/\b\d+\s*[kK]\b/g, "")
    .replace(/\b\d{2,6}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+-\s*$/g, "")
    .trim()
    .toLowerCase();
}

function displayName(name) {
  return String(name || "")
    .replace(/\s*[-|:]*\s*\bLive\b\s*/gi, " ")
    .replace(/\b\d+\s*[kK]\b/g, "")
    .replace(/\b\d{2,6}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+-\s*$/g, "")
    .trim();
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

async function fetchTable(tableId, fields) {
  const params = fields.map((field) => `fields[]=${encodeURIComponent(field)}`).join("&");
  const records = [];
  let offset = "";

  do {
    const offsetParam = offset ? `&offset=${encodeURIComponent(offset)}` : "";
    const res = await fetch(`/.netlify/functions/airtable/${BASE}/${tableId}?${params}${offsetParam}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Airtable error ${res.status}`);
    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return records;
}

async function fetchTableWithScore(tableId, fields) {
  try {
    return await fetchTable(tableId, fields);
  } catch (err) {
    if (!fields.includes("Score")) throw err;
    return fetchTable(tableId, fields.filter((field) => field !== "Score"));
  }
}

function addAccount(record, type) {
  const fields = record.fields || {};
  const name = fields.Name || "";
  const status = fields.Status?.name || fields.Status || "";
  const account = {
    name,
    displayName: displayName(name),
    status,
    type,
    count: fields["Number of Accounts"] || 1,
    score: fields.Score ?? "",
    target: fields["Daily Target"] || fields["Max Trade Size"] || 0,
  };

  accountMap.set(normalizeName(name), account);
  accountMap.set(normalizeName(account.displayName), account);
}

async function loadAccounts() {
  if (loaded) return;
  loaded = true;

  const perfFields = ["Name", "Status", "Number of Accounts", "Daily Target", "Max Trade Size", "Score"];
  const evalFields = ["Name", "Status", "Number of Accounts", "Daily Target", "Max Trade Size", "Score"];
  const [perfRecords, evalRecords] = await Promise.all([
    fetchTableWithScore(PERF_TABLE, perfFields).catch(() => []),
    fetchTableWithScore(EVAL_TABLE, evalFields).catch(() => []),
  ]);

  perfRecords.forEach((record) => addAccount(record, "perf"));
  evalRecords.forEach((record) => addAccount(record, "eval"));
}

function isAllAccountsActive() {
  const buttons = Array.from(document.querySelectorAll("button"));
  const allAccountsTab = buttons.find((button) => button.textContent.includes("All Accounts"));
  if (!allAccountsTab) return false;

  const inlineStyle = allAccountsTab.getAttribute("style") || "";
  return inlineStyle.includes("#60a5fa") || inlineStyle.includes("rgb(96, 165, 250)");
}

function makeLiveBadge() {
  const badge = document.createElement("span");
  badge.textContent = "LIVE";
  Object.assign(badge.style, {
    background: "#ff4d4f",
    color: "white",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "999px",
    marginLeft: "6px",
    verticalAlign: "middle",
    letterSpacing: "0.3px",
    lineHeight: "1.2",
    flexShrink: "0",
  });
  return badge;
}

function makeValue(label, value, color = "#fff") {
  const item = document.createElement("span");
  Object.assign(item.style, {
    color: "#aaa",
    fontSize: "10px",
    whiteSpace: "nowrap",
  });

  const strong = document.createElement("span");
  strong.textContent = value;
  Object.assign(strong.style, {
    color,
    fontWeight: "700",
  });

  item.append(label, strong);
  return item;
}

function decorateCard(card) {
  if (card.dataset.compactAllAccounts === "true") return;

  const titleRow = card.children[0];
  const metricsRow = card.children[1];
  const oldTitle = titleRow?.querySelector("span")?.textContent || "";
  const account = accountMap.get(normalizeName(oldTitle));
  if (!titleRow || !metricsRow || !account) return;

  card.dataset.compactAllAccounts = "true";
  Object.assign(card.style, {
    padding: "7px 9px",
    marginBottom: "5px",
  });

  titleRow.replaceChildren();
  Object.assign(titleRow.style, {
    display: "flex",
    alignItems: "center",
    minWidth: "0",
    marginBottom: "6px",
    gap: "0",
    fontSize: "11px",
    fontWeight: "700",
  });

  const name = document.createElement("span");
  name.textContent = account.displayName;
  Object.assign(name.style, {
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  titleRow.append(name);

  if (account.status === "Live") titleRow.append(makeLiveBadge());

  metricsRow.replaceChildren();
  Object.assign(metricsRow.style, {
    display: "grid",
    gridTemplateColumns: "auto auto minmax(70px, 1fr) auto",
    alignItems: "center",
    gap: "8px",
  });

  const count = document.createElement("span");
  count.textContent = `x${account.count}`;
  Object.assign(count.style, {
    color: "#aaa",
    fontSize: "10px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  });

  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "10";
  input.inputMode = "numeric";
  input.setAttribute("aria-label", `New score for ${account.displayName}`);
  Object.assign(input.style, {
    width: "38px",
    background: "#0f0f0f",
    border: "1px solid #333",
    borderRadius: "5px",
    padding: "2px 4px",
    color: "#fff",
    fontSize: "10px",
    outline: "none",
  });

  const inputLabel = document.createElement("label");
  Object.assign(inputLabel.style, {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: "#aaa",
    fontSize: "10px",
    whiteSpace: "nowrap",
  });
  inputLabel.append("New Score:", input);

  const score = account.score === "" || account.score === null ? "-" : account.score;
  metricsRow.append(
    count,
    makeValue("Score: ", score),
    makeValue("Target: ", money(account.target), "#ffd700"),
    inputLabel
  );
}

function applyCompactCards() {
  if (!isAllAccountsActive() || accountMap.size === 0) return;

  const cards = document.querySelectorAll(
    '#root > div > div[style*="max-width: 1400px"] div[style*="padding: 5px 8px"], ' +
    '#root > div > div[style*="max-width: 1400px"] div[data-compact-all-accounts="true"]'
  );
  cards.forEach(decorateCard);
}

function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyCompactCards();
  });
}

loadAccounts().then(scheduleApply).catch(() => {});

const observer = new MutationObserver(scheduleApply);
observer.observe(document.documentElement, { childList: true, subtree: true });
