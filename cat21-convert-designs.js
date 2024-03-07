const fs = require('fs');
const path = require('path');
const { designs } = require('./src/lib/mooncat-parser.designs.original');

const newFile = '/src/lib/mooncat-parser.designs.ts';

/**
 * Adjusts the orientation of all mooncat designs from a string representation to a nested array format
 * and converts each design to the new orientation by flipping rows and columns.
 * --> The result is now immediately recognizable.
 *
 * @param {string[]} designs - An array of mooncat designs, each represented as a dot-separated string.
 * @returns {string[][][]} A new array of mooncat designs, each converted into a nested array of strings
 * representing the pixel values in the adjusted orientation.
 */
function adjustAllDesignsOrientationAndConvert(designs) {
  return designs.map(design => {
    const rows = design.split('.').map(row => row.split(''));
    const adjustedAndConvertedDesign = [];

    for (let x = 0; x < rows[0].length; x++) {
      const newRow = [];
      for (let y = 0; y < rows.length; y++) {
        newRow.push(rows[y][x]);
      }
      adjustedAndConvertedDesign.push(newRow);
    }

    return adjustedAndConvertedDesign;
  });
}

const newDesigns = adjustAllDesignsOrientationAndConvert(designs);

const formattedNewDesigns = newDesigns.map((design, i) =>
  `  // ${i}\n  [\n${
      design.map(row => `    [${row.map(pixel => `${pixel}`).join(',')}]`).join(',\n')}\n  ]`
).join(',\n');

const fileContent = `// generated file, do not edit manually! \nexport const designs = [\n${formattedNewDesigns}\n];\n`;

const outputFilePath = path.join(__dirname, newFile);

fs.writeFileSync(outputFilePath, fileContent, 'utf8');
console.log('New designs have been successfully written to', outputFilePath);
