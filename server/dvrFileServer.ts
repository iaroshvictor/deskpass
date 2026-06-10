import { WebApp } from 'meteor/webapp';
import { createReadStream, statSync, existsSync } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import { RecordingsCollection } from '/imports/api/recordings';

// Serves recording files at /dvr-media/<recordingId>
// Supports HTTP range requests so HTML5 <video> can seek.
WebApp.connectHandlers.use('/dvr-media', async (req: IncomingMessage, res: ServerResponse) => {
  const id = (req.url ?? '').replace(/^\/+/, '').split(/[?#]/)[0];
  if (!id) { res.writeHead(400); res.end(); return; }

  let rec;
  try {
    rec = await RecordingsCollection.findOneAsync({ _id: id });
  } catch {
    res.writeHead(500); res.end(); return;
  }

  if (!rec?.path || !existsSync(rec.path)) {
    res.writeHead(404); res.end('Not found'); return;
  }

  let size: number;
  try { size = statSync(rec.path).size; }
  catch { res.writeHead(500); res.end(); return; }

  const range = (req.headers as Record<string, string>)['range'];

  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (!m) { res.writeHead(416); res.end(); return; }

    const start   = parseInt(m[1], 10);
    const end     = m[2] ? parseInt(m[2], 10) : Math.min(start + 1024 * 1024 - 1, size - 1);
    const chunk   = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${size}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunk,
      'Content-Type':   'video/mp4',
      'Cache-Control':  'no-cache',
    });
    createReadStream(rec.path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type':   'video/mp4',
      'Accept-Ranges':  'bytes',
      'Cache-Control':  'no-cache',
    });
    createReadStream(rec.path).pipe(res);
  }
});
