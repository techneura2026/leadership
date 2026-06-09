// All imports are dynamic — this file must never execute at SSR time.

export interface ReportData {
  id: string;
  participantName: string;
  participantRole: string;
  assessmentTitle: string;
  reportType: 'individual_360' | 'competency' | 'personality' | 'readiness';
  generatedAt: string;
  organisationName?: string;
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const C = {
  brand:   [37,  99,  235] as [number,number,number],
  dark:    [17,  24,  39]  as [number,number,number],
  mid:     [107, 114, 128] as [number,number,number],
  light:   [243, 244, 246] as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
  green:   [22,  163, 74]  as [number,number,number],
  amber:   [217, 119, 6]   as [number,number,number],
  purple:  [124, 58,  237] as [number,number,number],
  orange:  [234, 88,  12]  as [number,number,number],
  teal:    [5,   150, 105] as [number,number,number],
};

const TYPE_COLOURS: Record<string, [number,number,number]> = {
  individual_360: C.brand,
  competency:     C.teal,
  personality:    C.purple,
  readiness:      C.orange,
};

const TYPE_LABELS: Record<string, string> = {
  individual_360: '360° Feedback Report',
  competency:     'Competency Profile Report',
  personality:    'Personality Profile Report',
  readiness:      'Leadership Readiness Report',
};

// ─── Mock data ────────────────────────────────────────────────────────────────

function mockCompetencyScores(name: string) {
  const s = name.length % 5;
  return [
    { label: 'Strategic Thinking',     self: 4.2, mgr: 3.8, peers: 4.0, reports: 3.7 },
    { label: 'Communication',          self: 4.5, mgr: 4.2, peers: 4.3, reports: 4.4 },
    { label: 'Team Leadership',        self: 3.9, mgr: 4.1, peers: 3.8, reports: 4.2 },
    { label: 'Decision Making',        self: 4.0, mgr: 3.7, peers: 3.9, reports: 3.6 },
    { label: 'Change Management',      self: 3.5, mgr: 3.3, peers: 3.6, reports: 3.4 },
    { label: 'Coaching & Development', self: 4.1, mgr: 4.0, peers: 3.8, reports: 4.3 },
    { label: 'Results Orientation',    self: 4.3, mgr: 4.5, peers: 4.2, reports: 4.0 },
  ].map((row) => {
    const overall = +((row.self * 0.2 + row.mgr * 0.3 + row.peers * 0.3 + row.reports * 0.2) + s * 0.02).toFixed(1);
    return { ...row, overall: Math.min(5, overall) };
  });
}

function mockBigFive(name: string) {
  const s = name.charCodeAt(0) % 13;
  return [
    { dim: 'Openness to Experience', score: Math.min(100, 72 + s),     desc: 'Curious, imaginative, and open to new ideas. Seeks novel experiences and appreciates abstract thinking.' },
    { dim: 'Conscientiousness',      score: Math.min(100, 81 + s - 3), desc: 'Organised, reliable, and goal-directed. Strong self-discipline with a systematic approach to work.' },
    { dim: 'Extraversion',           score: Math.min(100, 65 + s + 2), desc: 'Sociable and energised by interactions. Comfortable in group settings with assertive communication.' },
    { dim: 'Agreeableness',          score: Math.min(100, 74 + s - 1), desc: 'Cooperative and empathetic. Prioritises harmonious relationships and attends to others\' needs.' },
    { dim: 'Emotional Stability',    score: Math.min(100, 68 + s + 4), desc: 'Resilient under pressure. Manages stress effectively and maintains composure in challenging situations.' },
  ];
}

function mockReadiness(name: string) {
  const s = name.charCodeAt(0) % 10;
  return [
    { dim: 'Leadership Vision',      score: Math.min(100, 78 + s), weight: 0.20 },
    { dim: 'Execution Capability',   score: Math.min(100, 82 + s), weight: 0.20 },
    { dim: 'People Influence',       score: Math.min(100, 74 + s), weight: 0.20 },
    { dim: 'Strategic Agility',      score: Math.min(100, 71 + s), weight: 0.15 },
    { dim: 'Innovation Mindset',     score: Math.min(100, 69 + s), weight: 0.15 },
    { dim: 'Resilience & Wellbeing', score: Math.min(100, 80 + s), weight: 0.10 },
  ];
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

type Doc = import('jspdf').jsPDF;

const PW = 210; // A4 width mm
const PH = 297; // A4 height mm
const ML = 18;  // left margin
const MR = 18;  // right margin
const CW = PW - ML - MR; // content width

function setFill(doc: Doc, c: [number,number,number]) { doc.setFillColor(c[0], c[1], c[2]); }
function setStroke(doc: Doc, c: [number,number,number]) { doc.setDrawColor(c[0], c[1], c[2]); }
function setTxt(doc: Doc, c: [number,number,number]) { doc.setTextColor(c[0], c[1], c[2]); }

function hBar(doc: Doc, x: number, y: number, score: number, max: number, w = 65, h = 5) {
  setFill(doc, C.light);
  doc.roundedRect(x, y, w, h, 1, 1, 'F');
  const filled = Math.max((score / max) * w, 2);
  const colour = score / max >= 0.75 ? C.green : score / max >= 0.5 ? C.brand : C.amber;
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
  setFill(doc, accent); doc.roundedRect(x, y, w, 2.5, 1, 1, 'F');
  doc.setFontSize(15); doc.setFont('helvetica', 'bold'); setTxt(doc, accent);
  doc.text(value, x + w / 2, y + h / 2 + 2, { align: 'center' });
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text(label.toUpperCase(), x + w / 2, y + h - 5, { align: 'center' });
}

function addPageDecor(doc: Doc, subtitle: string, pg: number, total: number) {
  setFill(doc, C.brand); doc.rect(0, 0, PW, 10, 'F');
  setFill(doc, C.light); doc.rect(0, PH - 14, PW, 14, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text('LeaderPrism  |  Confidential', ML, PH - 5.5);
  doc.text(subtitle, PW / 2, PH - 5.5, { align: 'center' });
  doc.text(`Page ${pg} of ${total}`, PW - MR, PH - 5.5, { align: 'right' });
}

function autoY(doc: Doc): number {
  return (doc as any).lastAutoTable?.finalY ?? 0;
}

function needsPage(doc: Doc, y: number, needed = 30): { doc: Doc; y: number } {
  if (y + needed > PH - 20) { doc.addPage(); return { doc, y: 24 }; }
  return { doc, y };
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function drawCover(doc: Doc, data: ReportData, typeLabel: string, accent: [number,number,number]) {
  // Header band
  setFill(doc, C.brand); doc.rect(0, 0, PW, 68, 'F');
  setFill(doc, accent);  doc.rect(0, 58, PW, 10, 'F');

  // Brand
  doc.setFontSize(15); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text('LeaderPrism', ML, 22);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text('360° Leadership Assessment Platform', ML, 30);

  // Type label
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text(typeLabel.toUpperCase(), ML, 50);

  // Assessment title
  doc.setFontSize(19); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
  const titleLines = doc.splitTextToSize(data.assessmentTitle, CW) as string[];
  doc.text(titleLines, ML, 88);
  const afterTitle = 88 + titleLines.length * 8.5;

  // Accent rule
  setFill(doc, accent); doc.rect(ML, afterTitle + 5, 28, 2, 'F');

  // Participant card
  const cardY = afterTitle + 14;
  setFill(doc, C.light); doc.roundedRect(ML, cardY, CW, 38, 3, 3, 'F');
  setFill(doc, accent);  doc.roundedRect(ML, cardY, 4, 38, 2, 2, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text('PREPARED FOR', ML + 10, cardY + 11);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
  doc.text(data.participantName, ML + 10, cardY + 20);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
  doc.text(data.participantRole, ML + 10, cardY + 29);

  // Metadata
  const metaY = cardY + 50;
  doc.setFontSize(8.5); setTxt(doc, C.mid);
  doc.text(`Organisation:  ${data.organisationName ?? 'LeaderPrism Demo Org'}`, ML, metaY);
  doc.text(`Generated:       ${data.generatedAt}`, ML, metaY + 7);

  // Footer band
  setFill(doc, C.brand); doc.rect(0, PH - 18, PW, 18, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setTxt(doc, C.white);
  doc.text('CONFIDENTIAL  —  For authorised recipients only', PW / 2, PH - 7, { align: 'center' });
}

// ─── 360° Feedback ───────────────────────────────────────────────────────────

function build360(doc: Doc, data: ReportData, autoTable: (d: Doc, o: object) => void) {
  const scores = mockCompetencyScores(data.participantName);
  const overall = +(scores.reduce((s, c) => s + c.overall, 0) / scores.length).toFixed(1);
  const best  = [...scores].sort((a, b) => b.overall - a.overall)[0];
  const worst = [...scores].sort((a, b) => a.overall - b.overall)[0];
  const fn = data.participantName.split(' ')[0];

  // ── Page 2: Summary ──────────────────────────────────────────────────────
  doc.addPage();
  let y = 24;
  y = sectionHead(doc, 'Executive Summary', y);

  const bw = 38, bh = 28, bg = 5;
  [
    { l: 'Overall Score', v: `${overall}/5.0` },
    { l: 'Rater Groups',  v: '4' },
    { l: 'Response Rate', v: '87%' },
    { l: 'Raters',        v: '12' },
  ].forEach((s, i) => statBox(doc, ML + i * (bw + bg), y, bw, bh, s.l, s.v));
  y += bh + 10;

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
  const intro = doc.splitTextToSize(
    `This 360° Feedback Report presents a comprehensive view of ${data.participantName}'s leadership effectiveness as perceived by ` +
    `their manager, peers, and direct reports alongside a self-assessment. The overall score of ${overall}/5.0 indicates strong ` +
    `performance across most competency areas. The highest-rated competency is "${best.label}" (${best.overall}/5.0) and the ` +
    `primary development area is "${worst.label}" (${worst.overall}/5.0).`, CW,
  ) as string[];
  doc.text(intro, ML, y);
  y += intro.length * 5.5 + 10;

  // Competency table
  y = sectionHead(doc, 'Competency Scores by Rater Group', y);
  autoTable(doc, {
    startY: y,
    head: [['Competency', 'Self', 'Manager', 'Peers', 'Direct Rep.', 'Overall']],
    body: scores.map((s) => [s.label, s.self.toFixed(1), s.mgr.toFixed(1), s.peers.toFixed(1), s.reports.toFixed(1), s.overall.toFixed(1)]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: C.brand, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 58 }, 5: { fontStyle: 'bold', textColor: C.brand } },
    margin: { left: ML, right: MR },
  });
  y = autoY(doc) + 12;

  // Visual bars
  ({ y } = needsPage(doc, y, scores.length * 11 + 30));
  y = sectionHead(doc, 'Visual Score Overview', y);
  scores.forEach((s) => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    doc.text(s.label, ML, y + 4);
    hBar(doc, 95, y, s.overall, 5, 68, 5.5);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.brand);
    doc.text(`${s.overall}/5`, 168, y + 4.5);
    doc.setFont('helvetica', 'normal');
    y += 10;
  });

  // ── Page 3: Qualitative ──────────────────────────────────────────────────
  doc.addPage();
  y = 24;
  y = sectionHead(doc, 'Key Strengths Identified by Raters', y);

  [
    `${fn} consistently demonstrates clear, structured communication that keeps teams aligned and informed.`,
    'Strong results orientation — delivers on commitments and maintains high standards even under tight deadlines.',
    'Effective coaching style; creates psychological safety and encourages team members to take ownership.',
    'Recognised by peers for strategic clarity when setting team direction and prioritising initiatives.',
  ].forEach((s) => {
    setFill(doc, [220, 252, 231]); doc.roundedRect(ML, y, CW, 10, 1.5, 1.5, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, [21, 128, 61] as any);
    doc.text(`✓  ${s}`, ML + 4, y + 6.5);
    y += 13;
  });

  y += 4;
  y = sectionHead(doc, 'Development Opportunities', y);
  [
    'Change Management: Build confidence in leading teams through organisational transitions and uncertainty.',
    'Strategic Thinking: Invest time in longer-horizon planning and engaging with cross-functional strategy discussions.',
    'Seek regular feedback loops — alignment between self-perception and rater perspectives can be strengthened.',
  ].forEach((s) => {
    setFill(doc, [255, 237, 213]); doc.roundedRect(ML, y, CW, 10, 1.5, 1.5, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, [154, 52, 18] as any);
    doc.text(`→  ${s}`, ML + 4, y + 6.5);
    y += 13;
  });

  y += 6;
  y = sectionHead(doc, 'Selected Rater Comments', y);
  [
    { src: 'Manager',       txt: `"${fn} brings a calm, structured energy to complex problems. A reliable strategic partner."` },
    { src: 'Peer',          txt: '"Always willing to share knowledge and credit. Elevates the whole team."' },
    { src: 'Direct Report', txt: '"Clear expectations and genuine interest in our development. One of the best managers I\'ve had."' },
    { src: 'Peer',          txt: '"Could be more proactive in change situations — sometimes needs encouragement to move forward."' },
  ].forEach((c) => {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.mid);
    doc.text(c.src.toUpperCase(), ML, y);
    y += 5;
    doc.setFont('helvetica', 'italic'); setTxt(doc, C.dark);
    const lines = doc.splitTextToSize(c.txt, CW - 6) as string[];
    doc.text(lines, ML + 4, y);
    y += lines.length * 5 + 6;
  });
}

// ─── Competency Profile ───────────────────────────────────────────────────────

function buildCompetency(doc: Doc, data: ReportData, autoTable: (d: Doc, o: object) => void) {
  const scores = mockCompetencyScores(data.participantName);
  const overall = +(scores.reduce((s, c) => s + c.overall, 0) / scores.length).toFixed(1);
  const level = overall >= 4.2 ? 'Advanced' : overall >= 3.5 ? 'Proficient' : 'Developing';

  doc.addPage();
  let y = 24;
  y = sectionHead(doc, 'Competency Profile Summary', y, C.teal);

  [
    { l: 'Overall Score', v: `${overall}/5.0` },
    { l: 'Competencies',  v: `${scores.length}` },
    { l: 'Proficiency',   v: level },
  ].forEach((s, i) => statBox(doc, ML + i * 60, y, 54, 28, s.l, s.v, C.teal));
  y += 38;

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
  const intro = doc.splitTextToSize(
    `This Competency Profile Report evaluates ${data.participantName} against the LeaderPrism Leadership Competency Framework. ` +
    `An overall proficiency of ${overall}/5.0 places this leader at the ${level} level across the assessed competency domains.`, CW,
  ) as string[];
  doc.text(intro, ML, y);
  y += intro.length * 5.5 + 10;

  y = sectionHead(doc, 'Competency Framework Scores', y, C.teal);
  autoTable(doc, {
    startY: y,
    head: [['Competency', 'Score', 'Level', 'Priority']],
    body: scores.map((s) => [
      s.label,
      `${s.overall.toFixed(1)} / 5.0`,
      s.overall >= 4.2 ? 'Advanced' : s.overall >= 3.5 ? 'Proficient' : 'Developing',
      s.overall < 3.5 ? 'High Development' : s.overall < 4.0 ? 'Continue Growth' : 'Leverage Strength',
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: C.teal, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } },
    margin: { left: ML, right: MR },
    didParseCell: (h: any) => {
      if (h.column.index === 2 && h.section === 'body') {
        if (h.cell.raw === 'Advanced')   h.cell.styles.textColor = C.green;
        if (h.cell.raw === 'Developing') h.cell.styles.textColor = C.amber;
      }
    },
  });
  y = autoY(doc) + 12;

  ({ y } = needsPage(doc, y, scores.length * 11 + 30));
  y = sectionHead(doc, 'Visual Score Overview', y, C.teal);
  scores.forEach((s) => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    doc.text(s.label, ML, y + 4);
    hBar(doc, 95, y, s.overall, 5, 68, 5.5);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.teal);
    doc.text(`${s.overall}/5`, 168, y + 4.5);
    doc.setFont('helvetica', 'normal');
    y += 10;
  });

