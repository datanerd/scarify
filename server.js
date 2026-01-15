import express from 'express';
import multer from 'multer';
import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const originalsDir = path.join(process.cwd(), 'public', 'images', 'originals');
const outputDir = path.join(process.cwd(), 'public', 'images', 'output');

// Register Comic Sans Bold font (make sure ComicSansMSBold.ttf is in your project root)
registerFont(path.join(process.cwd(), 'ComicSansMSBold.ttf'), { family: 'Comic Sans MS', weight: 'bold' });

// Serve list of original images as JSON
app.get('/images/originals', (req, res) => {
  const files = fs.readdirSync(originalsDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  const urls = files.map(f => `/images/originals/${encodeURIComponent(f)}`);
  res.json({ images: urls });
});

// Serve original images statically
app.use('/images/originals', express.static(originalsDir));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.post('/process', async (req, res) => {
  try {
    const phrase = req.body.phrase || req.query.phrase || '';
    console.log('Received phrase:', phrase);
    if (!phrase) {
      res.status(400).send('Phrase required');
      return;
    }

    // Clean output dir
    fs.readdirSync(outputDir).forEach(f => {
      console.log('Removing file:', f);
      fs.rmSync(path.join(outputDir, f));
    });

    const files = fs.readdirSync(originalsDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    console.log('Original images:', files);
    const processedFiles = [];
    for (const file of files) {
      try {
        console.log('Processing image:', file);
        const imgPath = path.join(originalsDir, file);
        const image = await loadImage(imgPath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);
        ctx.font = 'bold 64px "Comic Sans MS"';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 8;
        ctx.fillText(phrase, image.width / 2, image.height - 10);
        const outPath = path.join(outputDir, file);
        const outStream = fs.createWriteStream(outPath);
        const stream = canvas.createJPEGStream();
        await new Promise((resolve, reject) => {
          stream.pipe(outStream);
          outStream.on('finish', resolve);
          outStream.on('error', reject);
        });
        processedFiles.push(file);
      } catch (imgErr) {
        console.error('Error processing image', file, imgErr);
      }
    }

    // Respond with URLs to processed images
    const urls = processedFiles.map(f => `/images/output/${encodeURIComponent(f)}`);
    res.json({ images: urls });
  } catch (err) {
    console.error('Error in /process route:', err);
    res.status(500).send('Internal server error');
  }
});

app.use('/images/output', express.static(outputDir));



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
