import type { FieldKind } from "./types";

export type FieldConfig = {
  id: string;
  label: string;
  kind: FieldKind;
  showInTable: boolean;
  patterns: RegExp[];
  absentPatterns?: RegExp[];
};

const groupedNumber = "(\\d{1,3}(?: \\d{3})+|\\d+)";
const ruDate = "(\\d{2}\\.\\d{2}\\.\\d{4})";

export const fieldConfigs: FieldConfig[] = [
  {
    id: "supplier",
    label: "Поставщик",
    kind: "text",
    showInTable: true,
    patterns: [/Поставщик:\s*([^.\n]+)/],
  },
  {
    id: "amount",
    label: "Сумма",
    kind: "money",
    showInTable: true,
    patterns: [
      new RegExp(`Общая стоимость поставки составляет\\s+${groupedNumber}`),
      new RegExp(`изменить общую стоимость поставки на\\s+${groupedNumber}`, "i"),
    ],
    absentPatterns: [/Числовое значение стоимости в тексте договора не указано/],
  },
  {
    id: "deliveryDate",
    label: "Срок поставки",
    kind: "date",
    showInTable: true,
    patterns: [
      new RegExp(`поставить[^\\n]{0,160}?не позднее\\s+${ruDate}`),
      new RegExp(`изменить срок поставки на\\s+${ruDate}`, "i"),
      new RegExp(`перенести срок поставки с\\s+\\d{2}\\.\\d{2}\\.\\d{4}\\s+на\\s+${ruDate}`, "i"),
    ],
  },
];

export function fieldConfigById(id: string): FieldConfig | undefined {
  return fieldConfigs.find((field) => field.id === id);
}
