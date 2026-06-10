import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { CamsCollection, Cam } from '/imports/api/cams';
import { SettingsCollection, DVRConfig, DVR_DEFAULTS } from '/imports/api/settings';
import { RecordingsCollection } from '/imports/api/recordings';

const DVR_BIN = '/home/devel/deskpass_cam/bdvr_mux/bdvr_mux';

// Status codes from bdvr_mux
const STATUS_ACTIVE           = 2;
const STATUS_CONNECTION_ERROR = 5;
const STATUS_STREAM_ERROR     = 6;
const FALLBACK_THRESHOLD      = 3; // consecutive errors before starting fallback instance

interface DvrHandle {
  proc: ReturnType<typeof spawn>;
  camId: string;
  camName: string;
  outDir: string;
  url: string;
  currentRecordingId: string | null;
  segStartedAt: Date | null;
  started: boolean;    // sent CMD_START_RECORDING at least once this session
  stopping: boolean;   // sent CMD_EXIT, don't auto-restart
  usingFallback: boolean;
  consecutiveErrors: number;
}

let _config: DVRConfig = { ...DVR_DEFAULTS };
// Primary handles (AI or original depending on config.streamSource)
const _handles: Record<string, DvrHandle> = {};
// Fallback handles — original stream, spawned when AI primary fails, stopped when AI resumes
const _fallbackHandles: Record<string, DvrHandle> = {};

function ensureDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    return true;
  } catch (e: any) {
    console.error('[DVR] Cannot create dir:', dir, e?.message);
    return false;
  }
}

async function closeCurrentSegment(handle: DvrHandle) {
  if (!handle.currentRecordingId) return;
  const id = handle.currentRecordingId;
  handle.currentRecordingId = null;

  const endedAt = new Date();
  const duration = handle.segStartedAt
    ? (endedAt.getTime() - handle.segStartedAt.getTime()) / 1000
    : undefined;
  handle.segStartedAt = null;

  const rec = await RecordingsCollection.findOneAsync({ _id: id });
  let sizeBytes: number | undefined;
  if (rec?.path) {
    try { sizeBytes = statSync(rec.path).size; } catch {}
  }

  await RecordingsCollection.updateAsync({ _id: id }, {
    $set: { status: 'completed', endedAt, ...(duration !== undefined && { duration }), ...(sizeBytes !== undefined && { sizeBytes }) }
  });
}