  doc.addPage();
  y = 24;
  y = sectionHead(doc, 'Key Behavioural Indicators', y, C.teal);
  [
    { comp: 'Communication',      inds: ['Structures messages clearly for different audiences', 'Listens actively and confirms understanding', 'Delivers difficult feedback constructively'] },
    { comp: 'Team Leadership',    inds: ['Sets clear expectations and holds accountability', 'Builds psychological safety within the team', 'Recognises and leverages individual strengths'] },
    { comp: 'Results Orientation',inds: ['Maintains focus on priority outcomes', 'Identifies and removes blockers proactively', 'Delivers consistently against commitments'] },
  ].forEach((item) => {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); setTxt(doc, C.teal);
    doc.text(item.comp, ML, y);
    y += 5.5;
    item.inds.forEach((ind) => {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
      doc.text(`•  ${ind}`, ML + 5, y);
      y += 5.5;
    });
    y += 4;
  });
}

// ─── Personality ─────────────────────────────────────────────────────────────

function buildPersonality(doc: Doc, data: ReportData, autoTable: (d: Doc, o: object) => void) {
  const dims = mockBigFive(data.participantName);
  const fn = data.participantName.split(' ')[0];

  doc.addPage();
  let y = 24;
  y = sectionHead(doc, 'Big Five Personality Profile', y, C.purple);

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
  const intro = doc.splitTextToSize(
    `This report presents ${data.participantName}'s personality profile based on the Big Five (OCEAN) model — one of the most ` +
    `empirically validated frameworks for understanding personality in organisational contexts. Scores represent self-reported ` +
    `preferences and tendencies, not fixed traits.`, CW,
  ) as string[];
  doc.text(intro, ML, y);
  y += intro.length * 5.5 + 10;

  y = sectionHead(doc, 'Dimension Scores', y, C.purple);
  dims.forEach((d) => {
    const col = d.score >= 80 ? C.green : d.score >= 60 ? C.purple : C.amber;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
    doc.text(d.dim, ML, y + 4);
    // background
    setFill(doc, C.light); doc.roundedRect(ML, y + 7, CW, 7, 1, 1, 'F');
    // fill
    setFill(doc, col); doc.roundedRect(ML, y + 7, Math.max(CW * d.score / 100, 3), 7, 1, 1, 'F');
    // label
    if (d.score > 12) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(`${d.score}%`, ML + CW * d.score / 100 - 14, y + 12.5);
    }
    y += 18;
  });

  y += 2;
  y = sectionHead(doc, 'Dimension Descriptions', y, C.purple);
  autoTable(doc, {
    startY: y,
    head: [['Dimension', 'Score', 'Description']],
    body: dims.map((d) => [d.dim, `${d.score}%`, d.desc]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: C.purple, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 46 }, 1: { cellWidth: 16 }, 2: { cellWidth: CW - 62 } },
    margin: { left: ML, right: MR },
  });

  doc.addPage();
  y = 24;
  y = sectionHead(doc, 'Leadership Style Implications', y, C.purple);
  [
    { title: 'Communication Style',  body: `${fn}'s profile suggests a direct yet empathetic communicator. High Conscientiousness indicates a preference for prepared, well-organised interactions.` },
    { title: 'Team Dynamics',        body: 'Agreeable and extraverted tendencies create a collaborative leadership presence. Team members are likely to experience this leader as approachable and inclusive.' },
    { title: 'Under Pressure',       body: `The Emotional Stability dimension indicates solid resilience. Under sustained pressure, ${fn} is likely to maintain composure and continue supporting team members.` },
    { title: 'Innovation & Change',  body: 'The Openness score reflects a leader who welcomes new ideas and is likely to champion experimentation. Balancing openness with structured execution will be key.' },
  ].forEach((item) => {
    const h = 24;
    setFill(doc, [237, 233, 254]); doc.roundedRect(ML, y, CW, h, 2, 2, 'F');
    setFill(doc, C.purple); doc.rect(ML, y, 3, h, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.purple);
    doc.text(item.title, ML + 7, y + 8);
    doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    const lines = doc.splitTextToSize(item.body, CW - 12) as string[];
    doc.text(lines, ML + 7, y + 15);
    y += h + 5;
  });
}

