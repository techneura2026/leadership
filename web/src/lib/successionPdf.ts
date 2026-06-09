// All imports are dynamic — this file must never execute at SSR time.

import { ReadinessRating } from '@leaderprism/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuccessionCandidate {
  id: string;
  name: string;
  title: string;
  department: string;
  performance: 'high' | 'medium' | 'low';
  potential: 'high' | 'medium' | 'low';
  readinessRating: ReadinessRating;
  compositeScore: number;
  keyStrengths: string[];
  developmentAreas: string[];
  completedAssessments?: string[];
}

export interface SuccessionSuccessor {
  candidateId: string;
  name: string;
  readiness: ReadinessRating;
  compositeScore: number;
}

export interface SuccessionKeyRole {
  id: string;
  title: string;
  department: string;
  incumbent: string;
  incumbentTenure: string;
  criticality: 'critical' | 'high' | 'medium';
  successors: SuccessionSuccessor[];
}

export interface SuccessionDeptBench {
  department: string;
  totalRoles: number;
  coveredRoles: number;
  readyNow: number;
  oneTwoYears: number;
  developing: number;
}

export interface SuccessionReportData {
  organisationName?: string;
  generatedAt: string;
  candidates: SuccessionCandidate[];
  keyRoles: SuccessionKeyRole[];
  bench: SuccessionDeptBench[];
}

// ── Colour palette ────────────────────────────────────────────────────────────

const C = {
  brand:  [37,  99,  235] as [number, number, number],
  dark:   [17,  24,  39]  as [number, number, number],
  mid:    [107, 114, 128] as [number, number, number],
  light:  [243, 244, 246] as [number, number, number],
  white:  [255, 255, 255] as [number, number, number],
  green:  [22,  163, 74]  as [number, number, number],
  amber:  [217, 119, 6]   as [number, number, number],
  red:    [220, 38,  38]  as [number, number, number],
  indigo: [99,  102, 241] as [number, number, number],
};

const READINESS_LABELS: Record<ReadinessRating, string> = {
  [ReadinessRating.READY_NOW]:     'Ready Now',
  [ReadinessRating.ONE_TWO_YEARS]: '1–2 Years',
  [ReadinessRating.DEVELOPING]:    'Developing',
  [ReadinessRating.NOT_YET_READY]: 'Not Yet Ready',
};

const CRITICALITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
};

// ── Drawing helpers ───────────────────────────────────────────────────────────

type Doc = import('jspdf').jsPDF;

const PW = 210;
const PH = 297;
const ML = 18;
const MR = 18;
const CW = PW - ML - MR;

function setFill(doc: Doc, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]); }
function setStroke(doc: Doc, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }
function setTxt(doc: Doc, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }

function hBar(doc: Doc, x: number, y: number, score: number, max: number, w = 60, h = 5) {
  setFill(doc, C.light);
  doc.roundedRect(x, y, w, h, 1, 1, 'F');
  const pct = score / max;
  const filled = Math.max(pct * w, 2);
  const colour = pct >= 0.75 ? C.green : pct >= 0.5 ? C.brand : C.amber;
  setFill(doc, colour);
  doc.roundedRect(x, y, filled, h, 1, 1, 'F');
}

function sectionHead(doc: Doc, text: string, y: number, colour = C.brand): number {
  setFill(doc, colour);
  doc.rect(ML, y, 3, 7, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
  doc.text(text, ML + 7, y + 5.5);
  setStroke(doc, C.light); doc.setLineWidth(0.4);
  doc.line(ML + 7, y + 8, PW - MR, y + 8);
  return y + 14;
}

function statBox(doc: Doc, x: number, y: number, w: number, h: number, label: string, value: string, accent = C.brand) {
  setFill(doc, C.light); doc.roundedRect(x, y, w, h, 2, 2, 'F');
  setFill(doc, accent);  doc.roundedRect(x, y, w, 2.5, 1, 1, 'F');
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); setTxt(doc, accent);
  doc.text(value, x + w / 2, y + h / 2 + 1.5, { align: 'center' });
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text(label.toUpperCase(), x + w / 2, y + h - 5, { align: 'center' });
}

