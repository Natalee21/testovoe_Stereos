import { fieldConfigs } from "./fields.config";
import { extractFields } from "./extract";
import { parseDocument } from "./parse";
import type {
  Analysis,
  ContractStatus,
  ExtractedField,
  FieldSource,
  LoadedFile,
  ParsedDocument,
  ResolvedContract,
  ResolvedField,
  SideDocument,
} from "./types";

function sameValue(left: number | string | null, right: number | string | null): boolean {
  return left === right;
}

function sourceOf(document: ParsedDocument, field: ExtractedField): FieldSource | null {
  const citation = field.citations[0];
  if (!citation) {
    return null;
  }
  return {
    ...citation,
    amendmentNumber: document.amendmentNumber,
    documentKind: document.kind,
  };
}

function emptyField(config: (typeof fieldConfigs)[number]): ResolvedField {
  return {
    id: config.id,
    kind: config.kind,
    value: null,
    needsReview: true,
    citation: null,
    relatedNotes: [],
    previous: null,
    extraCitations: [],
  };
}

function fieldFromExtraction(document: ParsedDocument, field: ExtractedField): ResolvedField {
  return {
    id: field.id,
    kind: field.kind,
    value: field.value,
    needsReview: field.needsReview || field.value == null,
    citation: sourceOf(document, field),
    relatedNotes: (field.relatedNotes ?? []).map(({ label, citation }) => ({
      label,
      citation: { ...citation, amendmentNumber: document.amendmentNumber, documentKind: document.kind },
    })),
    previous: null,
    extraCitations: field.citations.slice(1).map((citation) => ({
      ...citation,
      amendmentNumber: document.amendmentNumber,
      documentKind: document.kind,
    })),
  };
}

function canChangeTerms(document: ParsedDocument): boolean {
  return document.kind === "amendment" && document.signedByBothParties && document.effectiveDate != null;
}

function changedFields(document: ParsedDocument, current: Map<string, ResolvedField>): ExtractedField[] {
  return extractFields(document).filter((field) => {
    if (field.value == null) {
      return false;
    }
    const existing = current.get(field.id);
    return !sameValue(existing?.value ?? null, field.value);
  });
}

function sideDocument(
  document: ParsedDocument,
  fields: ExtractedField[],
  label: SideDocument["label"],
): SideDocument {
  return {
    fileName: document.fileName,
    documentKind: document.kind,
    amendmentNumber: document.amendmentNumber,
    effectiveDate: document.effectiveDate,
    label,
    fields,
  };
}

function applyField(current: ResolvedField, document: ParsedDocument, field: ExtractedField): void {
  const nextSource = sourceOf(document, field);
  if (current.value != null && current.citation) {
    current.previous = { value: current.value, citation: current.citation };
  }
  current.value = field.value;
  current.citation = nextSource;
  current.relatedNotes = (field.relatedNotes ?? []).map(({ label, citation }) => ({
    label,
    citation: { ...citation, amendmentNumber: document.amendmentNumber, documentKind: document.kind },
  }));
  current.needsReview = false;
  current.extraCitations = [];
}

function markConflict(current: ResolvedField, documents: ParsedDocument[]): void {
  current.needsReview = true;
  current.value = null;
  current.previous = null;
  current.relatedNotes = [];
  current.extraCitations = documents.flatMap((document) => {
    const field = extractFields(document).find((item) => item.id === current.id);
    if (!field) {
      return [];
    }
    return field.citations.map((citation) => ({
      ...citation,
      amendmentNumber: document.amendmentNumber,
      documentKind: document.kind,
    }));
  });
}

function statusOf(fields: ResolvedField[], appliedNumbers: string[]): ContractStatus {
  if (fields.some((field) => field.needsReview)) {
    return "требует проверки";
  }
  if (appliedNumbers.length > 0) {
    return `изменён ДС №${appliedNumbers.join(", №")}`;
  }
  return "действует";
}

