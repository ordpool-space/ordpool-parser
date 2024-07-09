const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Please enter the transaction ID: ', (txId) => {
  const url = `https://mempool.space/api/tx/${txId}`;
  //const url = `https://blockstream.info/api/tx/${txId}`;
  https.get(url, (res) => {
    const dataChunks = [];

    res.on('data', (chunk) => {
      dataChunks.push(chunk);
    });

    res.on('end', () => {
      try {
        const buffer = Buffer.concat(dataChunks);
        const jsonData = JSON.parse(buffer.toString());
        const formattedJson = JSON.stringify(jsonData, null, 2);
        const dir = path.join(__dirname, 'testdata');

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
        const filePath = path.join(dir, `tx_${txId}.json`);
        fs.writeFile(filePath, formattedJson, (err) => {
          if (err) throw err;
          console.log(`The transaction in beautified JSON format was saved to ${filePath}`);
        });
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }
    });

  }).on('error', (err) => {
    console.error('Error: ' + err.message);
  });

  rl.close();
});
