import { APP_NAME, APP_YEAR } from "./config";
import { Resvg } from "@resvg/resvg-js";

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitLongWord(word: string, maxCharsPerLine: number) {
  const parts: string[] = [];
  let rest = String(word || "");
  while (rest.length > maxCharsPerLine) {
    parts.push(rest.slice(0, maxCharsPerLine));
    rest = rest.slice(maxCharsPerLine);
  }
  if (rest) parts.push(rest);
  return parts;
}

function wrapTitle(name: string, maxCharsPerLine = 9) {
  const rawWords = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const words = rawWords.flatMap((word) =>
    word.length > maxCharsPerLine ? splitLongWord(word, maxCharsPerLine) : [word]
  );

  if (words.length === 0) return ["APP"];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function getYearLabel(year: number) {
  if (!Number.isFinite(year) || year <= 0) return "";
  return String(Math.trunc(year));
}

function renderTitleLines(name: string) {
  const lines = wrapTitle(name.toUpperCase(), 10);
  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  const lineCount = lines.length;
  const fontSizeByWidth = Math.floor(238 / (0.62 * longestLine));
  const fontSizeByHeight = Math.floor(160 / Math.max(lineCount, 1));
  const fontSize = Math.max(20, Math.min(44, fontSizeByWidth, fontSizeByHeight));
  const lineHeight = Math.round(fontSize * 1.08);
  const startY = 186 - ((lineCount - 1) * lineHeight) / 2;

  return lines
    .map((line, index) => {
      const y = Math.round(startY + index * lineHeight);
      return `<tspan x="250" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");
}

export function getAppDisplayName(name = APP_NAME, year = APP_YEAR) {
  return `${name}${year ? ` ${year}` : ""}`.trim();
}

export function renderAppIconSvg(
  name = APP_NAME,
  year = APP_YEAR,
  size = 512
) {
  const displayName = getAppDisplayName(name, year);
  const safeLabel = escapeXml(displayName);
  const safeYear = escapeXml(getYearLabel(year));
  const titleLines = renderTitleLines(name);
  const yearPlaque = safeYear
    ? `
    <g transform="translate(250 334)">
      <rect x="-72" y="-24" width="144" height="48" rx="14" fill="#efd8a8" opacity="0.95" />
      <rect x="-66" y="-18" width="132" height="36" rx="10" fill="#f6ead0" opacity="0.8" />
      <text
        x="0"
        y="11"
        text-anchor="middle"
        font-family="'Georgia', 'Times New Roman', serif"
        font-size="30"
        font-weight="700"
        letter-spacing="2"
        fill="#6a3f2f"
      >${safeYear}</text>
    </g>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" role="img" aria-label="${safeLabel} book icon">
  <title>${safeLabel}</title>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f7ecda" />
      <stop offset="100%" stop-color="#e4c899" />
    </linearGradient>
    <linearGradient id="cover" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8c5a42" />
      <stop offset="100%" stop-color="#5c3426" />
    </linearGradient>
    <linearGradient id="spine" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#6d3d2b" />
      <stop offset="100%" stop-color="#452419" />
    </linearGradient>
    <linearGradient id="pages" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffdf8" />
      <stop offset="100%" stop-color="#ebdcc2" />
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="118" fill="url(#bg)" />
  <rect x="28" y="28" width="456" height="456" rx="92" fill="none" stroke="#9f7552" stroke-width="14" />
  <ellipse cx="264" cy="430" rx="150" ry="26" fill="#6c412f" opacity="0.18" />

  <g>
    <rect x="166" y="84" width="220" height="322" rx="22" fill="url(#pages)" stroke="#d5c1a0" stroke-width="4" />
    <rect x="150" y="72" width="214" height="330" rx="26" fill="url(#cover)" stroke="#4e2a1d" stroke-width="6" />
    <rect x="126" y="72" width="44" height="330" rx="20" fill="url(#spine)" />
    <rect x="156" y="94" width="10" height="286" rx="5" fill="#a67b58" opacity="0.7" />
    <path d="M364 98 C384 118 390 150 390 232 C390 318 384 356 366 382" fill="none" stroke="#d6c3a4" stroke-width="4" opacity="0.9" />
    <path d="M370 110 C386 130 392 160 392 232 C392 304 388 340 372 370" fill="none" stroke="#f7efe1" stroke-width="3" opacity="0.8" />
    <path d="M231 70 h38 v98 l-19 -18 l-19 18 z" fill="#d9b361" stroke="#ad7f2e" stroke-width="3" />

    <rect x="186" y="116" width="128" height="10" rx="5" fill="#d9b361" opacity="0.95" />
    <rect x="196" y="136" width="108" height="4" rx="2" fill="#efd9af" opacity="0.75" />

    <text
      x="250"
      y="186"
      text-anchor="middle"
      font-family="'Georgia', 'Times New Roman', serif"
      font-size="32"
      font-weight="700"
      letter-spacing="1.5"
      fill="#f9f1de"
    >${titleLines}</text>

    ${yearPlaque}

    <path d="M148 126 q-10 18 0 36" fill="none" stroke="#b98f67" stroke-width="3" opacity="0.6" />
    <path d="M148 312 q-10 18 0 36" fill="none" stroke="#b98f67" stroke-width="3" opacity="0.6" />
  </g>
</svg>`;
}

export function renderAppIconPng(
  name = APP_NAME,
  year = APP_YEAR,
  size = 512
) {
  const svg = renderAppIconSvg(name, year, size);
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: size,
    },
  });
  return resvg.render().asPng();
}
