import type { NormalizedText } from "./types";

const UNICODE_SPACES = new Set(["\u00A0", "\u202F", "\u2007", "\u2009"]);

export function normalizeWithMap(raw: string): NormalizedText {
  const text: string[] = [];
  const toRaw: number[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "\uFEFF" || char === "\r") {
      continue;
    }
    text.push(UNICODE_SPACES.has(char) ? " " : char);
    toRaw.push(index);
  }

  return { text: text.join(""), toRaw };
}

export function sliceOriginal(raw: string, normalized: NormalizedText, start: number, end: number): string {
  if (start >= end || start < 0 || end > normalized.toRaw.length) {
    return "";
  }
  const rawStart = normalized.toRaw[start];
  const rawEnd = normalized.toRaw[end - 1] + 1;
  return raw.slice(rawStart, rawEnd);
}

export function parseDateToIso(source: string): string | null {
  const match = source.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return iso;
}

export function parseAmount(source: string): number | null {
  const normalized = normalizeWithMap(source).text.trim();
  const match = normalized.match(/^(\d{1,3}(?: \d{3})+|\d+)$/);
  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(/ /g, ""));
  if (!Number.isSafeInteger(value)) {
    return null;
  }

  return value;
}

export function formatAmountRub(value: number): string {
  const negative = value < 0;
  const digits = Math.abs(value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negative ? "−" : ""}${grouped} ₽`;
}

export function formatIsoDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return iso;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}
