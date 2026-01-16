import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

const originalsDir = path.join(process.cwd(), 'public', 'images', 'originals');
const outputDir = path.join(process.cwd(), 'public', 'images', 'output');

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
      const filePath = path.join(outputDir, f);
      try {
        if (fs.statSync(filePath).isFile()) {
          fs.rmSync(filePath);
        }
      } catch (err) {
        // Ignore errors for directories or special files
      }
    });
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(originalsDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  const processedFiles = [];
  // Helper: wrap text to fit width
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    let lines = [];
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  for (const file of files) {
    try {
      const imgPath = path.join(originalsDir, file);
      const image = await loadImage(imgPath);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      ctx.font = 'bold 64px "Comic Sans MS"';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const x = image.width / 2;
      // Wrap text to fit 90% of image width
      const maxWidth = image.width * 0.9;
      const lines = wrapText(ctx, phrase, maxWidth);
      const lineHeight = 64 + 10; // font size + spacing
      // Start drawing so last line is 20px from bottom
      let y = image.height - 20 - (lines.length - 1) * lineHeight;
      for (const line of lines) {
        ctx.strokeText(line, x, y);
        ctx.fillText(line, x, y);
        y += lineHeight;
      }
      // Write to public/images/output, then return public URL
      const outPath = path.join(outputDir, file);
      const out = fs.createWriteStream(outPath);
      const stream = canvas.createJPEGStream();
      await new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
      });
      // Return public URL for the image
      const publicUrl = `/images/output/${file}`;
      processedFiles.push(publicUrl);
    } catch (err) {
      // Skip file on error
    }
  }
  res.status(200).json({ images: processedFiles });
}
