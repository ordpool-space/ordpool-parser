type Point = { x: number; y: number };
const bgOpacity = 0.5;

export function getBgRect(fill: string, opacity = 1) {
  if (opacity === 1) {
    return `<rect x="0" y="0" width="22" height="22" fill="${fill}" />\n`;
  }
  return `<rect x="0" y="0" width="22" height="22" fill="${fill}" opacity="${opacity}" />\n`;
}


/* *** CUBES *** */

// Generates the top, left, right points for the cube illusion
function getCubePoints(baseX: number, baseY: number, size: number): { top: Point[], left: Point[], right: Point[] } {
  const halfSize = size / 2;
  const halfHeight = halfSize / 2; // Since height is size / 2, half of height is size / 4
  return {
    top: [
      { x: baseX - halfSize, y: baseY - halfHeight },
      { x: baseX, y: baseY - halfSize },
      { x: baseX + halfSize, y: baseY - halfHeight },
      { x: baseX, y: baseY },
    ],
    left: [
      { x: baseX - halfSize, y: baseY - halfHeight },
      { x: baseX - halfSize, y: baseY + halfHeight },
      { x: baseX, y: baseY + halfSize },
      { x: baseX, y: baseY },
    ],
    right: [
      { x: baseX, y: baseY },
      { x: baseX, y: baseY + halfSize },
      { x: baseX + halfSize, y: baseY + halfHeight },
      { x: baseX + halfSize, y: baseY - halfHeight },
    ],
  };
}

// Generates a cube illusion from three polygon
function getCubeFromPolygons(x: number, y: number, size: number, gridWidth: number, gridHeight: number, backgroundColors: string[]): string {
  const points = getCubePoints(x, y, size);

  let colorTop = backgroundColors[0];
  let colorLeft = backgroundColors[1];
  let colorRight = backgroundColors[2];

  // not visible, because even the left side is out of the grid (right overflow)
  if(points.left[0].x > gridWidth) {
    return '';
  }

  // not visible, because even the right side is out of the grid (left overflow)
  if(points.right[0].x < 0) {
    return '';
  }

  // not visible, because even the top side is out of the grid (bottom overflow)
  if(points.top[0].y > gridHeight) {
    return '';
  }

  return `
    <polygon points="${points.top.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorTop}" opacity="${bgOpacity}" />
    <polygon points="${points.left.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorLeft}" opacity="${bgOpacity}" />
    <polygon points="${points.right.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorRight}" opacity="${bgOpacity}" />
  `;
}

export function getIsomometricCubePattern(rows: number, columns: number, cubeSize: number, gridWidth: number, gridHeight: number, [n1, n2, n3, o1, o2, o3]: string[]): string {

  let svg = getBgRect('#ffffff', bgOpacity);

  const normalCubesColors = [n1, n2, n3];
  const orangeColors = [o1, o2, o3];

  // Starting point for drawing cubes in the top left corner
  const startX = cubeSize / 2;
  const startY = cubeSize / 4;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = startX + c * cubeSize - r * cubeSize / 2;
      const y = startY + r * cubeSize * 0.75;

      const isCube9 = r == 0 && c == 9;
      svg += getCubeFromPolygons(x, y, cubeSize, gridWidth, gridHeight, isCube9 ? orangeColors : normalCubesColors);
    }
  }
  return svg;
}

/* *** CYBERPUNK BACKGROUND *** */

/**
 * Converts a text string into its binary representation.
 * Each character in the text is represented by its 8-bit binary code.
 * @param text - The text to convert to binary.
 * @returns The binary representation of the input text.
 */
export function textToBinary(text: string): string {
  let binaryString = '';

  for (let i = 0; i < text.length; i++) {

      // Get the binary representation of the current character
      const binaryChar = text[i].charCodeAt(0).toString(2);

      // Ensure each binary representation is 8 bits long by padding with leading zeros if necessary
      const paddedBinaryChar = '0'.repeat(8 - binaryChar.length) + binaryChar;

      binaryString += paddedBinaryChar;
  }

  return binaryString;
}

