export type DocumentKind = "contract" | "amendment" | "amendment_draft" | "letter" | "unknown";

export type FieldKind = "money" | "date" | "text";

export type NormalizedText = {
  text: string;
  toRaw: number[];
};

export type Citation = {
  fileName: string;
  clause: string | null;
  quote: string;
  paragraphIndex: number;
};

export type Paragraph = {
  index: number;
  clause: string | null;
  text: string;
  start: number;
  end: number;
};

export type ParsedDocument = {
  fileName: string;
  rawText: string;
  normalized: NormalizedText;
  kind: DocumentKind;
  contractNumber: string | null;
  amendmentNumber: string | null;
  signedByBothParties: boolean;
  documentDate: string | null;
  effectiveDate: string | null;
  paragraphs: Paragraph[];
};

export type ExtractedField = {
  id: string;
  kind: FieldKind;
  value: number | string | null;
  needsReview: boolean;
  citations: Citation[];
  relatedNotes?: { label: string; citation: Citation }[];
};

export type FieldSource = Citation & {
  amendmentNumber: string | null;
  documentKind: DocumentKind;
};

export type ResolvedField = {
  id: string;
  kind: FieldKind;
  value: number | string | null;
  needsReview: boolean;
  citation: FieldSource | null;
  relatedNotes: { label: string; citation: FieldSource }[];
  previous: { value: number | string; citation: FieldSource } | null;
  extraCitations: FieldSource[];
};

export type SideDocument = {
  fileName: string;
  documentKind: DocumentKind;
  amendmentNumber: string | null;
  effectiveDate: string | null;
  label: "не согласовано" | "вступит в силу позже";
  fields: ExtractedField[];
};

export type ContractStatus = "действует" | "требует проверки" | `изменён ДС №${string}`;

export type ResolvedContract = {
  contractNumber: string;
  status: ContractStatus;
  hasUnagreedChange: boolean;
  fields: ResolvedField[];
  proposed: SideDocument[];
  scheduled: SideDocument[];
};

export type LoadedFile = {
  fileName: string;
  text: string;
};

export type Analysis = {
  checkDate: string;
  contracts: ResolvedContract[];
  skipped: { fileName: string; reason: string }[];
};
