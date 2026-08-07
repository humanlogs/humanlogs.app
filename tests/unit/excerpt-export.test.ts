import { describe, expect, it } from "vitest";
import {
  excerptTableBlob,
  exportFileName,
  formatPassage,
  toCsv,
  type ExcerptTable,
} from "@/lib/codebooks/excerpt-export";

/**
 * The exported table is the thing that leaves the tool — it ends up in an article,
 * a supervision meeting, a co-author's inbox. Most of what can go wrong in it is
 * silent: a verbatim containing a comma that shifts a column, an accent that Excel
 * reads as Latin-1, a quote with no speaker attached to it.
 */

const table: ExcerptTable = {
  title: "Étude hôpital",
  columns: ["Thème", "Phrases", "Analyse"],
  caption: "Étude hôpital · 3 passages",
  rows: [
    {
      theme: "Violence",
      passages: [
        {
          text: "on nous crie dessus",
          speaker: "Cadre A",
          document: "Entretien 1",
        },
        {
          // Everything a CSV field can carry and a naive writer breaks on.
          text: 'elle a dit : "ça suffit", puis, plus rien',
          speaker: "Soignante B",
          document: "Entretien 2",
        },
      ],
    },
    { theme: "Institution", passages: [] },
  ],
};

describe("formatPassage", () => {
  it("quotes the passage and attributes it", () => {
    expect(
      formatPassage({ text: "on tient", speaker: "Cadre A", document: "E1" }),
    ).toBe("« on tient » — Cadre A, E1");
  });

  it("says nothing rather than a dangling dash when there is no source", () => {
    expect(formatPassage({ text: "on tient", speaker: "", document: "" })).toBe(
      "« on tient »",
    );
  });
});

describe("toCsv", () => {
  const csv = toCsv(table);

  it("starts with a BOM, so Excel reads the accents", () => {
    // Without it every «é» in a French corpus opens as mojibake — the single most
    // common way a correct export looks broken.
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("names the three columns", () => {
    expect(csv.split("\r\n")[0]).toBe('﻿"Thème","Phrases","Analyse"');
  });

  it("leaves the analysis column empty", () => {
    for (const line of csv.trimEnd().split("\r\n").slice(1)) {
      expect(line.endsWith(',""')).toBe(true);
    }
  });

  it("escapes quotes inside a verbatim instead of ending the field", () => {
    expect(csv).toContain('""ça suffit""');
  });

  it("keeps a theme with no passages as a row", () => {
    // An empty theme is a finding: nothing in this corpus was read that way.
    expect(csv).toContain('"Institution","",""');
  });

  it("survives a round trip through a minimal RFC 4180 reader", () => {
    const records = parseCsv(csv.replace(/^﻿/, ""));
    expect(records).toHaveLength(3);
    expect(records[0]).toEqual(["Thème", "Phrases", "Analyse"]);
    expect(records[1][0]).toBe("Violence");
    // The two passages are one cell, blank-line separated, both attributed.
    expect(records[1][1].split("\n\n")).toHaveLength(2);
    expect(records[1][1]).toContain("— Cadre A, Entretien 1");
    expect(records[1][2]).toBe("");
  });
});

describe("exportFileName", () => {
  it("folds a title into something every filesystem accepts", () => {
    expect(exportFileName("Étude hôpital / 2026", "csv")).toBe(
      "Etude-hopital-2026.csv",
    );
  });

  it("falls back rather than producing a nameless file", () => {
    expect(exportFileName("///", "pdf")).toBe("excerpts.pdf");
  });
});

describe("excerptTableBlob", () => {
  it("writes a .docx holding a real three-column table", async () => {
    const blob = await excerptTableBlob(table, "docx");
    // A docx is a zip; anything else here means the writer produced a stub.
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    expect([head[0], head[1]]).toEqual([0x50, 0x4b]);

    // jszip rather than fflate: both are installed, but only jszip is a declared
    // dependency — fflate rides in under jspdf and would vanish on a bump.
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");

    // A TABLE, not paragraphs that look like one: the analysis column has to be a
    // cell you can put a caret in, which is the whole point of the Word export.
    expect(xml).toContain("<w:tbl>");
    // Header row + one row per theme.
    expect(xml.match(/<w:tr[ >]/g)).toHaveLength(1 + table.rows.length);
    for (const column of table.columns) expect(xml).toContain(column);
    expect(xml).toContain("on nous crie dessus");
    // The header repeats across pages; a three-page table whose columns are only
    // named on page one is unreadable.
    expect(xml).toContain("tblHeader");
  });

  it("writes a CSV blob whose BYTES carry the BOM", async () => {
    const blob = await excerptTableBlob(table, "csv");
    // Asserted on the bytes, not on `blob.text()`: the UTF-8 decoder strips a
    // leading BOM, so reading the blob back as text would hide the very thing
    // Excel needs to see.
    const head = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    expect([...head]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe(toCsv(table).replace(/^﻿/, ""));
  });

  // PDF is jsPDF, which needs a DOM. It is smoke-tested in the browser instead.
});

/** A deliberately literal RFC 4180 reader, so the test does not share the bug. */
function parseCsv(input: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\r" && input[i + 1] === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      i++;
    } else field += char;
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}
