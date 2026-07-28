import { createClient } from 'redis';
import { Cam } from '/imports/api/cams';

// Dedicated client — the shared redisClient is in subscriber mode (it has
// .subscribe() called on it in main.ts), which cannot reliably issue writes.
const redisWrite = await createClient()
  .on('error', (e) => console.log('[percept] redis error', e))
  .connect();

// Drives the shared C++ perception engine (deskpass_percept) for cameras whose
// `engine` is 'percept'. Two channels, matching what the engine expects:
//   1. redis cam:config:<id> — zones/lines, read by the engine on stream ADD
//   2. REST /api/v1/stream/{add,remove} — source lifecycle
//
// camera_id in the REST payload == Cam._id, which keys the whole redis contract
// (cam:frames:<id>, cam_events, cam:config:<id>) — so a percept camera is
// indistinguishable from a python one to every downstream consumer.

const PERCEPT_URL = process.env.PERCEPT_URL || 'http://localhost:9010';

// Cam lines/zones → the engine's cam:config JSON shape (see analytics.hpp).
function camConfig(cam: Cam) {
  const zones = (cam.overlayZones || []).map((z) => ({
    zoneId: z.zoneId,
    points: z.points,
  }));
  const lines = (cam.lines || []).map((l) =>
    l.orientation === 'v'
      ? { lineId: l.lineId, top: l.top, bottom: l.bottom }
      : { lineId: l.lineId, left: l.left, right: l.right });
  return { zones, lines };
}

async function rest(path: string, value: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetch(`${PERCEPT_URL}/api/v1/stream/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'sensor',
        value,
        headers: { source: 'deskpass', created_at: new Date().toISOString() },
      }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json().catch(() => ({}));
    const ok = String(body?.reason || '').includes('SUCCESS');
    if (!ok) console.warn(`[percept] stream/${path} for ${value.camera_id}:`, body?.reason || res.status);
    return ok;
  } catch (e: any) {
    console.warn(`[percept] engine unreachable for stream/${path}:`, e?.message);
    return false;
  }
}

export async function perceptAdd(cam: Cam): Promise<void> {
  if (!cam._id || !cam.streamurl) return;
  // config must exist before the add — the engine reads it on the ADD message
  await redisWrite.set(`cam:config:${cam._id}`, JSON.stringify(camConfig(cam)));
  // Livestream source: percept serves no RTSP (metadata-only), so the WebRTC
  // relay pulls the raw camera directly. Register the raw url as cam:stream.
  await redisWrite.set(`cam:stream:${cam._id}`, cam.streamurl);
  await rest('add', {
    camera_id: cam._id,
    camera_name: cam.name || cam._id,
    camera_url: cam.streamurl,
    change: 'camera_add',
    metadata: { resolution: '1920x1080', codec: 'h264', framerate: 30 },
  });
}

// The engine's stream/remove requires camera_url in the payload (not just id).
export async function perceptRemove(camId: string, camUrl?: string): Promise<void> {
  // Drop the whole redis footprint so removed cams don't leave orphaned keys
  // (cam:frames has no TTL and lingers forever otherwise). perceptSync re-adds
  // via perceptAdd, which rewrites cam:config + cam:stream, so this is safe there.
  await redisWrite.del([
    `cam:stream:${camId}`,
    `cam:config:${camId}`,
    `cam:frames:${camId}`,
  ]);
  await rest('remove', {
    camera_id: camId,
    camera_url: camUrl || '',
    change: 'camera_remove',
  });
}

// URL or zone/line change → remove then re-add so the engine re-reads config.
export async function perceptSync(cam: Cam): Promise<void> {
  if (!cam._id) return;
  await perceptRemove(cam._id, cam.streamurl);
  await new Promise((r) => setTimeout(r, 500));
  await perceptAdd(cam);
}
