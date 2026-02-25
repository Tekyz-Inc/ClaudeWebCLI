type SideLine = {
  num: number;
  content: string;
  type: "added" | "removed" | "context";
} | null;

type DiffRow = {
  left: SideLine;
  right: SideLine;
  isHeader?: boolean;
  headerText?: string;
};

export function parseDiff(diff: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const lines = diff.split("\n");
  let oldNum = 0;
  let newNum = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      i++;
      continue;
    }

    if (line.startsWith("@@")) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        oldNum = parseInt(m[1], 10);
        newNum = parseInt(m[2], 10);
      }
      rows.push({ left: null, right: null, isHeader: true, headerText: line });
      i++;
      continue;
    }

    if (line.startsWith("-") || line.startsWith("+")) {
      const removed: string[] = [];
      const added: string[] = [];
      while (i < lines.length && (lines[i].startsWith("-") || lines[i].startsWith("+"))) {
        if (lines[i].startsWith("-")) removed.push(lines[i].slice(1));
        else added.push(lines[i].slice(1));
        i++;
      }
      const len = Math.max(removed.length, added.length);
      for (let j = 0; j < len; j++) {
        rows.push({
          left: j < removed.length ? { num: oldNum++, content: removed[j], type: "removed" } : null,
          right: j < added.length ? { num: newNum++, content: added[j], type: "added" } : null,
        });
      }
      continue;
    }

    if (line.startsWith(" ")) {
      const content = line.slice(1);
      rows.push({
        left: { num: oldNum++, content, type: "context" },
        right: { num: newNum++, content, type: "context" },
      });
    }
    i++;
  }
  return rows;
}

function lineClass(line: SideLine, side: "left" | "right"): string {
  if (!line) return "bg-cc-code-bg/20";
  if (side === "left" && line.type === "removed") return "bg-cc-error/10";
  if (side === "right" && line.type === "added") return "bg-cc-success/10";
  return "";
}

export function DiffView({ diff }: { diff: string }) {
  if (!diff) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-cc-muted text-sm">No changes</p>
      </div>
    );
  }

  const rows = parseDiff(diff);

  return (
    <div className="h-full overflow-auto font-mono-code text-[13px]">
      <table className="w-full min-w-[700px] border-collapse">
        <thead className="sticky top-0 z-10 bg-cc-card">
          <tr>
            <th colSpan={2} className="px-3 py-1.5 text-left text-[11px] font-medium text-cc-muted border-b border-r border-cc-border">
              Before
            </th>
            <th colSpan={2} className="px-3 py-1.5 text-left text-[11px] font-medium text-cc-muted border-b border-cc-border">
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.isHeader) {
              return (
                <tr key={i}>
                  <td colSpan={4} className="px-3 py-0.5 text-[11px] text-cc-primary bg-cc-primary/5 border-y border-cc-border">
                    {row.headerText}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={i}>
                <td className={`w-10 px-2 py-0.5 text-right text-cc-muted/40 select-none border-r border-cc-border/40 text-[11px] ${lineClass(row.left, "left")}`}>
                  {row.left?.num}
                </td>
                <td className={`py-0.5 pr-4 pl-1 border-r border-cc-border whitespace-pre ${lineClass(row.left, "left")}`}>
                  {row.left && (
                    <>
                      <span className={`select-none mr-1 ${row.left.type === "removed" ? "text-cc-error" : "text-cc-muted/30"}`}>
                        {row.left.type === "removed" ? "−" : " "}
                      </span>
                      <span className={row.left.type === "removed" ? "text-cc-error" : "text-cc-fg"}>
                        {row.left.content}
                      </span>
                    </>
                  )}
                </td>
                <td className={`w-10 px-2 py-0.5 text-right text-cc-muted/40 select-none border-r border-cc-border/40 text-[11px] ${lineClass(row.right, "right")}`}>
                  {row.right?.num}
                </td>
                <td className={`py-0.5 pr-4 pl-1 whitespace-pre ${lineClass(row.right, "right")}`}>
                  {row.right && (
                    <>
                      <span className={`select-none mr-1 ${row.right.type === "added" ? "text-cc-success" : "text-cc-muted/30"}`}>
                        {row.right.type === "added" ? "+" : " "}
                      </span>
                      <span className={row.right.type === "added" ? "text-cc-success" : "text-cc-fg"}>
                        {row.right.content}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
