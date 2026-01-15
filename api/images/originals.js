import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const originalsDir = path.join(process.cwd(), 'public', 'images', 'originals');
  const files = fs.readdirSync(originalsDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  const urls = files.map(f => `/images/originals/${encodeURIComponent(f)}`);
  res.status(200).json({ images: urls });
}
