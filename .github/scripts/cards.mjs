import { mkdirSync, writeFileSync } from "node:fs";

const USER = "idalinosou";
const OUT_DIR = "profile";
const API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN || "";

const BG = "#06131d";
const CARD_STROKE = "#16303f";
const TEXT = "#f1f8fc";
const MUTED = "#8aa3b4";
const SOFT = "#cfe2ee";
const ACCENT = "#2fb3f2";
const TRACK = "#10293a";
const FONT = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-cards",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} em ${url}`);
  return res.json();
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statsCard({ repos, demos, followers, languages }) {
  const cells = [
    { value: repos, label: "REPOSITÓRIOS" },
    { value: demos, label: "DEMOS NO AR" },
    { value: followers, label: "SEGUIDORES" },
    { value: languages, label: "LINGUAGENS" },
  ];

  const body = cells
    .map((cell, index) => {
      const x = index % 2 === 0 ? 26 : 222;
      const y = index < 2 ? 92 : 158;
      return `
    <text x="${x}" y="${y}" font-family="${FONT}" font-size="34" font-weight="700" fill="${TEXT}">${cell.value}</text>
    <text x="${x}" y="${y + 20}" font-family="${FONT}" font-size="11.5" letter-spacing="1.2" fill="${MUTED}">${cell.label}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="190" viewBox="0 0 420 190" role="img" aria-label="GitHub em números: ${repos} repositórios, ${demos} demos no ar, ${followers} seguidores, ${languages} linguagens">
  <rect width="420" height="190" rx="18" fill="${BG}" stroke="${CARD_STROKE}" stroke-width="1"/>
  <text x="26" y="34" font-family="${FONT}" font-size="11.5" letter-spacing="2" fill="${MUTED}">GITHUB EM NÚMEROS</text>${body}
</svg>
`;
}

function languagesCard(list) {
  const rows = list.slice(0, 5);
  const step = rows.length <= 4 ? 30 : 25;
  const barX = 150;
  const barW = 200;

  const body = rows
    .map((item, index) => {
      const y = 80 + index * step;
      const width = Math.max(3, Math.round((item.percent / 100) * barW));
      return `
    <text x="26" y="${y + 4}" font-family="${FONT}" font-size="13" fill="${SOFT}">${esc(item.name)}</text>
    <rect x="${barX}" y="${y - 5}" width="${barW}" height="9" rx="4.5" fill="${TRACK}"/>
    <rect x="${barX}" y="${y - 5}" width="${width}" height="9" rx="4.5" fill="${ACCENT}"/>
    <text x="400" y="${y + 4}" text-anchor="end" font-family="${FONT}" font-size="12" fill="${MUTED}">${item.percent.toFixed(0)}%</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="190" viewBox="0 0 420 190" role="img" aria-label="Linguagens mais usadas: ${rows.map((r) => `${r.name} ${r.percent.toFixed(0)}%`).join(", ")}">
  <rect width="420" height="190" rx="18" fill="${BG}" stroke="${CARD_STROKE}" stroke-width="1"/>
  <text x="26" y="34" font-family="${FONT}" font-size="11.5" letter-spacing="2" fill="${MUTED}">LINGUAGENS MAIS USADAS</text>${body}
</svg>
`;
}

async function collect() {
  const user = await api(`${API}/users/${USER}`);
  const repos = await api(`${API}/users/${USER}/repos?per_page=100&type=owner`);
  const own = repos.filter((repo) => !repo.fork);

  const totals = new Map();
  for (const repo of own) {
    if (!repo.languages_url) continue;
    const langs = await api(repo.languages_url);
    for (const [name, bytes] of Object.entries(langs)) {
      totals.set(name, (totals.get(name) || 0) + bytes);
    }
  }

  const sum = [...totals.values()].reduce((acc, value) => acc + value, 0) || 1;
  const ranked = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({ name, percent: (bytes / sum) * 100 }))
    .filter((item) => item.percent >= 1);

  return {
    repos: own.length,
    demos: own.filter((repo) => repo.has_pages).length,
    followers: user.followers,
    languages: totals.size,
    ranked,
  };
}

async function main() {
  const data = await collect();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/stats.svg`, statsCard(data));
  writeFileSync(`${OUT_DIR}/top-langs.svg`, languagesCard(data.ranked));
  console.log(`cards atualizados: ${data.repos} repositórios, ${data.languages} linguagens`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
