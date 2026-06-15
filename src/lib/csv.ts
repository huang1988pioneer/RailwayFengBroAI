export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
    );
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export function coerceCsvValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
}

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
