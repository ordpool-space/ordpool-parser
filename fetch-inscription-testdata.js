const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Please enter the inscription ID: ', (inscriptionId) => {
  const url = `https://ordinals.com/content/${inscriptionId}`;
  https.get(url, (res) => {
    let dataChunks = [];

    const contentType = res.headers['content-type'];
    const extension = mime.extension(contentType) || 'unknown';

    res.on('data', (chunk) => {
      dataChunks.push(chunk);
    });

    res.on('end', () => {
      const buffer = Buffer.concat(dataChunks);
      const dir = path.join(__dirname, 'testdata');

      if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
      }
      const filePath = path.join(dir, `inscription_${inscriptionId}.${extension}`);
      fs.writeFile(filePath, buffer, (err) => {
        if (err) throw err;
        console.log(`The inscription file content was saved to ${filePath}`);
      });
    });

  }).on('error', (err) => {
    console.error('Error: ' + err.message);
  });

  rl.close();
});
