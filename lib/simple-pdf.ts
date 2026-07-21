type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gapAfter?: number;
};

function cleanPdfText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(value: string, maxLength = 76) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    if (`${current} ${word}`.length <= maxLength) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);
  return lines;
}

export function createSimplePdf(lines: PdfLine[]) {
  const commands: string[] = ['BT', '50 742 Td'];
  let firstLine = true;

  for (const line of lines) {
    const wrapped = wrapText(line.text);
    for (const segment of wrapped) {
      const size = line.size || 11;
      const font = line.bold ? 'F2' : 'F1';
      if (!firstLine) commands.push(`0 -${Math.max(15, size + 5)} Td`);
      commands.push(`/${font} ${size} Tf`);
      commands.push(`(${cleanPdfText(segment)}) Tj`);
      firstLine = false;
    }
    if (line.gapAfter) commands.push(`0 -${line.gapAfter} Td`);
  }

  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}
