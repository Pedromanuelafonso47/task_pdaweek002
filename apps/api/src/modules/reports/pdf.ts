import PDFDocument from 'pdfkit';

/** Pequeno construtor de documentos com a identidade visual AGROGENIUS. */
const C = { deep: '#123D2A', tech: '#27C77B', light: '#B7F3D0', ink: '#0B1511', grey: '#89958E', line: '#DDE6E0' };

export class ReportDoc {
  readonly doc: PDFKit.PDFDocument;
  private readonly margin = 48;

  constructor(title: string, subtitle: string) {
    this.doc = new PDFDocument({ size: 'A4', margin: this.margin, bufferPages: true, info: { Title: title, Author: 'AGROGENIUS' } });
    const d = this.doc;
    d.rect(0, 0, d.page.width, 110).fill(C.deep);
    d.circle(d.page.width - 70, 30, 90).fillOpacity(0.12).fill(C.tech).fillOpacity(1);
    d.fill(C.light).font('Helvetica-Bold').fontSize(10).text('AGROGENIUS', this.margin, 28, { characterSpacing: 2 });
    d.fill('#FFFFFF').fontSize(22).text(title, this.margin, 46);
    d.fill(C.light).font('Helvetica').fontSize(10).text(subtitle, this.margin, 76);
    d.y = 135;
    d.fill(C.ink);
  }

  section(title: string) {
    this.ensure(60);
    const d = this.doc;
    d.moveDown(0.6);
    d.font('Helvetica-Bold').fontSize(13).fill(C.deep).text(title);
    const y = d.y + 2;
    d.moveTo(this.margin, y).lineTo(this.margin + 40, y).lineWidth(2).stroke(C.tech);
    d.moveDown(0.6).fill(C.ink);
    return this;
  }

  note(text: string) {
    this.doc.font('Helvetica-Oblique').fontSize(8.5).fill(C.grey).text(text).moveDown(0.4).fill(C.ink);
    return this;
  }

  paragraph(text: string) {
    this.doc.font('Helvetica').fontSize(10).fill(C.ink).text(text, { lineGap: 2 }).moveDown(0.4);
    return this;
  }

  kv(pairs: [string, string][]) {
    const d = this.doc;
    const colW = (d.page.width - this.margin * 2) / 2;
    pairs.forEach(([k, v], i) => {
      if (i % 2 === 0) this.ensure(34);
      const x = this.margin + (i % 2) * colW;
      const y = i % 2 === 0 ? d.y : d.y - 30;
      d.font('Helvetica').fontSize(8).fill(C.grey).text(k.toUpperCase(), x, y, { width: colW - 10 });
      d.font('Helvetica-Bold').fontSize(11).fill(C.ink).text(v, x, y + 11, { width: colW - 10 });
      if (i % 2 === 0) d.y = y + 30;
    });
    d.x = this.margin;
    d.moveDown(0.5);
    return this;
  }

  table(headers: string[], rows: (string | number)[][], widths?: number[]) {
    const d = this.doc;
    const total = d.page.width - this.margin * 2;
    const w = widths ?? headers.map(() => total / headers.length);
    const drawRow = (cells: (string | number)[], header: boolean) => {
      const h = Math.max(...cells.map((c, i) => d.heightOfString(String(c), { width: w[i] - 8 }))) + 8;
      this.ensure(h + 4);
      const y = d.y;
      if (header) d.rect(this.margin, y, total, h).fill(C.deep);
      let x = this.margin;
      cells.forEach((c, i) => {
        d.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fill(header ? '#FFFFFF' : C.ink).text(String(c), x + 4, y + 4, { width: w[i] - 8 });
        x += w[i];
      });
      d.y = y + h;
      if (!header) d.moveTo(this.margin, d.y).lineTo(this.margin + total, d.y).lineWidth(0.5).stroke(C.line);
    };
    drawRow(headers, true);
    if (!rows.length) {
      d.font('Helvetica-Oblique').fontSize(9).fill(C.grey).text('Sem registos no período.', this.margin + 4, d.y + 6);
      d.moveDown(0.5);
    }
    rows.forEach((r) => drawRow(r, false));
    d.x = this.margin;
    d.moveDown(0.8);
    return this;
  }

  private ensure(h: number) {
    const d = this.doc;
    if (d.y + h > d.page.height - 70) d.addPage();
  }

  finish(): Promise<Buffer> {
    const d = this.doc;
    const range = d.bufferedPageRange();
    const stamp = new Intl.DateTimeFormat('pt-AO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Luanda' }).format(new Date());
    for (let i = range.start; i < range.start + range.count; i++) {
      d.switchToPage(i);
      const y = d.page.height - 40;
      d.font('Helvetica').fontSize(8).fill(C.grey);
      d.text(`Gerado por AGROGENIUS em ${stamp}`, this.margin, y, { lineBreak: false });
      d.text(`${i + 1} / ${range.count}`, d.page.width - this.margin - 40, y, { width: 40, align: 'right', lineBreak: false });
    }
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      d.on('data', (c: Buffer) => chunks.push(c));
      d.on('end', () => resolve(Buffer.concat(chunks)));
      d.on('error', reject);
      d.end();
    });
  }
}
