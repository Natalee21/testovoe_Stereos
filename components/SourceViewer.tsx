"use client";

import { useEffect, useRef, useState } from "react";
import { parseDocument } from "../lib/parse";
import type { Citation, LoadedFile } from "../lib/types";

export type SourceJump = Citation & { sequence: number };

type Props = { files: LoadedFile[]; jump: SourceJump | null };

export function SourceViewer({ files, jump }: Props) {
  const [activeFile, setActiveFile] = useState(files[0]?.fileName ?? "");
  const paragraphs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeJump = useRef<string | null>(null);

  useEffect(() => {
    if (files.length && !files.some((file) => file.fileName === activeFile)) setActiveFile(files[0].fileName);
  }, [files, activeFile]);

  useEffect(() => {
    if (!jump || !files.some((file) => file.fileName === jump.fileName)) return;
    setActiveFile(jump.fileName);
    activeJump.current = `${jump.fileName}:${jump.paragraphIndex}:${jump.sequence}`;
    requestAnimationFrame(() => {
      const target = paragraphs.current[`${jump.fileName}:${jump.paragraphIndex}`];
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [jump, activeFile, files]);

  if (!files.length) {
    return <aside className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">Просмотр исходного текста появится после загрузки.</aside>;
  }

  const active = files.find((file) => file.fileName === activeFile) ?? files[0];
  const parsed = parseDocument(active.fileName, active.text);

  return (
    <aside className="min-w-0 rounded-lg border border-stone-200 bg-white">
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 p-2" aria-label="Файлы источников">
        {files.map((file) => (
          <button key={file.fileName} type="button" onClick={() => setActiveFile(file.fileName)}
            className={`shrink-0 rounded px-2 py-1 text-xs ${active.fileName === file.fileName ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}>
            {file.fileName}
          </button>
        ))}
      </div>
      <div className="max-h-[70vh] space-y-2 overflow-auto p-3">
        {parsed.paragraphs.map((paragraph) => {
          const id = `${active.fileName}:${paragraph.index}`;
          const highlighted = activeJump.current === `${id}:${jump?.sequence}`;
          return (
            <div key={paragraph.index} ref={(node) => { paragraphs.current[id] = node; }} tabIndex={-1}
              className={`rounded p-2 text-sm leading-6 outline-none ${highlighted ? "bg-amber-100 ring-2 ring-amber-400" : "hover:bg-stone-50"}`}>
              {paragraph.clause && <span className="mr-2 font-medium text-stone-500">{paragraph.clause}.</span>}
              {paragraph.text.replace(/^\d+(?:\.\d+)*\.\s*/, "")}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