function _spawnHandle(
  camId: string,
  cam: Cam & { _id: string },
  config: DVRConfig,
  url: string,
  usingFallback: boolean,
  isFallback: boolean,
): void {
  const outDir = join(config.storagePath, camId);
  if (!ensureDir(outDir)) return;

  console.log(`[DVR] Starting "${cam.name}" (${camId})${isFallback ? ' [fallback]' : ''}: ${url} → ${outDir}`);

  const proc = spawn(DVR_BIN, [url, outDir, '0', '', '15'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const handle: DvrHandle = {
    proc, camId, camName: cam.name, outDir, url,
    currentRecordingId: null, segStartedAt: null,
    started: false, stopping: false,
    usingFallback, consecutiveErrors: 0,
  };

  if (isFallback) {
    _fallbackHandles[camId] = handle;
  } else {
    _handles[camId] = handle;
  }

  if (proc.stdout) {
    createInterface({ input: proc.stdout }).on('line', (line) => {
      let msg: any;
      try { msg = JSON.parse(line); } catch { return; }

      if (typeof msg.seg === 'string') {
        handle.consecutiveErrors = 0;
        (async () => {
          await closeCurrentSegment(handle);
          const now = new Date();
          handle.segStartedAt = now;
          handle.currentRecordingId = await RecordingsCollection.insertAsync({
            camId,
            camName: cam.name,
            filename: msg.seg,
            path: join(outDir, msg.seg),
            source: usingFallback ? 'original' : config.streamSource,
            streamUrl: url,
            startedAt: now,
            status: 'recording',
          });
          // AI primary produced a segment → AI stream is healthy, stop the fallback
          if (!isFallback && _fallbackHandles[camId]) {
            console.log(`[DVR] "${cam.name}" AI stream recovered — stopping fallback`);
            stopFallbackForCam(camId);
          }
        })().catch(e => console.error('[DVR] segment insert error:', e));
        return;
      }

      if (typeof msg.status === 'number') {
        const s = msg.status;

        if (s === STATUS_ACTIVE) {
          handle.consecutiveErrors = 0;
          if (!handle.started && !handle.stopping) {
            handle.started = true;
            try { proc.stdin?.write('{"cmd":1}\n'); } catch {}
          }
        } else if (s === STATUS_CONNECTION_ERROR || s === STATUS_STREAM_ERROR) {
          // Only the primary AI handle triggers fallback logic
          if (!isFallback && config.streamSource === 'ai') {
            handle.consecutiveErrors++;
            if (
              config.camFallback &&
              handle.consecutiveErrors >= FALLBACK_THRESHOLD &&
              !_fallbackHandles[camId] &&
              !handle.stopping
            ) {
              console.warn(`[DVR] "${cam.name}" AI stream unreachable after ${FALLBACK_THRESHOLD} attempts — starting fallback on original`);
              _spawnHandle(camId, cam, config, cam.streamurl, true, true);
            }
          }
        }
      }
    });
  }

  if (proc.stderr) {
    proc.stderr.on('data', (d: Buffer) => {
      const text = d.toString().trim();
      if (text) process.stderr.write(`[DVR:${camId}${isFallback ? ':fb' : ''}] ${text}\n`);
    });
  }

  proc.on('close', (code) => {
    console.log(`[DVR] "${camId}"${isFallback ? ' (fallback)' : ''} exited (code=${code})`);
    closeCurrentSegment(handle).catch(() => {});

    if (isFallback) {
      // Fallback handles are temporary — don't auto-restart them
      if (_fallbackHandles[camId] === handle) delete _fallbackHandles[camId];
      return;
    }

    if (_handles[camId] !== handle) return;
    delete _handles[camId];

    if (!handle.stopping && _config.enabled) {
      setTimeout(() => {
        if (!_config.enabled || _handles[camId]) return;
        CamsCollection.findOneAsync({ _id: camId }).then((latestCam) => {
          if (latestCam && _config.enabled)
            spawnForCam(camId, latestCam as Cam & { _id: string }, _config);
        }).catch(() => {});
      }, 5000);
    }
  });
}

function spawnForCam(
  camId: string,
  cam: Cam & { _id: string },
  config: DVRConfig,
) {
  const existing = _handles[camId];
  if (existing) {
    existing.stopping = true;
    try { existing.proc.stdin?.write('{"cmd":3}\n'); } catch {}
    setTimeout(() => { try { existing.proc.kill(); } catch {} }, 3000);
  }
  stopFallbackForCam(camId);

  const url = config.streamSource === 'ai'
    ? `rtsp://localhost:8554/${camId}`
    : cam.streamurl;

  _spawnHandle(camId, cam, config, url, false, false);
}

function stopFallbackForCam(camId: string) {
  const h = _fallbackHandles[camId];
  if (!h) return;
  h.stopping = true;
  try { h.proc.stdin?.write('{"cmd":3}\n'); } catch {}
  setTimeout(() => { try { h.proc.kill(); } catch {} }, 3000);
}

function stopForCam(camId: string) {
  stopFallbackForCam(camId);
  const h = _handles[camId];
  if (!h) return;
  h.stopping = true;
  try { h.proc.stdin?.write('{"cmd":3}\n'); } catch {}
  setTimeout(() => { try { h.proc.kill(); } catch {} }, 3000);
}

function stopAll() {
  Object.keys(_handles).forEach(stopForCam);
}

async function startAllCams(config: DVRConfig) {
  const cams = await CamsCollection.find({}).fetchAsync();
  for (const cam of cams) {
    if (cam._id && cam.streamurl) {
      spawnForCam(cam._id, cam as Cam & { _id: string }, config);
    }
  }
}

function applyConfigChange(newConfig: DVRConfig, prevEnabled: boolean) {
  _config = newConfig;
  if (newConfig.enabled && !prevEnabled) {
    startAllCams(newConfig).catch(console.error);
  } else if (!newConfig.enabled && prevEnabled) {
    stopAll();
  } else if (newConfig.enabled) {
    // Config changed while running (e.g. storagePath or streamSource) — restart all
    stopAll();
    setTimeout(() => startAllCams(newConfig).catch(console.error), 3500);
  }
}

export function initDvr() {
  // Load initial config and start if enabled
  SettingsCollection.findOneAsync({ type: 'dvr' }).then((setting) => {
    if (setting?.config) _config = setting.config as DVRConfig;
    if (_config.enabled) startAllCams(_config).catch(console.error);
  }).catch(console.error);

  // React to DVR settings changes (setDvrConfig does remove+insert)
  SettingsCollection.find({ type: 'dvr' }).observeChanges({
    added(_id, fields) {
      const prevEnabled = _config.enabled;
      applyConfigChange((fields.config as DVRConfig) ?? { ...DVR_DEFAULTS }, prevEnabled);
    },
    changed(_id, fields) {
      if (fields.config === undefined) return;
      applyConfigChange(fields.config as DVRConfig, _config.enabled);
    },
    removed() {
      const wasEnabled = _config.enabled;
      _config = { ...DVR_DEFAULTS };
      if (wasEnabled) stopAll();
    }
  });

  // React to camera add / URL change / removal
  CamsCollection.find({}).observeChanges({
    added(id, fields) {
      if (!_config.enabled || !fields.streamurl) return;
      spawnForCam(id, { _id: id, ...fields } as Cam & { _id: string }, _config);
    },
    changed(id, fields) {
      if (!_config.enabled || !fields.streamurl) return;
      CamsCollection.findOneAsync({ _id: id }).then((cam) => {
        if (cam && _config.enabled) spawnForCam(id, cam as Cam & { _id: string }, _config);
      }).catch(console.error);
    },
    removed(id) {
      stopForCam(id);
    }
  });
}