function resolveContract(contractNumber: string, documents: ParsedDocument[], checkDate: string): ResolvedContract {
  const contracts = documents.filter((document) => document.kind === "contract");
  const base = contracts[0];
  const fields = new Map<string, ResolvedField>();

  for (const config of fieldConfigs) {
    const extracted = base ? extractFields(base).find((field) => field.id === config.id) : undefined;
    fields.set(config.id, extracted && base ? fieldFromExtraction(base, extracted) : emptyField(config));
  }

  if (contracts.length > 1) {
    for (const field of fields.values()) {
      field.needsReview = true;
    }
  }

  const applicable = documents
    .filter((document) => canChangeTerms(document) && document.effectiveDate != null && document.effectiveDate <= checkDate)
    .sort((left, right) => (left.effectiveDate ?? "").localeCompare(right.effectiveDate ?? ""));

  const scheduled = documents.filter(
    (document) => canChangeTerms(document) && document.effectiveDate != null && document.effectiveDate > checkDate,
  );

  const proposed = documents.filter((document) => {
    if (document.kind === "letter" || document.kind === "amendment_draft") {
      return true;
    }
    return document.kind === "amendment" && !document.signedByBothParties;
  });

  const appliedNumbers: string[] = [];
  const dates = [...new Set(applicable.map((document) => document.effectiveDate ?? ""))];

  for (const date of dates) {
    const group = applicable.filter((document) => document.effectiveDate === date);
    const touched = new Set<string>();
    for (const document of group) {
      for (const field of changedFields(document, fields)) {
        touched.add(field.id);
      }
    }

    for (const fieldId of touched) {
      const current = fields.get(fieldId);
      if (!current) {
        continue;
      }
      const writers = group.filter((document) => changedFields(document, fields).some((field) => field.id === fieldId));
      const values = writers.map((document) => changedFields(document, fields).find((field) => field.id === fieldId)?.value);
      const distinct = [...new Set(values)];
      if (fieldId === "supplier") {
        current.needsReview = true;
        current.extraCitations = writers.flatMap((document) => {
          const field = changedFields(document, fields).find((item) => item.id === fieldId);
          const extra = field ? sourceOf(document, field) : null;
          return extra ? [extra] : [];
        });
        continue;
      }
      if (distinct.length > 1) {
        markConflict(current, writers);
        continue;
      }
      const writer = writers[0];
      const next = writer ? changedFields(writer, fields).find((field) => field.id === fieldId) : undefined;
      if (!writer || !next) {
        continue;
      }
      applyField(current, writer, next);
      if (writer.amendmentNumber && !appliedNumbers.includes(writer.amendmentNumber)) {
        appliedNumbers.push(writer.amendmentNumber);
      }
    }
  }

  const proposedDocs = proposed
    .map((document) => sideDocument(document, changedFields(document, fields), "не согласовано"))
    .filter((document) => document.fields.length > 0);

  const scheduledDocs = scheduled
    .map((document) => sideDocument(document, changedFields(document, fields), "вступит в силу позже"))
    .filter((document) => document.fields.length > 0);

  return {
    contractNumber,
    status: statusOf([...fields.values()], appliedNumbers),
    hasUnagreedChange: proposedDocs.length > 0,
    fields: fieldConfigs.map((config) => fields.get(config.id) ?? emptyField(config)),
    proposed: proposedDocs,
    scheduled: scheduledDocs,
  };
}

export function analyze(files: LoadedFile[], checkDate: string): Analysis {
  const parsed = files.map((file) => parseDocument(file.fileName, file.text));
  const skipped = parsed
    .filter((document) => document.kind === "unknown" || !document.contractNumber)
    .map((document) => ({
      fileName: document.fileName,
      reason: document.kind === "unknown" ? "Тип документа не распознан" : "Номер договора не найден",
    }));

  const grouped = new Map<string, ParsedDocument[]>();
  for (const document of parsed) {
    if (!document.contractNumber || document.kind === "unknown") {
      continue;
    }
    const bucket = grouped.get(document.contractNumber) ?? [];
    bucket.push(document);
    grouped.set(document.contractNumber, bucket);
  }

  const contracts = [...grouped.entries()]
    .map(([contractNumber, documents]) => resolveContract(contractNumber, documents, checkDate))
    .sort((left, right) => left.contractNumber.localeCompare(right.contractNumber));

  return { checkDate, contracts, skipped };
}

export function fieldOf(contract: ResolvedContract, id: string): ResolvedField | undefined {
  return contract.fields.find((field) => field.id === id);
}

export function hasUnagreedDeliveryChange(contract: ResolvedContract): boolean {
  return contract.proposed.some((document) => document.fields.some((field) => field.id === "deliveryDate"));
}

export function deliveriesBefore(contracts: ResolvedContract[], isoDate: string): ResolvedContract[] {
  return contracts.filter((contract) => {
    const delivery = fieldOf(contract, "deliveryDate");
    return typeof delivery?.value === "string" && delivery.value < isoDate;
  });
}
