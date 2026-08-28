import { readFile, writeFile } from 'node:fs/promises';

const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Pass one or more .srt caption files.');

const maxLineLength = 58;
// Leave room for natural word boundaries so every cue can balance into two lines.
const maxCueLength = 104;
const cueSettings = 'line:88% position:50% size:74% align:center';

const parseTime = (value) => {
  const [hours, minutes, tail] = value.replace('.', ',').split(':');
  const [seconds, millis] = tail.split(',');
  return (((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000) + Number(millis);
};

const formatTime = (millis, separator) => {
  const value = Math.max(0, Math.round(millis));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1_000);
  const remainder = value % 1_000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${separator}${String(remainder).padStart(3, '0')}`;
};

const splitWords = (text, limit) => {
  const words = text.trim().split(/\s+/);
  const chunkCount = Math.ceil(text.length / limit);
  if (chunkCount <= 1) return [text.trim()];
  const chunks = [];
  let start = 0;
  for (let chunkIndex = 0; chunkIndex < chunkCount - 1; chunkIndex += 1) {
    const remainingChunks = chunkCount - chunkIndex;
    const remainingText = words.slice(start).join(' ');
    const target = remainingText.length / remainingChunks;
    let bestEnd = start + 1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let end = start + 1; end < words.length; end += 1) {
      const candidate = words.slice(start, end).join(' ');
      if (candidate.length > limit) break;
      const score = Math.abs(candidate.length - target);
      if (score < bestScore) { bestEnd = end; bestScore = score; }
    }
    chunks.push(words.slice(start, bestEnd).join(' '));
    start = bestEnd;
  }
  chunks.push(words.slice(start).join(' '));
  return chunks;
};

const wrapTwoLines = (text) => {
  if (text.length <= maxLineLength) return text;
  const words = text.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const first = words.slice(0, i).join(' ');
    const second = words.slice(i).join(' ');
    if (first.length <= maxLineLength && second.length <= maxLineLength) {
      const score = Math.abs(first.length - second.length);
      if (!best || score < best.score) best = { first, second, score };
    }
  }
  if (!best) throw new Error(`Caption cannot fit in two lines: ${text}`);
  return `${best.first}\n${best.second}`;
};

for (const path of paths) {
  const source = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '').trim();
  const blocks = source.split(/\r?\n\r?\n/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;
    const [startText, endText] = lines[timingIndex].split('-->').map((value) => value.trim().split(' ')[0]);
    const start = parseTime(startText);
    const end = parseTime(endText);
    const text = lines.slice(timingIndex + 1).join(' ').replace(/\s+/g, ' ').trim();
    const chunks = splitWords(text, maxCueLength);
    const totalWeight = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    let cursor = start;

    chunks.forEach((chunk, index) => {
      const chunkEnd = index === chunks.length - 1
        ? end
        : cursor + ((end - start) * chunk.length / totalWeight);
      cues.push({ start: cursor, end: chunkEnd, text: wrapTwoLines(chunk) });
      cursor = chunkEnd;
    });
  }

  const srt = cues.map((cue, index) => `${index + 1}\n${formatTime(cue.start, ',')} --> ${formatTime(cue.end, ',')}\n${cue.text}`).join('\n\n') + '\n';
  const vtt = `WEBVTT\n\n${cues.map((cue, index) => `${index + 1}\n${formatTime(cue.start, '.')} --> ${formatTime(cue.end, '.')} ${cueSettings}\n${cue.text}`).join('\n\n')}\n`;
  await writeFile(path, srt, 'utf8');
  await writeFile(path.replace(/\.srt$/i, '.vtt'), vtt, 'utf8');
}
