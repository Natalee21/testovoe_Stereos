import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Проверка договоров поставки",
  description: "Сумма и срок поставки с цитатой из текста договора",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
