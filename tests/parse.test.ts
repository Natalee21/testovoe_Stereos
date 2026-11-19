import { describe, expect, it } from "vitest";
import { parseDocument } from "../lib/parse";
import { loadSamples } from "./helpers";

describe("parse", () => {
  const samples = loadSamples();
  const byName = Object.fromEntries(samples.map((file) => [file.fileName, parseDocument(file.fileName, file.text)]));

  it("определяет тип, номер и подпись", () => {
    expect(byName["01_contract.txt"]).toMatchObject({
      kind: "contract",
      contractNumber: "STN-101",
      signedByBothParties: true,
      documentDate: "2026-02-05",
      effectiveDate: "2026-02-05",
    });
    expect(byName["02_amendment_signed.txt"]).toMatchObject({
      kind: "amendment",
      contractNumber: "STN-101",
      amendmentNumber: "1",
      signedByBothParties: true,
      documentDate: "2026-03-01",
      effectiveDate: "2026-03-01",
    });
    expect(byName["03_contract.txt"].contractNumber).toBe("STN-102");
    expect(byName["04_contract.txt"].contractNumber).toBe("STN-103");
    expect(byName["05_supplier_email.txt"]).toMatchObject({
      kind: "letter",
      contractNumber: "STN-102",
      signedByBothParties: false,
      documentDate: "2026-03-05",
      effectiveDate: null,
    });
    expect(byName["06_amendment_draft.txt"]).toMatchObject({
      kind: "amendment_draft",
      contractNumber: "STN-101",
      amendmentNumber: "2",
      signedByBothParties: false,
      documentDate: null,
      effectiveDate: null,
    });
  });

  it("не считает дату проекта датой вступления в силу", () => {
    expect(byName["06_amendment_draft.txt"].rawText).toContain("Дата проекта: 06.03.2026");
    expect(byName["06_amendment_draft.txt"].effectiveDate).toBeNull();
  });

  it("режет текст на пункты", () => {
    const delivery = byName["01_contract.txt"].paragraphs.find((paragraph) => paragraph.clause === "3.1");
    expect(delivery?.text).toContain("15.04.2026");
    const amendmentClause = byName["02_amendment_signed.txt"].paragraphs.find((paragraph) => paragraph.clause === "2");
    expect(amendmentClause?.text).toContain("30.04.2026");
  });
});
