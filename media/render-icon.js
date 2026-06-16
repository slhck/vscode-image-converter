// Renders media/icon.svg to media/icon.png (256x256) using the bundled sharp.
// Run with: npm run render-icon
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "icon.svg");
const pngPath = path.join(__dirname, "icon.png");

sharp(fs.readFileSync(svgPath), { density: 384 })
  .resize(256, 256)
  .png()
  .toFile(pngPath)
  .then(() => console.log(`Wrote ${pngPath}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