export function wrapTextWithTspan(text: string, x: number = 0, dy: number = 2, letterSpacing: number = 0): string {
  return `<tspan x="${x}" dy="${dy}"${ letterSpacing ? ` letter-spacing="${letterSpacing}"` : '' }>${text}</tspan>\n`
}

export function splitAndWrapTextWithTspan(text: string, maxCharsPerLine: number, x: number = 0, dy: number = 2): string {

  let wrappedText = '';

  // Split the text into lines with maximum characters per line
  const lines = [];
  for (let i = 0; i < text.length; i += maxCharsPerLine) {
    lines.push(text.substring(i, i + maxCharsPerLine));
  }

  // Wrap each line in a <tspan> element
  for (const line of lines) {
    wrappedText += wrapTextWithTspan(line, x, dy);
  }

  return wrappedText;
}

// from "A Cypherpunk's Manifesto by Eric Hughes", 9 March 1993
export function getCypherpunksManifestoText(backgroundColors: string[]) {
  let svg = getBgRect(backgroundColors[0], bgOpacity);
  svg += `<text y="-0.38" font-family="Courier New, Courier" font-weight="bold" font-size="1.8px" fill="${ backgroundColors[1] }" opacity="${bgOpacity}">${ splitAndWrapTextWithTspan(textToBinary('Cypherpunks write code. 1993'), 20, 0.2)}</text>\n`;
  return svg;
}

/* *** WHITEPAPER BACKGROUND *** */

