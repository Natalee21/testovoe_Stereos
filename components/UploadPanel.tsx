"use client";

import { useRef, useState } from "react";
import type { LoadedFile } from "../lib/types";

type Props = {
  files: LoadedFile[];
  onFiles: (files: LoadedFile[]) => void;
  checkDate: string;
  onCheckDate: (date: string) => void;
};

export function UploadPanel({ files, onFiles, checkDate, onCheckDate }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  async function accept(selected: FileList | File[]) {
    const list = Array.from(selected);
    const invalid = list.filter((file) => !file.name.toLowerCase().endsWith(".txt"));
    if (invalid.length) {
      setError("Поддерживаются только TXT-файлы.");
      return;
    }
    setError("");
    onFiles(await Promise.all(list.map(async (file) => ({ fileName: file.name, text: await file.text() }))));
  }

  return (
    <section className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="min-w-64 flex-1">
        <label htmlFor="documents" className="mb-1 block text-sm font-medium">TXT-документы</label>
        <input
          ref={input}
          id="documents"
          type="file"
          accept=".txt,text/plain"
          multiple
          onChange={(event) => { if (event.target.files?.length) void accept(event.target.files); }}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2"
        />
        <p className="mt-1 text-xs text-stone-500">Загружено файлов: {files.length}</p>
        {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
      <div>
        <label htmlFor="check-date" className="mb-1 block text-sm font-medium">Дата проверки</label>
        <input
          id="check-date"
          type="date"
          value={checkDate}
          onChange={(event) => onCheckDate(event.target.value)}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </div>
    </section>
  );
}
