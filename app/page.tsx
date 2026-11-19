"use client";

import { useMemo, useState } from "react";
import { QuickQuestions } from "../components/QuickQuestions";
import { ResultsTable } from "../components/ResultsTable";
import { SourceViewer, type SourceJump } from "../components/SourceViewer";
import { UploadPanel } from "../components/UploadPanel";
import { analyze } from "../lib/resolve";
import type { Citation, LoadedFile } from "../lib/types";

export default function HomePage() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [checkDate, setCheckDate] = useState("2026-03-10");
  const [jump, setJump] = useState<SourceJump | null>(null);
  const analysis = useMemo(() => analyze(files, checkDate), [files, checkDate]);

  function openSource(citation: Citation) {
    setJump({ ...citation, sequence: (jump?.sequence ?? 0) + 1 });
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Проверка договоров поставки</h1>
        <p className="mt-1 text-sm text-stone-600">Действующие условия с проверяемыми источниками и отдельным списком предложений.</p>
      </header>
      <UploadPanel files={files} onFiles={setFiles} checkDate={checkDate} onCheckDate={setCheckDate} />
      {!files.length ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-stone-600">
          Загрузите TXT-файлы, например из samples/documents/
        </div>
      ) : (
        <>
          {analysis.skipped.length > 0 && <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Не удалось связать документы: {analysis.skipped.map((item) => `${item.fileName} (${item.reason})`).join("; ")}
          </div>}
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="min-w-0 space-y-6">
              <ResultsTable contracts={analysis.contracts} onSource={openSource} />
              <QuickQuestions analysis={analysis} onSource={openSource} />
            </div>
            <div className="xl:sticky xl:top-4">
              <h2 className="mb-2 text-base font-semibold">Исходный текст</h2>
              <SourceViewer files={files} jump={jump} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
