'use client';

/** Code 39 barcode as pure SVG — no dependency, print-crisp. */
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '/': 'nwnwnwnnn',
  '*': 'nwnnwnwnn',
};

export function Barcode({ value, height = 36 }: { value: string; height?: number }) {
  const text = `*${value.toUpperCase().replace(/[^0-9A-Z\-. /]/g, '-')}*`;
  const bars: Array<{ x: number; w: number }> = [];
  let x = 0;
  const N = 1.4, W = 3.4, GAP = 1.4;
  for (const ch of text) {
    const pattern = CODE39[ch] ?? CODE39['-']!;
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === 'w' ? W : N;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
    x += GAP;
  }
  return (
    <svg width={x} height={height} viewBox={`0 0 ${x} ${height}`} shapeRendering="crispEdges">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />)}
    </svg>
  );
}
