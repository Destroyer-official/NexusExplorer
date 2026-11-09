import { useEffect, useRef, useState } from "react";

export default function RenameInput({ name, onCommit, onCancel }: { name: string; onCommit: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    input.current?.focus();
    const extension = name.lastIndexOf(".");
    if (extension > 0) input.current?.setSelectionRange(0, extension);
    else input.current?.select();
  }, [name]);
  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    if (!value.trim() || value === name) onCancel();
    else onCommit(value);
  };
  return <input ref={input} className="rename-input" aria-label="Rename item" value={value}
    onChange={(event) => setValue(event.target.value)}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Enter") { event.preventDefault(); commit(); }
      if (event.key === "Escape") { event.preventDefault(); finished.current = true; onCancel(); }
    }} onBlur={commit} />;
}
