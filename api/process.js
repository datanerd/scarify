import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

const originalsDir = path.join(process.cwd(), 'public', 'images', 'originals');
const outputDir = '/tmp'; // Use /tmp for Vercel compatibility

// Register Comic Sans Bold font (make sure ComicSansMSBold.ttf is in your project root)
try {
  registerFont(path.join(process.cwd(), 'ComicSansMSBold.ttf'), { family: 'Comic Sans MS', weight: 'bold' });
} catch (e) {
  // Font may already be registered or missing in some environments
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const phrase = req.body.phrase || req.query.phrase || '';
  if (!phrase) {
    res.status(400).send('Phrase required');
    return;
  }

  // Clean output dir
  if (fs.existsSync(outputDir)) {
    fs.readdirSync(outputDir).forEach(f => {
      fs.rmSync(path.join(outputDir, f));
    });
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(originalsDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  const processedFiles = [];
  for (const file of files) {
    try {
      const imgPath = path.join(originalsDir, file);
      const image = await loadImage(imgPath);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      ctx.font = 'bold 32px "Comic Sans MS"';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const x = image.width / 2;
      const y = image.height - 20;
      ctx.strokeText(phrase, x, y);
      ctx.fillText(phrase, x, y);
      // Write to /tmp, then read as base64
      const outPath = path.join(outputDir, file);
      const out = fs.createWriteStream(outPath);
      const stream = canvas.createJPEGStream();
      await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
      });
      // Read file as base64 and return as data URL
      const imgBuffer = fs.readFileSync(outPath);
      const dataUrl = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
      processedFiles.push(dataUrl);
    } catch (err) {
      // Skip file on error
    }
  }
  res.status(200).json({ images: processedFiles });
}
