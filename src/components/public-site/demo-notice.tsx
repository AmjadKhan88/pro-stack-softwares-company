export function DemoNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div
      role="note"
      className="border-warning/40 bg-warning/10 rounded-lg border px-4 py-3 text-sm leading-relaxed"
    >
      <strong className="font-semibold">Sample content.</strong>{" "}
      {children ?? "This is placeholder text, not a real client, project or result."}
    </div>
  );
}
