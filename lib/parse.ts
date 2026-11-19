import { normalizeWithMap, parseDateToIso } from "./normalize";
import type { DocumentKind, Paragraph, ParsedDocument } from "./types";

const CONTRACT_NUMBER = /([A-Z]{2,}-\d+)/;

function detectKind(text: string): DocumentKind {
  const title = text.slice(0, 240);
  if (/ПРОЕКТ ДОПОЛНИТЕЛЬНОГО СОГЛАШЕНИЯ/.test(title)) {
    return "amendment_draft";
  }
  if (/ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ/.test(title)) {
    return "amendment";
  }
  if (/ПИСЬМО/.test(title)) {
    return "letter";
  }
  if (/ДОГОВОР ПОСТАВКИ/.test(title)) {
    return "contract";
  }
  return "unknown";
}

function contractNumber(text: string, kind: DocumentKind): string | null {
  if (kind === "contract") {
    const match = text.match(/ДОГОВОР ПОСТАВКИ\s*№\s*([A-Z]{2,}-\d+)/);
    return match?.[1] ?? null;
  }

  const linked = text.match(/К ДОГОВОРУ\s+([A-Z]{2,}-\d+)/);
  if (linked) {
    return linked[1];
  }

  const mentioned = text.match(/договор[уа]?\s+([A-Z]{2,}-\d+)/i);
  return mentioned?.[1] ?? null;
}

function amendmentNumber(text: string, kind: DocumentKind): string | null {
  if (kind !== "amendment" && kind !== "amendment_draft") {
    return null;
  }
  const match = text.match(/СОГЛАШЕНИ(?:Я|Е)\s*№\s*(\d+)/);
  return match?.[1] ?? null;
}

function signedByBothParties(text: string): boolean {
  if (/не подписан/i.test(text)) {
    return false;
  }
  return /подписан[оа]? обеими сторонами/i.test(text);
}

function documentDate(text: string): string | null {
  const match = text.match(/(?:^|\n)Дата:\s*(\d{2}\.\d{2}\.\d{4})/);
  return match ? parseDateToIso(match[1]) : null;
}

function effectiveDate(text: string, kind: DocumentKind, signed: boolean, dated: string | null): string | null {
  const explicit = text.match(/вступает в силу\s+(\d{2}\.\d{2}\.\d{4})/);
  if (explicit) {
    return parseDateToIso(explicit[1]);
  }
  if (kind === "contract" && signed) {
    return dated;
  }
  return null;
}

function paragraphsOf(raw: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const chunks = raw.split(/\n\s*\n/);
  let searchFrom = 0;

  for (const chunk of chunks) {
    const start = raw.indexOf(chunk, searchFrom);
    if (start < 0) {
      continue;
    }
    searchFrom = start + chunk.length;
    const text = chunk.trim();
    if (!text) {
      continue;
    }
    const clauseMatch = text.match(/^(\d+(?:\.\d+)*)\.\s/);
    paragraphs.push({
      index: paragraphs.length,
      clause: clauseMatch?.[1] ?? null,
      text,
      start,
      end: start + chunk.length,
    });
  }

  return paragraphs;
}

export function parseDocument(fileName: string, rawText: string): ParsedDocument {
  const normalized = normalizeWithMap(rawText);
  const text = normalized.text;
  const kind = detectKind(text);
  const signed = signedByBothParties(text);
  const dated = documentDate(text);

  return {
    fileName,
    rawText,
    normalized,
    kind,
    contractNumber: contractNumber(text, kind),
    amendmentNumber: amendmentNumber(text, kind),
    signedByBothParties: signed,
    documentDate: dated,
    effectiveDate: effectiveDate(text, kind, signed, dated),
    paragraphs: paragraphsOf(rawText),
  };
}

export function paragraphAt(paragraphs: Paragraph[], rawIndex: number): Paragraph | null {
  return paragraphs.find((paragraph) => rawIndex >= paragraph.start && rawIndex < paragraph.end) ?? null;
}

export { CONTRACT_NUMBER };
