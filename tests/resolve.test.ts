import { describe, expect, it } from "vitest";
import { analyze, deliveriesBefore, fieldOf, hasUnagreedDeliveryChange } from "../lib/resolve";
import { parseDocument } from "../lib/parse";
import type { LoadedFile, ResolvedContract } from "../lib/types";
import { loadDir, loadSamples } from "./helpers";

function contract(result: ReturnType<typeof analyze>, number: string): ResolvedContract {
  const found = result.contracts.find((item) => item.contractNumber === number);
  if (!found) {
    throw new Error(number);
  }
  return found;
}

function expectEvidence(
  citation: { fileName: string; quote: string; paragraphIndex: number } | null | undefined,
  expectedFile: string,
  files: LoadedFile[],
) {
  expect(citation).toBeTruthy();
  expect(citation?.fileName).toBe(expectedFile);
  const source = files.find((file) => file.fileName === expectedFile);
  expect(source).toBeTruthy();
  expect(source?.text.includes(citation?.quote ?? "")).toBe(true);
  const paragraph = source && parseDocument(source.fileName, source.text).paragraphs.find((item) => item.index === citation?.paragraphIndex);
  expect(paragraph).toBeTruthy();
  expect(paragraph?.text.includes(citation?.quote ?? "")).toBe(true);
}

function expectExtractedEvidence(
  field: { citations: { fileName: string; quote: string; paragraphIndex: number }[] } | undefined,
  expectedFile: string,
  files: LoadedFile[],
) {
  expectEvidence(field?.citations[0], expectedFile, files);
}

function evidenceSignature(item: ResolvedContract, files: LoadedFile[]) {
  const byName = new Map(files.map((file) => [file.fileName, file.text]));
  const citations = item.fields.flatMap((field) => [field.citation, ...field.extraCitations])
    .filter((citation): citation is NonNullable<typeof citation> => citation != null)
    .map((citation) => [byName.get(citation.fileName), citation.quote, citation.paragraphIndex, citation.clause]);
  const side = [...item.proposed, ...item.scheduled].map((document) => [
    document.label,
    document.fields.map((field) => field.citations.map((citation) => [
      byName.get(citation.fileName), citation.quote, citation.paragraphIndex,
    ])),
  ]);
  return { citations, side };
}

