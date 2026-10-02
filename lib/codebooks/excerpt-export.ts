/**
 * The excerpt table, as a file you can take away.
 *
 * Thematic analysis ends in a document that looks the same everywhere: one row per
 * theme, the passages that support it, and a column for what the researcher makes of
 * them. That third column is deliberately EMPTY — the tool holds the evidence, the
 * interpretation is the researcher's, and shipping it pre-filled with anything (a
 * count, a summary) would be the software making a claim about the material.
 *
 * Three formats because they are three different uses, not three tastes: **PDF** to
 * circulate and annotate on paper, **Word** to write the analysis INTO (the empty
 * column is a real cell you type in), **CSV** to pivot in a spreadsheet or feed to
 * something else.
 *
 * This module is the pure half: a table in, bytes out. It never touches IndexedDB,
 * never resolves a label, and never downloads anything — which is what lets the
 * escaping, the grouping and the provenance line be tested without a browser.
 */

/** One passage under a theme. Everything a verbatim needs to be quotable. */
export type ExcerptPassage = {
  text: string;
  speaker: string;
  document: string;
  /**
   * Where the passage starts in the recording, `m:ss`, when the transcript is
   * aligned. A quote in an article is checkable only if the reader can get back
   * to the tape.
   */
  timecode?: string;
};

/** One row of the exported table: a theme and what was read as it. */
export type ExcerptTableRow = {
  theme: string;
  passages: ExcerptPassage[];
};

export type ExcerptTable = {
  /** Becomes the document's heading and the downloaded file's name. */
  title: string;
  /** Column headers, already translated — Thème / Phrases / Analyse. */
  columns: [string, string, string];
  rows: ExcerptTableRow[];
  /**
   * A line under the table saying what it is: the study, the filter, the date.
   * Absent from CSV, which is data rather than a document.
   */
  caption?: string;
};

/** `h:mm:ss`, or `m:ss` under an hour — how a timecode is said out loud. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * How a passage is written in the middle column.
 *
 * Guillemets and an em-dash rather than a table nested in a cell: this has to read
 * the same in a PDF, in a Word cell and in a spreadsheet cell, and only text does.
 * A verbatim without its speaker and its interview is not quotable, so the
 * attribution is part of the passage rather than a fourth column.
 */
