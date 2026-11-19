import { describe, expect, it } from "vitest";
import { extractFields } from "../lib/extract";
import { parseDocument } from "../lib/parse";
import { loadSamples } from "./helpers";

function field(fileName: string, id: string) {
  const file = loadSamples().find((item) => item.fileName === fileName);
  if (!file) {
    throw new Error(fileName);
  }
  return extractFields(parseDocument(file.fileName, file.text)).find((item) => item.id === id);
}

describe("extract", () => {
  it("не берёт аванс вместо суммы STN-102", () => {
    const amount = field("03_contract.txt", "amount");
    expect(amount?.value).toBe(840000);
    expect(amount?.needsReview).toBe(false);
    expect(amount?.citations[0]?.quote).toContain("840 000");
    expect(amount?.citations[0]?.quote).not.toContain("252 000");
  });

  it("не берёт срок оплаты вместо срока поставки", () => {
    const delivery = field("03_contract.txt", "deliveryDate");
    expect(delivery?.value).toBe("2026-03-20");
    expect(delivery?.citations[0]?.quote).toContain("20.03.2026");
    expect(delivery?.citations[0]?.quote).not.toContain("10.04.2026");
  });

  it("не берёт лимит бюджета за сумму STN-103", () => {
    const amount = field("04_contract.txt", "amount");
    expect(amount?.value).toBeNull();
    expect(amount?.needsReview).toBe(true);
    expect(amount?.citations[0]?.quote).toContain("не указано");
    expect(JSON.stringify(amount)).not.toContain("600000");
  });

  it("читает новую редакцию подписанного ДС и предложение проекта", () => {
    expect(field("02_amendment_signed.txt", "amount")?.value).toBe(1380000);
    expect(field("02_amendment_signed.txt", "deliveryDate")?.value).toBe("2026-04-30");
    expect(field("02_amendment_signed.txt", "deliveryDate")?.citations[0]?.quote).toContain(
      "Поставщик обязуется поставить оборудование не позднее 30.04.2026",
    );
    expect(field("06_amendment_draft.txt", "amount")?.value).toBe(1450000);
    expect(field("06_amendment_draft.txt", "deliveryDate")?.value).toBe("2026-05-10");
  });

  it("из письма берёт предложенный срок, а не исходный", () => {
    const delivery = field("05_supplier_email.txt", "deliveryDate");
    expect(delivery?.value).toBe("2026-03-27");
    expect(delivery?.citations[0]?.quote).toContain("27.03.2026");
  });

  it("распознаёт сумму с неразрывным и узким пробелом", () => {
    const text = [
      "ДОГОВОР ПОСТАВКИ № STN-201",
      "Дата: 01.03.2026",
      "Статус: подписан обеими сторонами 01.03.2026.",
      "",
      "1.1. Покупатель: ООО «СеверМет». Поставщик: ООО «Пробел».",
      "",
      "2.1. Общая стоимость поставки составляет 1\u00A0380\u00A0000 (один миллион) рублей, включая НДС.",
      "",
      "3.1. Поставщик обязуется поставить оборудование не позднее 30.04.2026.",
    ].join("\n");
    const narrow = text.replace("1\u00A0380\u00A0000", "1\u202F380\u202F000");
    expect(extractFields(parseDocument("nbsp.txt", text)).find((item) => item.id === "amount")?.value).toBe(1380000);
    expect(extractFields(parseDocument("narrow.txt", narrow)).find((item) => item.id === "amount")?.value).toBe(1380000);
  });
});