describe("resolve", () => {
  const samples = loadSamples();

  it("на 2026-03-10 применяет только подписанное ДС №1 к STN-101", () => {
    const stn101 = contract(analyze(samples, "2026-03-10"), "STN-101");
    expect(fieldOf(stn101, "deliveryDate")?.value).toBe("2026-04-30");
    expect(fieldOf(stn101, "amount")?.value).toBe(1380000);
    expect(fieldOf(stn101, "amount")?.previous?.value).toBe(1200000);
    expect(fieldOf(stn101, "amount")?.citation?.amendmentNumber).toBe("1");
    expect(fieldOf(stn101, "deliveryDate")?.citation?.quote).toContain("30.04.2026");
    expectEvidence(fieldOf(stn101, "amount")?.citation, "02_amendment_signed.txt", samples);
    expectEvidence(fieldOf(stn101, "deliveryDate")?.citation, "02_amendment_signed.txt", samples);
    expect(stn101.status).toBe("изменён ДС №1");
    expect(stn101.hasUnagreedChange).toBe(true);
    expect(stn101.proposed).toEqual([
      expect.objectContaining({
        amendmentNumber: "2",
        label: "не согласовано",
      }),
    ]);
    const proposedValues = stn101.proposed[0]?.fields.map((field) => field.value);
    expect(proposedValues).toEqual(expect.arrayContaining([1450000, "2026-05-10"]));
    for (const field of stn101.proposed[0]?.fields ?? []) {
      expectExtractedEvidence(field, "06_amendment_draft.txt", samples);
    }
    expect(stn101.proposed[0]?.label).toBe("не согласовано");
  });

  it("на 2026-02-20 оставляет исходные условия STN-101", () => {
    const stn101 = contract(analyze(samples, "2026-02-20"), "STN-101");
    expect(fieldOf(stn101, "deliveryDate")?.value).toBe("2026-04-15");
    expect(fieldOf(stn101, "amount")?.value).toBe(1200000);
    expect(stn101.scheduled[0]?.label).toBe("вступит в силу позже");
    expect(stn101.scheduled[0]?.amendmentNumber).toBe("1");
    expect(stn101.status).toBe("действует");
    expectEvidence(fieldOf(stn101, "deliveryDate")?.citation, "01_contract.txt", samples);
    expectEvidence(fieldOf(stn101, "amount")?.citation, "01_contract.txt", samples);
    expect(stn101.scheduled[0]?.label).toBe("вступит в силу позже");
    for (const field of stn101.scheduled[0]?.fields ?? []) {
      expectExtractedEvidence(field, "02_amendment_signed.txt", samples);
    }
  });

  it("для STN-102 оставляет сумму договора и срок поставки, письмо не применяет", () => {
    const stn102 = contract(analyze(samples, "2026-03-10"), "STN-102");
    expect(fieldOf(stn102, "amount")?.value).toBe(840000);
    expect(fieldOf(stn102, "deliveryDate")?.value).toBe("2026-03-20");
    expect(stn102.status).toBe("действует");
    expect(stn102.hasUnagreedChange).toBe(true);
    expect(stn102.proposed[0]?.fields.map((field) => field.value)).toContain("2026-03-27");
    expect(JSON.stringify(fieldOf(stn102, "amount"))).not.toContain("252000");
    expect(JSON.stringify(fieldOf(stn102, "deliveryDate"))).not.toContain("2026-04-10");
    expectEvidence(fieldOf(stn102, "amount")?.citation, "03_contract.txt", samples);
    expectEvidence(fieldOf(stn102, "deliveryDate")?.citation, "03_contract.txt", samples);
    const proposed = stn102.proposed.find((document) => document.fields.some((field) => field.id === "deliveryDate"));
    expect(proposed?.label).toBe("не согласовано");
    const proposedDelivery = proposed?.fields.find((field) => field.id === "deliveryDate");
    expectExtractedEvidence(proposedDelivery, "05_supplier_email.txt", samples);
  });

  it("для STN-103 оставляет сумму пустой и требует проверки", () => {
    const stn103 = contract(analyze(samples, "2026-03-10"), "STN-103");
    const amount = fieldOf(stn103, "amount");
    expect(amount?.value).toBeNull();
    expect(amount?.needsReview).toBe(true);
    expect(fieldOf(stn103, "deliveryDate")?.value).toBe("2026-04-30");
    expect(fieldOf(stn103, "deliveryDate")?.needsReview).toBe(false);
    expect(stn103.status).toBe("требует проверки");
    expect(JSON.stringify(amount)).not.toContain("600000");
    expectEvidence(amount?.citation, "04_contract.txt", samples);
    expectEvidence(fieldOf(stn103, "deliveryDate")?.citation, "04_contract.txt", samples);
  });

  it("фильтр поставки раньше 2026-04-01 возвращает только STN-102 с несогласованным сроком", () => {
    const result = analyze(samples, "2026-03-10");
    const found = deliveriesBefore(result.contracts, "2026-04-01");
    expect(found.map((item) => item.contractNumber)).toEqual(["STN-102"]);
    expect(hasUnagreedDeliveryChange(found[0])).toBe(true);
    expect(hasUnagreedDeliveryChange(contract(result, "STN-101"))).toBe(true);
    expect(deliveriesBefore(result.contracts, "2026-04-01").some((item) => item.contractNumber === "STN-101")).toBe(false);
    const stn102 = found[0];
    expectEvidence(fieldOf(stn102, "deliveryDate")?.citation, "03_contract.txt", samples);
    const proposal = stn102.proposed.find((document) => document.fields.some((field) => field.id === "deliveryDate"));
    const proposalField = proposal?.fields.find((field) => field.id === "deliveryDate");
    expect(proposal?.label).toBe("не согласовано");
    expectExtractedEvidence(proposalField, "05_supplier_email.txt", samples);
  });

  it("не зависит от порядка и имён файлов", () => {
    const renamed: LoadedFile[] = [...samples].reverse().map((file, index) => ({
      fileName: `upload-${index}.txt`,
      text: file.text,
    }));
    const left = analyze(samples, "2026-03-10");
    const right = analyze(renamed, "2026-03-10");
    const signature = (item: ResolvedContract) => ({
      contractNumber: item.contractNumber,
      status: item.status,
      values: item.fields.map((field) => [field.id, field.value, field.needsReview]),
      proposed: item.proposed.map((document) => document.fields.map((field) => field.value)),
    });
    expect(right.contracts.map(signature)).toEqual(left.contracts.map(signature));
    expect(right.contracts.map((item) => evidenceSignature(item, renamed))).toEqual(
      left.contracts.map((item) => evidenceSignature(item, samples)),
    );
    for (const item of right.contracts) {
      for (const field of item.fields) {
        if (field.citation) expectEvidence(field.citation, field.citation.fileName, renamed);
      }
      for (const document of [...item.proposed, ...item.scheduled]) {
        for (const field of document.fields) expectExtractedEvidence(field, document.fileName, renamed);
      }
    }
  });

  it("извлекает поля нового договора того же формата", () => {
    const stn104 = contract(analyze(loadDir("tests/fixtures"), "2026-03-10"), "STN-104");
    expect(fieldOf(stn104, "supplier")?.value).toBe("ООО «Новый Поставщик»");
    expect(fieldOf(stn104, "amount")?.value).toBe(2500000);
    expect(fieldOf(stn104, "deliveryDate")?.value).toBe("2026-05-15");
    expect(stn104.status).toBe("действует");
    const fixture = loadDir("tests/fixtures");
    for (const id of ["supplier", "amount", "deliveryDate"]) {
      expectEvidence(fieldOf(stn104, id)?.citation, "stn-104.txt", fixture);
    }
  });

  it("при одинаковой дате вступления не выбирает сумму сам", () => {
    const base = samples.find((file) => file.fileName === "01_contract.txt");
    if (!base) {
      throw new Error("base");
    }
    const make = (number: string, amount: string, date: string) =>
      `ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ № ${number} К ДОГОВОРУ STN-101
Дата: ${date}
Статус: подписано обеими сторонами ${date}.

1. Пункт 2.1 договора изложить в следующей редакции: «Общая стоимость поставки составляет ${amount} (сумма) рублей, включая НДС».

4. Настоящее соглашение вступает в силу ${date}.
`;
    const result = analyze(
      [
        base,
        { fileName: "a.txt", text: make("1", "1 100 000", "01.03.2026") },
        { fileName: "b.txt", text: make("3", "1 700 000", "01.03.2026") },
      ],
      "2026-03-10",
    );
    const amount = fieldOf(contract(result, "STN-101"), "amount");
    expect(amount?.value).toBeNull();
    expect(amount?.needsReview).toBe(true);
    expect(amount?.extraCitations).toHaveLength(2);
    expect(contract(result, "STN-101").status).toBe("требует проверки");
  });

  it("более позднее подписанное ДС побеждает, поставщика из ДС не подменяет", () => {
    const base = samples.find((file) => file.fileName === "01_contract.txt");
    if (!base) {
      throw new Error("base");
    }
    const later = `ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ № 4 К ДОГОВОРУ STN-101
Дата: 02.03.2026
Статус: подписано обеими сторонами 02.03.2026.
Покупатель: ООО «СеверМет». Поставщик: ООО «Другой Поставщик».

1. Пункт 2.1 договора изложить в следующей редакции: «Общая стоимость поставки составляет 1 500 000 (сумма) рублей, включая НДС».

4. Настоящее соглашение вступает в силу 05.03.2026.
`;
    const early = samples.find((file) => file.fileName === "02_amendment_signed.txt");
    if (!early) {
      throw new Error("early");
    }
    const stn101 = contract(analyze([base, early, { fileName: "later.txt", text: later }], "2026-03-10"), "STN-101");
    expect(fieldOf(stn101, "amount")?.value).toBe(1500000);
    expect(fieldOf(stn101, "supplier")?.value).toBe("ООО «Вектор Прибор»");
    expect(fieldOf(stn101, "supplier")?.needsReview).toBe(true);
    expect(fieldOf(stn101, "supplier")?.extraCitations[0]?.quote).toContain("ООО «Другой Поставщик»");
    expect(stn101.status).toBe("требует проверки");
  });
});
