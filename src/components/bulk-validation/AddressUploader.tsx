/** Textarea + CSV drag-and-drop for the address list. */
import { useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  count: number;
}

export function AddressUploader({ value, onChange, count }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        style={{ ...dropStyle, borderColor: dragging ? "#ff9900" : "#ccc" }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"410 Terry Ave N, Seattle, WA 98109\n1600 Pennsylvania Ave NW, Washington, DC 20500\n…"}
          style={textareaStyle}
          rows={8}
        />
        <div style={footerStyle}>
          <span>{count} address{count === 1 ? "" : "es"}</span>
          <span>
            Drag a CSV here, or{" "}
            <button type="button" style={linkBtn} onClick={() => inputRef.current?.click()}>
              browse
            </button>
          </span>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
      />
    </div>
  );
}

const dropStyle: React.CSSProperties = {
  border: "2px dashed #ccc",
  borderRadius: 8,
  overflow: "hidden",
};
const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  resize: "vertical",
  padding: 12,
  fontSize: 13,
  fontFamily: "ui-monospace, monospace",
  boxSizing: "border-box",
};
const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 12px",
  background: "#f8f8f8",
  fontSize: 12,
  color: "#666",
};
const linkBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#0066c0",
  cursor: "pointer",
  textDecoration: "underline",
  fontSize: 12,
  padding: 0,
};
