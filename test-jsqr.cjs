const fs = require('fs');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');

const buffer = fs.readFileSync('canvas-dump.png');
const png = PNG.sync.read(buffer);

const code = jsQR(png.data, png.width, png.height, { inversionAttempts: 'attemptBoth' });
console.log("Found QR code:", code ? code.data : "null");
