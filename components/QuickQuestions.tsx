"use client";

import { useMemo, useState } from "react";
import { deliveriesBefore, fieldOf, hasUnagreedDeliveryChange } from "../lib/resolve";
import type { Analysis, Citation } from "../lib/types";
import { EvidenceLink } from "./ResultsTable";

type Props = { analysis: Analysis; onSource: (citation: Citation) => void };

function show(fieldId: string, value: number | string | null) {
  if (value == null) return "нет данных";
  if (fieldId === "amount" && typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value);
  if (fieldId === "deliveryDate" && typeof value === "string") return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
  return String(value);
}

export function QuickQuestions({ analysis, onSource }: Props) {
  const [contractNumber, setContractNumber] = useState(analysis.contracts[0]?.contractNumber ?? "");
  const [fieldId, setFieldId] = useState("amount");
  const [beforeDate, setBeforeDate] = useState("2026-04-01");
  const chosen = analysis.contracts.find((contract) => contract.contractNumber === contractNumber);
  const answer = chosen ? fieldOf(chosen, fieldId) : undefined;
  const matches = useMemo(() => deliveriesBefore(analysis.contracts, beforeDate), [analysis.contracts, beforeDate]);

  return <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
    <h2 className="mb-4 text-lg font-semibold">Быстрые вопросы</h2>
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium">Договор и поле</h3>
        <div className="flex flex-wrap gap-2">
          <select value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} className="rounded border border-stone-300 px-2 py-2 text-sm">
            {analysis.contracts.map((contract) => <option key={contract.contractNumber}>{contract.contractNumber}</option>)}
          </select>
          <select value={fieldId} onChange={(event) => setFieldId(event.target.value)} className="rounded border border-stone-300 px-2 py-2 text-sm">
            <option value="amount">Сумма</option><option value="deliveryDate">Срок поставки</option>
          </select>
        </div>
        <p className="mt-3 font-semibold">Ответ: {show(fieldId, answer?.value ?? null)}</p>
        {answer?.needsReview && <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-1 text-xs">требует проверки</span>}
        <EvidenceLink citation={answer?.citation ?? null} onSource={onSource} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Поставка раньше даты</h3>
        <input aria-label="Пороговая дата поставки" type="date" value={beforeDate} onChange={(event) => setBeforeDate(event.target.value)} className="rounded border border-stone-300 px-2 py-2 text-sm" />
        <ul className="mt-3 space-y-3 text-sm">
          {matches.map((contract) => {
            const delivery = fieldOf(contract, "deliveryDate");
            const proposed = contract.proposed.flatMap((document) => document.fields.filter((field) => field.id === "deliveryDate").map((field) => ({ document, field })));
            return <li key={contract.contractNumber} className="border-t border-stone-200 pt-2">
              <p><strong>{contract.contractNumber}</strong> · {show("deliveryDate", delivery?.value ?? null)}
                {hasUnagreedDeliveryChange(contract) && <span className="ml-2 rounded bg-orange-100 px-2 py-1 text-xs">есть несогласованное изменение срока</span>}
              </p>
              <EvidenceLink citation={delivery?.citation ?? null} onSource={onSource} />
              {proposed.map(({ document, field }) => <div key={`${document.fileName}-${field.id}`} className="mt-2">
                Предложено: {show("deliveryDate", field.value)} — {document.fileName} · {document.label}
                <EvidenceLink citation={field.citations[0] ?? null} onSource={onSource} />
              </div>)}
            </li>;
          })}
          {!matches.length && <li className="text-stone-500">Подходящих договоров нет.</li>}
        </ul>
      </div>
    </div>
  </section>;
}
