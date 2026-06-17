export type GoogleSheetsConfig = {
  spreadsheet_url: string;
  sheet_name?: string | null;
};

export type GoogleSheetsSearchResult = {
  rows: Array<Record<string, string>>;
  mode: "demo" | "public_csv";
};

export class GoogleSheetsConnector {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async readRows(config: GoogleSheetsConfig): Promise<GoogleSheetsSearchResult> {
    if (config.spreadsheet_url.startsWith("demo://")) {
      return {
        mode: "demo",
        rows: [
          { nombre: "Ana Torres", email: "ana@example.com", interes: "CRM" },
          { nombre: "Bruno Diaz", email: "bruno@example.com", interes: "WhatsApp" }
        ]
      };
    }

    const csvUrl = toPublicCsvUrl(config.spreadsheet_url, config.sheet_name);
    const response = await this.fetcher(csvUrl);
    if (!response.ok) throw new Error(`Google Sheets public CSV failed with ${response.status}`);
    const csv = await response.text();

    return {
      mode: "public_csv",
      rows: parseCsv(csv)
    };
  }

  async search(config: GoogleSheetsConfig, query: string) {
    const result = await this.readRows(config);
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? result.rows.filter((row) => Object.values(row).some((value) => value.toLowerCase().includes(needle)))
      : result.rows;

    return { ...result, rows };
  }
}

export function toPublicCsvUrl(url: string, sheetName?: string | null) {
  const match = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) return url;
  const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : "";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv${sheetParam}`;
}

export function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, "").replaceAll('""', '"'));
}
