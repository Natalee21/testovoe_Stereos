import { fieldConfigs, type FieldConfig } from "./fields.config";
import { parseAmount, parseDateToIso, sliceOriginal } from "./normalize";
import { paragraphAt } from "./parse";
import type { Citation, ExtractedField, ParsedDocument } from "./types";

function captureValue(kind: FieldConfig["kind"], raw: string): number | string | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (kind === "money") {
    return parseAmount(cleaned);
  }
  if (kind === "date") {
    return parseDateToIso(cleaned);
  }
  return cleaned || null;
}

function citationFor(document: ParsedDocument, start: number, end: number): Citation | null {
  const quote = sliceOriginal(document.rawText, document.normalized, start, end).trim();
  if (!quote) {
    return null;
  }
  const rawStart = document.normalized.toRaw[start] ?? 0;
  const paragraph = paragraphAt(document.paragraphs, rawStart);
  return {
    fileName: document.fileName,
    clause: paragraph?.clause ?? null,
    quote,
    paragraphIndex: paragraph?.index ?? 0,
  };
}

function sentenceBounds(text: string, start: number, end: number): { start: number; end: number } {
  const quoteStart = text.lastIndexOf("«", start);
  const quoteEnd = text.indexOf("»", end);
  if (quoteStart >= 0 && quoteEnd > end && start - quoteStart < 220) {
    return { start: quoteStart + 1, end: quoteEnd };
  }

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = text.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  return { start: lineStart, end: lineEnd };
}

function matchField(document: ParsedDocument, config: FieldConfig): ExtractedField {
  const text = document.normalized.text;
  const found: { value: number | string; citation: Citation }[] = [];

  for (const pattern of config.patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const regex = new RegExp(pattern.source, flags);
    for (const match of text.matchAll(regex)) {
      const rawValue = match[1];
      const value = rawValue ? captureValue(config.kind, rawValue) : null;
      if (value == null || match.index == null) {
        continue;
      }
      const bounds = sentenceBounds(text, match.index, match.index + match[0].length);
      const citation = citationFor(document, bounds.start, bounds.end);
      if (!citation) {
        continue;
      }
      found.push({ value, citation });
    }
  }

  const uniqueValues = [...new Set(found.map((item) => item.value))];
  if (uniqueValues.length > 1) {
    return {
      id: config.id,
      kind: config.kind,
      value: null,
      needsReview: true,
      citations: found.map((item) => item.citation),
    };
  }

  if (uniqueValues.length === 1) {
    return {
      id: config.id,
      kind: config.kind,
      value: uniqueValues[0],
      needsReview: false,
      citations: [found[0].citation],
    };
  }

  const absent = config.absentPatterns
    ?.map((pattern) => {
      const match = text.match(pattern);
      if (!match || match.index == null) {
        return null;
      }
      return citationFor(document, match.index, match.index + match[0].length);
    })
    .find((citation): citation is Citation => citation != null);
  const relatedNotes = config.relatedPatterns?.flatMap(({ pattern, label }) => {
    const match = text.match(pattern);
    if (!match || match.index == null) return [];
    const citation = citationFor(document, match.index, match.index + match[0].length);
    return citation ? [{ label, citation }] : [];
  });

  return {
    id: config.id,
    kind: config.kind,
    value: null,
    needsReview: true,
    citations: absent ? [absent] : [],
    relatedNotes,
  };
}

export function extractFields(document: ParsedDocument): ExtractedField[] {
  return fieldConfigs.map((config) => matchField(document, config));
}