export function getWhitepaperText(backgroundColors: string[]) {

  const fill = backgroundColors[0];
  const bg = backgroundColors[1];
  let svg = getBgRect(bg, bgOpacity);

  svg += `<svg viewBox="-4 -5 50 78" xmlns="http://www.w3.org/2000/svg" opacity="${bgOpacity}">`;

  svg += `<text y="2" font-family="Times New Roman, Times" font-weight="bold" font-size="2px" fill="${ fill }">\n`;
  svg += wrapTextWithTspan('Bitcoin: A Peer-to-Peer Electronic Cash System');
  svg += `</text>\n`;

  svg += `<text y="7" font-family="Times New Roman, Times" font-size="1.12px" fill="${ fill }" text-anchor="middle">\n`;
  svg += wrapTextWithTspan('Satoshi Nakamoto', 20.2, 1.3);
  svg += wrapTextWithTspan('satoshin@gmx.com', 20.2, 1.3);
  svg += wrapTextWithTspan('www.bitcoin.org', 20.2, 1.3);
  svg += `</text>\n`;

  svg += `<text y="16" font-family="Times New Roman, Times" font-weight="bold" font-size="1.12px" fill="${ fill }">\n`;
  svg += wrapTextWithTspan('Abstract.', 1.4, 0);
  svg += `</text>\n`;

  svg += `<text y="16" font-family="Times New Roman, Times" font-size="1.12px" fill="${ fill }" xml:space="preserve">\n`;
  svg += wrapTextWithTspan('A purely peer-to-peer version of electronic cash would allow online', 6.8, 0, 0.03);
  svg += wrapTextWithTspan('payments to be sent directly from one party to another without going through a', 1.4, 1.3, 0.03);
  svg += wrapTextWithTspan('financial institution.  Digital signatures provide part of the solution, but the main', 1.4, 1.32, 0.02);
  svg += wrapTextWithTspan('benefits are lost if a trusted third party is still required to prevent double-spending.', 1.4, 1.3, 0.012);
  svg += wrapTextWithTspan('We propose a solution to the double-spending problem using a peer-to-peer network.', 1.4, 1.3, 0);
  svg += wrapTextWithTspan('The network timestamps transactions by hashing them into an ongoing chain of', 1.4, 1.3, 0.028);
  svg += wrapTextWithTspan('hash-based proof-of-work, forming a record that cannot be changed without redoing', 1.4, 1.3, 0.004);
  svg += wrapTextWithTspan('the proof-of-work.  The longest chain not only serves as proof of the sequence of', 1.4, 1.3, 0.02);
  svg += wrapTextWithTspan('events witnessed, but proof that it came from the largest pool of CPU power.  As', 1.4, 1.3, 0.022);
  svg += wrapTextWithTspan('long as a majority of CPU power is controlled by nodes that are not cooperating to', 1.4, 1.3, 0.012);
  svg += wrapTextWithTspan('attack the network, they\'ll generate the longest chain and outpace attackers.  The', 1.4, 1.3, 0.024);
  svg += wrapTextWithTspan('network itself requires minimal structure.  Messages are broadcast on a best effort', 1.4, 1.3, 0.018);
  svg += wrapTextWithTspan('basis, and nodes can leave and rejoin the network at will, accepting the longest', 1.4, 1.3, 0.034);
  svg += wrapTextWithTspan('proof-of-work chain as proof of what happened while they were gone.', 1.4, 1.3, 0.004);
  svg += `</text>\n`;

  svg += `<text y="35" font-family="Times New Roman, Times" font-weight="bold" font-size="1.3px" fill="${ fill }" xml:space="preserve">\n`;
  svg += wrapTextWithTspan('1.    Introduction', -2);
  svg += `</text>\n`;

  svg += `<text y="40" font-family="Times New Roman, Times" font-size="1.12px" fill="${ fill }" xml:space="preserve">\n`;
  svg += wrapTextWithTspan('Commerce on the Internet has come to rely almost exclusively on financial institutions serving as', -2, 0, 0.01);
  svg += wrapTextWithTspan('trusted third parties to process electronic payments.  While the system works well enough for', -2, 1.3, 0.03);
  svg += wrapTextWithTspan('most transactions, it still suffers from the inherent weaknesses of the trust based model.', -2, 1.3, 0.062);
  svg += wrapTextWithTspan('avoid mediating disputes.  The cost of mediation increases transaction costs, limiting the', -2, 1.3, 0.055);
  svg += wrapTextWithTspan('minimum practical transaction size and cutting off the possibility for small casual transactions,', -2, 1.3, 0.024);
  svg += wrapTextWithTspan('and there is a broader cost in the loss of ability to make non-reversible payments for non-', -2, 1.3, 0.052);
  svg += wrapTextWithTspan('reversible services.  With the possibility of reversal, the need for trust spreads. Merchants must', -2, 1.3, 0.022);
  svg += wrapTextWithTspan('be wary of their customers, hassling them for more information than they would otherwise need.', -2, 1.3, 0.018);
  svg += wrapTextWithTspan('A certain percentage of fraud is accepted as unavoidable.  These costs and payment uncertainties', -2, 1.3, 0.015);
  svg += wrapTextWithTspan('can be avoided in person by using physical currency, but no mechanism exists to make payments', -2, 1.3, 0.014);
  svg += wrapTextWithTspan('over a communications channel without a trusted party.', -2, 1.3, 0.01);
  svg += wrapTextWithTspan('   What is needed is an electronic payment system based on cryptographic proof instead of trust,', -2, 1.3, 0.02);
  svg += wrapTextWithTspan('allowing any two willing parties to transact directly with each other without the need for a trusted', -2, 1.3, 0.01);
  svg += wrapTextWithTspan('third party.  Transactions that are computationally impractical to reverse would protect sellers', -2, 1.3, 0.03);
  svg += wrapTextWithTspan('from fraud, and routine escrow mechanisms could easily be implemented to protect buyers.  In', -2, 1.3, 0.024);
  svg += wrapTextWithTspan('this paper, we propose a solution to the double-spending problem using a peer-to-peer distributed', -2, 1.3, 0.012);
  svg += wrapTextWithTspan('timestamp server to generate computational proof of the chronological order of transactions.  The', -2, 1.3, 0.012);
  svg += wrapTextWithTspan('system is secure as long as honest nodes collectively control more CPU power than any', -2, 1.3, 0.066);
  svg += wrapTextWithTspan('cooperating group of attacker nodes.', -2, 1.3, 0.02);
  svg += `</text>\n`;

  svg += `<text y="68" font-family="Times New Roman, Times" font-size="1.12px" fill="${ fill }">\n`;
  svg += wrapTextWithTspan('1', 21, 0);
  svg += `</text>\n`;

  svg += `</svg>`;

  return svg;
}


