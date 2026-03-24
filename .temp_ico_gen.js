const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src', 'assets', 'jbologo_square.png');
const dest = path.join(__dirname, 'src', 'assets', 'jbologo.ico');

pngToIco(src)
  .then(buf => {
    fs.writeFileSync(dest, buf);
    console.log('ICO created successfully at:', dest);
  })
  .catch(err => {
    console.error('Failed to create ICO:', err);
    process.exit(1);
  });