// ─── Readiness ────────────────────────────────────────────────────────────────

function buildReadiness(doc: Doc, data: ReportData, autoTable: (d: Doc, o: object) => void) {
  const dims = mockReadiness(data.participantName);
  const weighted = Math.round(dims.reduce((s, d) => s + d.score * d.weight, 0));
  const level = weighted >= 80 ? 'High Potential' : weighted >= 65 ? 'Ready with Support' : 'Developing';
  const levelCol = weighted >= 80 ? C.green : weighted >= 65 ? C.brand : C.amber;

  doc.addPage();
  let y = 24;
  y = sectionHead(doc, 'Leadership Readiness Summary', y, C.orange);

  [
    { l: 'Readiness Score', v: `${weighted}%`,  col: C.orange },
    { l: 'Readiness Level', v: level,           col: levelCol },
    { l: 'Dimensions',      v: `${dims.length}`, col: C.orange },
  ].forEach((s, i) => statBox(doc, ML + i * 60, y, 54, 28, s.l, s.v, s.col));
  y += 38;

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
  const fn = data.participantName.split(' ')[0];
  const intro = doc.splitTextToSize(
    `${data.participantName}'s Leadership Readiness assessment evaluates potential and preparedness for increased leadership responsibility. ` +
    `A weighted score of ${weighted}% places ${fn} in the "${level}" category. This assessment supports succession planning and targeted development investment.`, CW,
  ) as string[];
  doc.text(intro, ML, y);
  y += intro.length * 5.5 + 10;

  y = sectionHead(doc, 'Dimension Breakdown', y, C.orange);
  autoTable(doc, {
    startY: y,
    head: [['Dimension', 'Score', 'Weight', 'Rating']],
    body: dims.map((d) => [
      d.dim,
      `${d.score}%`,
      `${Math.round(d.weight * 100)}%`,
      d.score >= 80 ? 'Strong' : d.score >= 65 ? 'Moderate' : 'Needs Dev.',
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: C.orange, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    margin: { left: ML, right: MR },
    didParseCell: (h: any) => {
      if (h.column.index === 3 && h.section === 'body') {
        if (h.cell.raw === 'Strong')     h.cell.styles.textColor = C.green;
        if (h.cell.raw === 'Needs Dev.') h.cell.styles.textColor = C.amber;
      }
    },
  });
  y = autoY(doc) + 12;

  ({ y } = needsPage(doc, y, dims.length * 11 + 30));
  y = sectionHead(doc, 'Visual Overview', y, C.orange);
  dims.forEach((d) => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    doc.text(`${d.dim} (${Math.round(d.weight * 100)}%)`, ML, y + 4);
    hBar(doc, 100, y, d.score, 100, 68, 5.5);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.orange);
    doc.text(`${d.score}%`, 173, y + 4.5);
    doc.setFont('helvetica', 'normal');
    y += 10;
  });

  doc.addPage();
  y = 24;
  y = sectionHead(doc, 'Development Recommendations', y, C.orange);
  [
    { period: 'Short-term (0–6 months)',   items: ['Enrol in an executive communication programme to strengthen senior stakeholder engagement.', 'Take on a cross-functional project to broaden strategic exposure.', 'Begin a structured mentoring relationship with a senior leader.'] },
    { period: 'Medium-term (6–18 months)', items: ['Lead a change initiative to build change management capability.', 'Pursue formal leadership certification aligned to the competency framework.', 'Participate in the organisational talent review process as a reviewer.'] },
    { period: 'Long-term (18+ months)',    items: ['Seek a role stretch assignment at the next leadership level.', 'Build an external network through industry forums and professional associations.', 'Develop an innovation portfolio demonstrating systemic thinking.'] },
  ].forEach((section) => {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); setTxt(doc, C.orange);
    doc.text(section.period, ML, y);
    y += 6;
    section.items.forEach((item) => {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
      const lines = doc.splitTextToSize(`•  ${item}`, CW - 6) as string[];
      doc.text(lines, ML + 5, y);
      y += lines.length * 5.5 + 2;
    });
    y += 5;
  });

  y = sectionHead(doc, 'Succession Planning Note', y, C.orange);
  setFill(doc, [255, 237, 213]); doc.roundedRect(ML, y, CW, 20, 2, 2, 'F');
  setFill(doc, C.orange); doc.rect(ML, y, 3, 20, 'F');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
  const note = doc.splitTextToSize(
    `Based on this assessment, ${data.participantName} is recommended as a ${weighted >= 80 ? 'near-term (1–2 year)' : 'medium-term (2–4 year)'} succession candidate for senior leadership roles, subject to continued development in the identified priority areas.`, CW - 10,
  ) as string[];
  doc.text(note, ML + 7, y + 8);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateReportPdf(data: ReportData): Promise<void> {
  // Dynamic imports keep jsPDF browser-only (no SSR execution).
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const typeLabel = TYPE_LABELS[data.reportType] ?? 'Assessment Report';
  const accent    = TYPE_COLOURS[data.reportType] ?? C.brand;

  // Cover (page 1)
  drawCover(doc, data, typeLabel, accent);

  // Content pages
  const at = (d: Doc, o: object) => autoTable(d, o);
  if      (data.reportType === 'individual_360') build360(doc, data, at);
  else if (data.reportType === 'competency')     buildCompetency(doc, data, at);
  else if (data.reportType === 'personality')    buildPersonality(doc, data, at);
  else if (data.reportType === 'readiness')      buildReadiness(doc, data, at);

  // Stamp headers/footers on all content pages
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    addPageDecor(doc, typeLabel, i - 1, total - 1);
  }

  // Use blob + object URL — more reliable than doc.save() in webpack bundles.
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `leaderprism-${data.reportType}-${data.participantName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
