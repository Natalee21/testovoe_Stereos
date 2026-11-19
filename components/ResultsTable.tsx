"use client";

import type { Citation, ResolvedContract, ResolvedField, SideDocument } from "../lib/types";
import type { SourceJump } from "./SourceViewer";

type Props = { contracts: ResolvedContract[]; onSource: (citation: Citation) => void };

function amount(value: number | string | null) {
  if (typeof value !== "number") return "нет данных";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function date(value: number | string | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "нет данных";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function EvidenceLink({ citation, onSource }: { citation: Citation | null; onSource: Props["onSource"] }) {
  if (!citation) return <span className="text-xs text-stone-500">Источник не найден</span>;
  return (
    <div className="mt-1 text-xs text-stone-600">
      <button type="button" onClick={() => onSource(citation)} className="font-medium text-blue-700 underline">источник</button>
      <span> · {citation.fileName}{citation.clause ? `, п. ${citation.clause}` : ""}</span>
      <blockquote className="mt-1 border-l-2 border-stone-300 pl-2">«{citation.quote}»</blockquote>
    </div>
  );
}

function FieldValue({ field, onSource }: { field: ResolvedField | undefined; onSource: Props["onSource"] }) {
  if (!field || field.value == null) return <><span>нет данных</span><EvidenceLink citation={field?.citation ?? null} onSource={onSource} /></>;
  const shown = field.id === "amount" ? amount(field.value) : field.id === "deliveryDate" ? date(field.value) : String(field.value);
  const previous = field.previous ? (field.id === "amount" ? amount(field.previous.value) : date(field.previous.value)) : null;
  return <>
    {previous && field.citation?.documentKind === "amendment" ? (
      <span>{previous} → {shown} (ДС №{field.citation.amendmentNumber ?? "?"}, {field.citation.fileName})</span>
    ) : <span>{shown}</span>}
    <EvidenceLink citation={field.citation} onSource={onSource} />
    {field.needsReview && <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">требует проверки</span>}
  </>;
}

function pendingText(field: SideDocument["fields"][number]) {
  const value = field.id === "amount" && typeof field.value === "number" ? amount(field.value)
    : field.id === "deliveryDate" ? date(field.value) : String(field.value ?? "нет данных");
  return `${field.id === "amount" ? "Сумма" : field.id === "deliveryDate" ? "Срок поставки" : field.id}: ${value}`;
}

function Pending({ documents, onSource }: { documents: SideDocument[]; onSource: Props["onSource"] }) {
  if (!documents.length) return null;
  return <ul className="mt-2 space-y-2 border-t border-stone-200 pt-2">
    {documents.map((document) => document.fields.map((field, index) => (
      <li key={`${document.fileName}-${field.id}-${index}`} className="text-sm">
        <span className="font-medium">{pendingText(field)}</span> — {document.fileName} · <span className="rounded bg-orange-100 px-2 py-0.5 text-xs">{document.label}</span>
        <EvidenceLink citation={field.citations[0] ?? null} onSource={onSource} />
      </li>
    )))}
  </ul>;
}

export function ResultsTable({ contracts, onSource }: Props) {
  return (
    <section className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
          <tr>{["Договор", "Поставщик", "Сумма, ₽", "Срок поставки", "Статус"].map((title) => <th key={title} className="px-3 py-3">{title}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {contracts.map((contract) => {
            const supplier = contract.fields.find((field) => field.id === "supplier");
            const amountField = contract.fields.find((field) => field.id === "amount");
            const delivery = contract.fields.find((field) => field.id === "deliveryDate");
            return <tr key={contract.contractNumber} className="align-top">
              <td className="px-3 py-3 font-semibold">{contract.contractNumber}</td>
              <td className="px-3 py-3"><FieldValue field={supplier} onSource={onSource} /></td>
              <td className="px-3 py-3"><FieldValue field={amountField} onSource={onSource} /></td>
              <td className="px-3 py-3"><FieldValue field={delivery} onSource={onSource} /></td>
              <td className="px-3 py-3">
                <span className="rounded bg-stone-100 px-2 py-1 text-xs">{contract.status}</span>
                {contract.fields.some((field) => field.needsReview) && <span className="mt-2 block rounded bg-amber-100 px-2 py-1 text-xs">требует проверки</span>}
                {contract.hasUnagreedChange && <span className="mt-2 block rounded bg-orange-100 px-2 py-1 text-xs">есть несогласованное изменение</span>}
                <Pending documents={[...contract.proposed, ...contract.scheduled]} onSource={onSource} />
              </td>
            </tr>;
          })}
          {!contracts.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">Документы не содержат распознанных договоров.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

export type { SourceJump };