function addPageDecor(doc: Doc, pg: number, total: number) {
  setFill(doc, C.brand); doc.rect(0, 0, PW, 10, 'F');
  setFill(doc, C.light); doc.rect(0, PH - 14, PW, 14, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text('LeaderPrism  |  Succession Planning Report  |  Confidential', ML, PH - 5.5);
  doc.text(`Page ${pg} of ${total}`, PW - MR, PH - 5.5, { align: 'right' });
}

// ── Cover page ────────────────────────────────────────────────────────────────

function drawCover(doc: Doc, data: SuccessionReportData) {
  setFill(doc, C.brand); doc.rect(0, 0, PW, 68, 'F');
  setFill(doc, C.indigo); doc.rect(0, 58, PW, 10, 'F');

  doc.setFontSize(15); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text('LeaderPrism', ML, 22);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text('360° Leadership Assessment Platform', ML, 30);

  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text('SUCCESSION PLANNING REPORT', ML, 50);

  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
  doc.text('Succession Planning', ML, 88);
  doc.setFontSize(14); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text('Leadership Talent Pipeline & Bench Strength Analysis', ML, 99);

  setFill(doc, C.indigo); doc.rect(ML, 105, 32, 2, 'F');

  const cardY = 115;
  setFill(doc, C.light); doc.roundedRect(ML, cardY, CW, 44, 3, 3, 'F');
  setFill(doc, C.indigo); doc.roundedRect(ML, cardY, 4, 44, 2, 2, 'F');

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text('ORGANISATION', ML + 10, cardY + 10);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
  doc.text(data.organisationName ?? 'LeaderPrism Demo Org', ML + 10, cardY + 19);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text(`Generated:  ${data.generatedAt}`, ML + 10, cardY + 29);
  doc.text(`Total Candidates:  ${data.candidates.length}     Key Roles:  ${data.keyRoles.length}     Departments:  ${data.bench.length}`, ML + 10, cardY + 37);

  setFill(doc, C.brand); doc.rect(0, PH - 18, PW, 18, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setTxt(doc, C.white);
  doc.text('CONFIDENTIAL  —  For authorised recipients only', PW / 2, PH - 7, { align: 'center' });
}

// ── Page 2: Executive Overview ────────────────────────────────────────────────

function buildOverview(doc: Doc, data: SuccessionReportData, autoTable: (d: Doc, o: object) => void) {
  const { candidates, keyRoles, bench } = data;
  const readyNow   = candidates.filter(c => c.readinessRating === ReadinessRating.READY_NOW).length;
  const hiPos      = candidates.filter(c => c.potential === 'high').length;
  const coveredPct = Math.round((keyRoles.filter(r => r.successors.length > 0).length / keyRoles.length) * 100);

  doc.addPage();
  let y = 24;
  y = sectionHead(doc, 'Executive Overview', y, C.indigo);

  const bw = 38, bh = 28, bg = 5;
  [
    { l: 'Total Candidates',  v: `${candidates.length}`,  col: C.brand },
    { l: 'Ready Now',         v: `${readyNow}`,           col: C.green },
    { l: 'High Potential',    v: `${hiPos}`,              col: C.amber },
    { l: 'Role Coverage',     v: `${coveredPct}%`,        col: C.indigo },
  ].forEach((s, i) => statBox(doc, ML + i * (bw + bg), y, bw, bh, s.l, s.v, s.col));
  y += bh + 12;

  // Readiness distribution
  y = sectionHead(doc, 'Readiness Distribution', y, C.indigo);
  const readinessOrder = [
    ReadinessRating.READY_NOW,
    ReadinessRating.ONE_TWO_YEARS,
    ReadinessRating.DEVELOPING,
    ReadinessRating.NOT_YET_READY,
  ];
  const readinessColours: Record<ReadinessRating, [number,number,number]> = {
    [ReadinessRating.READY_NOW]:     C.green,
    [ReadinessRating.ONE_TWO_YEARS]: C.amber,
    [ReadinessRating.DEVELOPING]:    C.brand,
    [ReadinessRating.NOT_YET_READY]: C.mid,
  };

  readinessOrder.forEach(rating => {
    const count = candidates.filter(c => c.readinessRating === rating).length;
    const pct   = Math.round((count / candidates.length) * 100);
    const col   = readinessColours[rating];

    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    doc.text(READINESS_LABELS[rating], ML, y + 4);

    setFill(doc, C.light); doc.roundedRect(ML + 42, y, 100, 5.5, 1, 1, 'F');
    setFill(doc, col);     doc.roundedRect(ML + 42, y, Math.max(pct, 1), 5.5, 1, 1, 'F');

    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
    doc.text(`${count}`, ML + 147, y + 4.5);
    doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
    doc.text(`${pct}%`, ML + 156, y + 4.5);
    y += 10;
  });
  y += 8;

  // Bench strength table
  y = sectionHead(doc, 'Bench Strength by Department', y, C.indigo);
  autoTable(doc, {
    startY: y,
    head: [['Department', 'Total Roles', 'Covered', 'Ready Now', '1–2 Years', 'Developing', 'Coverage %']],
    body: bench.map(d => [
      d.department,
      d.totalRoles,
      d.coveredRoles,
      d.readyNow   > 0 ? d.readyNow   : '—',
      d.oneTwoYears > 0 ? d.oneTwoYears : '—',
      d.developing  > 0 ? d.developing  : '—',
      `${Math.round((d.coveredRoles / d.totalRoles) * 100)}%`,
    ]),
    styles:             { fontSize: 8.5, cellPadding: 3 },
    headStyles:         { fillColor: C.indigo, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles:       { 0: { fontStyle: 'bold', cellWidth: 38 } },
    margin:             { left: ML, right: MR },
  });
}

// ── Page 3: Key Roles & Succession Pipeline ───────────────────────────────────

function buildKeyRoles(doc: Doc, data: SuccessionReportData, autoTable: (d: Doc, o: object) => void) {
  const { keyRoles } = data;

  doc.addPage();
  let y = 24;
  y = sectionHead(doc, 'Key Roles & Succession Pipeline', y, C.indigo);

  // Summary note
  const gaps = keyRoles.filter(r => r.successors.length === 0).length;
  if (gaps > 0) {
    setFill(doc, [254, 226, 226]); doc.roundedRect(ML, y, CW, 10, 1.5, 1.5, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.red);
    doc.text(`⚠  ${gaps} role${gaps > 1 ? 's have' : ' has'} no identified successor — immediate succession planning required.`, ML + 4, y + 6.5);
    y += 14;
  }

  autoTable(doc, {
    startY: y,
    head: [['Role', 'Dept', 'Criticality', 'Incumbent', 'Tenure', '#']],
    body: keyRoles.map(r => [
      r.title,
      r.department,
      CRITICALITY_LABELS[r.criticality],
      r.incumbent,
      r.incumbentTenure,
      r.successors.length > 0 ? r.successors.length : 'None',
    ]),
    styles:             { fontSize: 8, cellPadding: 3 },
    headStyles:         { fillColor: C.indigo, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles:       { 0: { fontStyle: 'bold', cellWidth: 52 }, 1: { cellWidth: 26 }, 2: { cellWidth: 22 } },
    margin:             { left: ML, right: MR },
    didParseCell: (h: any) => {
      if (h.column.index === 2 && h.section === 'body') {
        if (h.cell.raw === 'Critical') h.cell.styles.textColor = C.red;
        if (h.cell.raw === 'High')     h.cell.styles.textColor = C.amber;
      }
      if (h.column.index === 5 && h.section === 'body') {
        if (h.cell.raw === 'None') h.cell.styles.textColor = C.red;
      }
    },
  });

  const tableEndY = (doc as any).lastAutoTable?.finalY ?? y + 10;
  y = tableEndY + 14;

  // Successor details per role
  if (y + 40 > PH - 20) { doc.addPage(); y = 24; }
  y = sectionHead(doc, 'Successor Detail by Role', y, C.indigo);

  for (const role of keyRoles) {
    if (y + 30 > PH - 20) { doc.addPage(); y = 24; }

    const critCol = role.criticality === 'critical' ? C.red : role.criticality === 'high' ? C.amber : C.brand;
    setFill(doc, C.light); doc.roundedRect(ML, y, CW, 9, 1.5, 1.5, 'F');
    setFill(doc, critCol); doc.rect(ML, y, 3, 9, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
    doc.text(role.title, ML + 6, y + 6);
    doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
    doc.text(`${role.department}  ·  ${CRITICALITY_LABELS[role.criticality]}  ·  Incumbent: ${role.incumbent} (${role.incumbentTenure})`, ML + 6 + doc.getTextWidth(role.title) + 4, y + 6);
    y += 11;

    if (role.successors.length === 0) {
      setFill(doc, [254, 226, 226]); doc.roundedRect(ML + 4, y, CW - 4, 8, 1, 1, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); setTxt(doc, C.red);
      doc.text('No successors identified.', ML + 8, y + 5.5);
      y += 11;
    } else {
      role.successors.forEach((s, idx) => {
        if (y + 10 > PH - 20) { doc.addPage(); y = 24; }
        const rCol = s.readiness === ReadinessRating.READY_NOW ? C.green
          : s.readiness === ReadinessRating.ONE_TWO_YEARS      ? C.amber
          : C.mid;
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
        doc.text(`#${idx + 1}`, ML + 6, y + 5.5);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
        doc.text(s.name, ML + 14, y + 5.5);
        doc.setFont('helvetica', 'normal'); setTxt(doc, rCol);
        doc.text(READINESS_LABELS[s.readiness], ML + 14 + doc.getTextWidth(s.name) + 4, y + 5.5);
        hBar(doc, ML + 90, y + 1, s.compositeScore, 100, 60, 5);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.brand);
        doc.text(`${s.compositeScore.toFixed(1)}`, ML + 154, y + 5.5);
        y += 9;
      });
    }
    y += 4;
  }
}

// ── Page N: Talent Pool ───────────────────────────────────────────────────────

function buildTalentPool(doc: Doc, data: SuccessionReportData, autoTable: (d: Doc, o: object) => void) {
  const { candidates } = data;

  doc.addPage();
  let y = 24;
  y = sectionHead(doc, 'Talent Pool — Full Candidate Listing', y, C.indigo);

  const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  autoTable(doc, {
    startY: y,
    head: [['Candidate', 'Title', 'Dept', 'Perf', 'Potential', 'Readiness', 'Score', 'Key Strengths']],
    body: candidates.map(c => [
      c.name,
      c.title,
      c.department,
      capFirst(c.performance),
      capFirst(c.potential),
      READINESS_LABELS[c.readinessRating],
      c.compositeScore.toFixed(1),
      c.keyStrengths.slice(0, 2).join(', '),
    ]),
    styles:             { fontSize: 7.5, cellPadding: 2.5 },
    headStyles:         { fillColor: C.indigo, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 34 },
      2: { cellWidth: 22 },
      3: { cellWidth: 13 },
      4: { cellWidth: 16 },
      5: { cellWidth: 20 },
      6: { cellWidth: 12 },
      7: { cellWidth: CW - 147 },
    },
    margin: { left: ML, right: MR },
    didParseCell: (h: any) => {
      if (h.section !== 'body') return;
      if (h.column.index === 3) {
        if (h.cell.raw === 'High')   h.cell.styles.textColor = C.green;
        if (h.cell.raw === 'Low')    h.cell.styles.textColor = C.red;
      }
      if (h.column.index === 4) {
        if (h.cell.raw === 'High')   h.cell.styles.textColor = C.green;
        if (h.cell.raw === 'Low')    h.cell.styles.textColor = C.red;
      }
      if (h.column.index === 5) {
        if (h.cell.raw === 'Ready Now') h.cell.styles.textColor = C.green;
        if (h.cell.raw === 'Not Yet Ready') h.cell.styles.textColor = C.red;
      }
    },
  });
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function generateSuccessionPdf(data: SuccessionReportData): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const at  = (d: Doc, o: object) => autoTable(d, o);

  drawCover(doc, data);
  buildOverview(doc, data, at);
  buildKeyRoles(doc, data, at);
  buildTalentPool(doc, data, at);

  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    addPageDecor(doc, i - 1, total - 1);
  }

  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `leaderprism-succession-${data.generatedAt.replace(/\s|,/g, '-').toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
