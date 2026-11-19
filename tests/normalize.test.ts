import { describe, expect, it } from "vitest";
import { formatAmountRub, formatIsoDate, normalizeWithMap, parseAmount, parseDateToIso, sliceOriginal } from "../lib/normalize";

describe("normalize", () => {
  it("заменяет неразрывный и узкий пробел на обычный и сохраняет исходную цитату", () => {
    const raw = "1\u00A0380\u00A0000 и 1\u202F200\u202F000";
    const normalized = normalizeWithMap(raw);

    expect(normalized.text).toBe("1 380 000 и 1 200 000");
    expect(sliceOriginal(raw, normalized, 0, "1 380 000".length)).toBe("1\u00A0380\u00A0000");
  });

  it("распознаёт сумму с обычным, неразрывным и узким пробелом", () => {
    expect(parseAmount("1 380 000")).toBe(1380000);
    expect(parseAmount("1\u00A0380\u00A0000")).toBe(1380000);
    expect(parseAmount("1\u202F380\u202F000")).toBe(1380000);
    expect(parseAmount("840 000")).toBe(840000);
    expect(parseAmount("не сумма")).toBeNull();
  });

  it("переводит дату ДД.ММ.ГГГГ в ISO и отбрасывает несуществующую", () => {
    expect(parseDateToIso("30.04.2026")).toBe("2026-04-30");
    expect(parseDateToIso("срок 15.04.2026.")).toBe("2026-04-15");
    expect(parseDateToIso("31.02.2026")).toBeNull();
    expect(parseDateToIso("нет даты")).toBeNull();
  });

  it("форматирует сумму и дату только для вывода", () => {
    expect(formatAmountRub(1380000)).toBe("1 380 000 ₽");
    expect(formatIsoDate("2026-04-30")).toBe("30.04.2026");
  });
});