export function formatPassage(passage: ExcerptPassage): string {
  const source = attributionOf(passage).replace(/^— /, "");
  return source ? `« ${passage.text} » — ${source}` : `« ${passage.text} »`;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * RFC 4180: quote every field, double the quotes inside it.
 *
 * Every field, not only the ones that need it — a verbatim contains commas,
 * quotation marks and newlines as a matter of course, and deciding per field is how
 * one passage with a semicolon in it silently shifts a whole column.
 */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsv(table: ExcerptTable): string {
  const lines = [table.columns.map(csvField).join(",")];
  for (const row of table.rows) {
    lines.push(
      [
        csvField(row.theme),
        // Blank-line separated inside one cell: a spreadsheet shows it as a
        // multi-line cell, which is the shape the row actually has.
        csvField(row.passages.map(formatPassage).join("\n\n")),
        csvField(""),
      ].join(","),
    );
  }
  // A BOM, because Excel reads a UTF-8 CSV as Latin-1 without one and turns every
  // French accent in the corpus into mojibake.
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------

/**
 * A real Word table — cells you can click into and type the analysis in.
 *
 * `docx` is already a dependency (the transcript exporter uses it) and is imported
 * dynamically: it is a large library, and nobody who never exports should download
 * it.
 */
export async function toDocxBlob(table: ExcerptTable): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const header = new TableRow({
    // Repeated at the top of every page: a three-page thematic table whose columns
    // are only named on page one is unreadable.
    tableHeader: true,
    children: table.columns.map(
      (label) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true })],
            }),
          ],
        }),
    ),
  });

  const rows = table.rows.map(
    (row) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: row.theme, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children:
              row.passages.length > 0
                ? row.passages.map(
                    (passage) =>
                      new Paragraph({
                        spacing: { after: 120 },
                        children: [
                          new TextRun({ text: `« ${passage.text} » ` }),
                          new TextRun({
                            text: attributionOf(passage),
                            italics: true,
                          }),
                        ],
                      }),
                  )
                : [new Paragraph({ text: "" })],
          }),
          // The analysis column: one empty paragraph, so the cell exists and has
          // somewhere to put a caret.
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: "" })],
          }),
        ],
      }),
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: table.title,
            heading: HeadingLevel.HEADING_1,
          }),
          ...(table.caption
            ? [
                new Paragraph({
                  spacing: { after: 240 },
                  children: [
                    new TextRun({
                      text: table.caption,
                      italics: true,
                      size: 18,
                    }),
                  ],
                }),
              ]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [header, ...rows],
          }),
          new Paragraph({ text: "", alignment: AlignmentType.LEFT }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

function attributionOf(passage: ExcerptPassage): string {
  const source = [passage.speaker, passage.document, passage.timecode]
    .filter(Boolean)
    .join(", ");
  return source ? `— ${source}` : "";
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PDF = {
  margin: 14,
  /** Column widths as a share of the printable width. */
  share: [0.2, 0.5, 0.3] as const,
  padding: 2,
  lineHeight: 4.4,
  headerHeight: 8,
};

/**
 * The same table, drawn.
 *
 * jsPDF has no table primitive and `jspdf-autotable` is not a dependency, so the
 * layout is done here: measure, wrap, break. The part that matters is the BREAK —
 * a theme with forty passages does not fit on a page, so its cell is split across
 * pages with the borders closed at the bottom and the header redrawn on top, rather
 * than the row being clipped or pushed whole onto a page it still does not fit.
 */
export async function toPdfBlob(table: ExcerptTable): Promise<Blob> {
  const { jsPDF } = await import("jspdf/dist/jspdf.umd.min.js");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - 2 * PDF.margin;
  const columns = PDF.share.map((share) => share * width);
  const x = [
    PDF.margin,
    PDF.margin + columns[0],
    PDF.margin + columns[0] + columns[1],
  ];
  const bottom = pageHeight - PDF.margin;

  let y = PDF.margin;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(table.title, PDF.margin, y + 4);
  y += 8;
  if (table.caption) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(110);
    doc.text(table.caption, PDF.margin, y + 2);
    doc.setTextColor(0);
    y += 6;
  }

  const drawHeader = () => {
    doc.setFillColor(244, 244, 245);
    doc.rect(PDF.margin, y, width, PDF.headerHeight, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    table.columns.forEach((label, i) => {
      doc.text(label, x[i] + PDF.padding, y + 5.5);
    });
    doc.setDrawColor(200);
    doc.rect(PDF.margin, y, width, PDF.headerHeight);
    y += PDF.headerHeight;
  };

  /** Close the three vertical rules of a row band, and its bottom edge. */
  const closeBand = (top: number, to: number) => {
    doc.setDrawColor(200);
    doc.line(PDF.margin, to, PDF.margin + width, to);
    for (const edge of [...x, PDF.margin + width]) {
      doc.line(edge, top, edge, to);
    }
  };

  drawHeader();

  /**
   * ONE cursor, `y`, moving down the page and never backwards.
   *
   * There was a second one here, tracking the passages column separately, and it
   * was the whole bug: a page break reset `y` to the top of the new page but left
   * the other cursor at the bottom of the old one, so every line after the first
   * overflow broke the page again. Twelve themes came out as 428 pages. Two
   * cursors over one flow is a mistake the layout does not need — the theme cell
   * is short and the passages cell is what sets the band's height, so the
   * passages ARE the flow.
   */
  for (const row of table.rows) {
    let bandTop = y;
    /** Where the band must reach to fit the theme cell, even with no passages. */
    let themeBottom = y;

    const newPage = () => {
      closeBand(bandTop, bottom);
      doc.addPage();
      y = PDF.margin;
      drawHeader();
      bandTop = y;
      themeBottom = y;
    };

    /** Room for `height` mm, or a fresh page with the header on it. */
    const ensure = (height: number) => {
      if (y + height + PDF.padding > bottom) newPage();
    };

    /**
     * The theme, at the top of the band it starts.
     *
     * Deliberately NOT repeated when a band continues onto the next page:
     * reprinting it reads as a second row for the same theme, and the column
     * header already says what the column is.
     */
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    const theme = doc.splitTextToSize(
      row.theme,
      columns[0] - 2 * PDF.padding,
    ) as string[];
    // Start a theme on a page with room for its cell and a line or two under it,
    // rather than orphaning a heading at the foot of a page.
    ensure((theme.length + 2) * PDF.lineHeight + PDF.padding);
    theme.forEach((line, i) => {
      doc.text(
        line,
        x[0] + PDF.padding,
        y + PDF.padding + (i + 1) * PDF.lineHeight - 1,
      );
    });
    themeBottom = y + theme.length * PDF.lineHeight + 2 * PDF.padding;

    y += PDF.padding;

    /** What one page can hold below its header — the tallest atomic passage. */
    const pageBody = bottom - PDF.margin - PDF.headerHeight - 2 * PDF.padding;

    for (const passage of row.passages) {
      doc.setFontSize(9);
      const body = doc.splitTextToSize(
        `« ${passage.text} »`,
        columns[1] - 2 * PDF.padding,
      ) as string[];
      const attribution = attributionOf(passage);

      // Keep a passage whole when a page can hold it. Breaking line-by-line left
      // an attribution stranded at the top of the next page, under an empty theme
      // cell — a quote and the person who said it are one thing, and a verbatim
      // separated from its speaker is worse than a page turn.
      const height =
        body.length * PDF.lineHeight + (attribution ? PDF.lineHeight : 0) + 1.2;
      if (height <= pageBody) ensure(height);

      for (const line of body) {
        ensure(PDF.lineHeight);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text(line, x[1] + PDF.padding, y + PDF.lineHeight - 1);
        y += PDF.lineHeight;
      }

      if (attribution) {
        ensure(PDF.lineHeight);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120);
        doc.text(attribution, x[1] + PDF.padding, y + PDF.lineHeight - 1.4);
        doc.setTextColor(0);
        y += PDF.lineHeight;
      }
      y += 1.2;
    }
    if (row.passages.length === 0) y += PDF.lineHeight;

    y = Math.max(y + PDF.padding, themeBottom);
    closeBand(bandTop, y);
  }

  return doc.output("blob") as Blob;
}

// ---------------------------------------------------------------------------
// Downloading
// ---------------------------------------------------------------------------

export type ExcerptExportFormat = "csv" | "docx" | "pdf";

export const EXCERPT_EXPORT_FORMATS: ExcerptExportFormat[] = [
  "pdf",
  "docx",
  "csv",
];

/** A title that is safe as a file name on every platform. */
export function exportFileName(
  title: string,
  format: ExcerptExportFormat,
): string {
  const base =
    title
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "excerpts";
  return `${base}.${format}`;
}

export async function excerptTableBlob(
  table: ExcerptTable,
  format: ExcerptExportFormat,
): Promise<Blob> {
  switch (format) {
    case "csv":
      return new Blob([toCsv(table)], { type: "text/csv;charset=utf-8" });
    case "docx":
      return toDocxBlob(table);
    case "pdf":
      return toPdfBlob(table);
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
