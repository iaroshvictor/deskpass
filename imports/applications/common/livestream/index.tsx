import React from 'react';
import { createPortal } from 'react-dom';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import Icon from './icon';
import { AppType } from '../..';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Box, Typography, IconButton, Snackbar, TextField } from '@mui/material';
import { Cam, CamsCollection } from '/imports/api/cams';
import { CamEventsCollection, CamLiveStatusCollection } from '/imports/api/camEvents';
import { CaptionAlertsCollection } from '/imports/api/captionAlerts';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';

// Client-only collection fed by the 'cam_overlay' publication (server/main.ts):
// a single reactive doc per cam with the CURRENT frame's { persons, faces, fps }.
const CamOverlayCollection = new Mongo.Collection<any>('cam_overlay');
// Fed by 'cam_captions' (live VLM scene-description feed). caption_alerts uses the
// shared /imports/api collection (a second same-named collection throws on server).
const CamCaptionCollection = new Mongo.Collection<any>('cam_captions');

// ── palette ──────────────────────────────────────────────────────────────────
import { useTheme } from '@mui/material/styles';
import { tactical as OVERLAY, MONO } from '/imports/ui/theme';

type Palette = Record<keyof typeof OVERLAY, string>;

/**
 * Chrome colours for this screen, read from the active MUI scheme so the
 * frame, panels and labels follow the theme switch. The dark scheme in
 * imports/ui/theme.ts is built from the same constants this file used to
 * hardcode, so dark mode looks exactly as it did before.
 *
 * Anything painted ON TOP of the video keeps the fixed dark `OVERLAY` tokens
 * instead: the picture is always letterboxed against black, so a light chip or
 * caption over a night scene would be unreadable whatever the app theme is.
 */
const usePalette = (): Palette => {
  const t = useTheme();
  // `t.vars` holds var(--mui-palette-…) references, which follow the scheme
  // class on <html>. `t.palette` holds the values of the DEFAULT scheme only,
  // so reading it here would leave this screen stuck in light mode.
  const v = (t.vars ?? t).palette;
  return React.useMemo(() => ({
    bg: v.background.default,
    panel: v.background.paper,
    panel2: v.surface.sunken,
    border: v.divider,
    borderSoft: v.surface.borderSoft,
    text: v.text.primary,
    dim: v.text.disabled,
    label: v.text.secondary,
    green: v.success.main,
    red: v.error.main,
    redBadge: v.surface.badge,
    accent: v.primary.main,
  }), [v]);
};

// ── caption font size, persisted in a cookie ──────────────────────────────────
const CAPTION_FONT_COOKIE = 'captionFontPx';
const CAPTION_FONT_MIN = 9;
const CAPTION_FONT_MAX = 22;
const CAPTION_FONT_DEFAULT = 11.5;
// SSR-safe: this module is pulled in by server/main.ts (via applications/common),
// so cookie access must no-op when there is no document.
const readCookie = (k: string): string | undefined =>
  typeof document === 'undefined' ? undefined
    : document.cookie.split('; ').find((r) => r.startsWith(k + '='))?.split('=').slice(1).join('=');
const writeCookie = (k: string, v: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${k}=${v}; path=/; max-age=${60 * 60 * 24 * 365}`;
};
// Shared across every card: the cookie is a single global preference, so all
// SCENE LOGs must resize together (per-panel state would leave other cards stale
// until they remounted).
const captionFontStore = {
  px: null as number | null,          // read from the cookie lazily, on first client access
  subs: new Set<() => void>(),
  subscribe(fn: () => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; },
  get(): number {
    if (this.px === null) {
      const v = Number(readCookie(CAPTION_FONT_COOKIE));
      this.px = v >= CAPTION_FONT_MIN && v <= CAPTION_FONT_MAX ? v : CAPTION_FONT_DEFAULT;
    }
    return this.px;
  },
  bump(delta: number) {
    const cur = this.get();
    const next = Math.min(CAPTION_FONT_MAX, Math.max(CAPTION_FONT_MIN, Math.round((cur + delta) * 2) / 2));
    if (next === cur) return;
    this.px = next;
    writeCookie(CAPTION_FONT_COOKIE, String(next));
    this.subs.forEach((fn) => fn());
  },
};
const useCaptionFont = (): [number, (delta: number) => void] => {
  const px = React.useSyncExternalStore(
    (fn) => captionFontStore.subscribe(fn),
    () => captionFontStore.get(),
    () => CAPTION_FONT_DEFAULT,   // SSR snapshot
  );
  return [px, (d: number) => captionFontStore.bump(d)];
};

// ── pop-out window: renders children into a chromeless browser window ──────────
// Uses a portal into a new window's document plus an emotion CacheProvider bound
// to THAT window's <head>, so MUI/emotion styles land in the popup (not the
// opener). Closing the popup (or unmounting) tears it down.
const PopOut = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => {
  const C = usePalette();
  const containerRef = React.useRef<HTMLElement | null>(null);
  const [cache, setCache] = React.useState<ReturnType<typeof createCache> | null>(null);
  const [win, setWin] = React.useState<Window | null>(null);
  React.useEffect(() => {
    const w = window.open('', '',
      'popup=yes,noopener=no,width=860,height=620,toolbar=no,location=no,menubar=no,status=no');
    if (!w) { onClose(); return; }
    w.document.title = title;
    w.document.body.style.margin = '0';
    w.document.body.style.background = C.bg;
    const div = w.document.createElement('div');
    w.document.body.appendChild(div);
    containerRef.current = div;
    setCache(createCache({ key: 'popout', container: w.document.head }));
    setWin(w);
    const bye = () => onClose();
    w.addEventListener('beforeunload', bye);
    return () => { w.removeEventListener('beforeunload', bye); w.close(); };
  }, []);

  // The new document is empty: copy the opener's stylesheets, which is where
  // the theme declares its custom properties, and keep the colour-scheme class
  // in step so switching the theme reaches the detached window too.
  React.useEffect(() => {
    if (!win) return;
    document.head.querySelectorAll('style,link[rel="stylesheet"]')
      .forEach((node) => win.document.head.appendChild(node.cloneNode(true)));
    const syncScheme = () => {
      win.document.documentElement.className = document.documentElement.className;
      win.document.body.className = document.body.className;
    };
    syncScheme();
    const observer = new MutationObserver(syncScheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [win]);
  if (!cache || !containerRef.current) return null;
  return createPortal(<CacheProvider value={cache}>{children}</CacheProvider>, containerRef.current);
};

// ── WebRTC livestream ─────────────────────────────────────────────────────────
// SDP offer/answer over DDP ('webrtcOffer' method, see server/webrtcRelay.ts),
// media over a normal RTCPeerConnection. The server forwards the engine's H.264
// RTP untouched — no transcoding anywhere.
const useWebRtcLive = (
  camId: string,
  videoRef: React.RefObject<HTMLVideoElement>,
  epoch: number,
  onState: (s: 'connecting' | 'live' | 'error') => void,
) => {
  React.useEffect(() => {
    if (!camId) return;
    let pc: RTCPeerConnection | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const start = async () => {
      if (disposed) return;
      onState('connecting');
      pc = new RTCPeerConnection();
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.ontrack = (evt) => {
        if (videoRef.current) videoRef.current.srcObject = evt.streams[0];
      };
      pc.onconnectionstatechange = () => {
        if (!pc || disposed) return;
        if (pc.connectionState === 'connected') onState('live');
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          onState('error');
          pc.close(); pc = null;
          retry = setTimeout(start, 3000);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // non-trickle: wait for ICE gathering so the offer carries candidates
      await new Promise<void>((resolve) => {
        if (pc!.iceGatheringState === 'complete') return resolve();
        const timer = setTimeout(resolve, 2000);
        pc!.onicegatheringstatechange = () => {
          if (pc?.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); }
        };
      });

      try {
        const answerSdp: string = await Meteor.callAsync(
          'webrtcOffer', camId, pc!.localDescription!.sdp);
        if (disposed || !pc) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (e) {
        console.error('webrtcOffer failed:', e);
        onState('error');
        pc?.close(); pc = null;
        retry = setTimeout(start, 5000);
      }
    };
    start();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      pc?.close();
    };
  }, [camId, epoch]);
};

// ── live clock (HH:MM:SS) ─────────────────────────────────────────────────────
const useClock = () => {
  const [t, setT] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t.toLocaleTimeString([], { hour12: false });
};

// Return ONLY the faces present in the current frame. cam_overlay pushes the
// latest frame's faces (and []) each tick, so we render that directly instead of
// accumulating — a person who left the frame vanishes immediately. The TTL guard
// clears faces if the overlay stops updating (stream died mid-frame) so a stale
// last frame can't linger on screen.
const FACE_TTL_MS = 1500;
const useFreshFaces = (ov: any): any[] => {
  const last = React.useRef({ frame: -1, at: 0 });
  const [, tick] = React.useState(0);
  const f = ov?.frame;
  if (f !== undefined && f !== last.current.frame) last.current = { frame: f, at: Date.now() };
  React.useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 700);
    return () => clearInterval(id);
  }, []);
  const fresh = Date.now() - last.current.at < FACE_TTL_MS;
  return fresh ? (ov?.faces?.filter((x: any) => x.thumb) || []) : [];
};

// ── small building blocks ─────────────────────────────────────────────────────
// `overlay` marks the chips that float over the video: those keep the fixed
// dark tokens, the ones inside a panel follow the theme.
const StatChip = ({ label, value, color, overlay = false }: {
  label: string; value: React.ReactNode; color?: string; overlay?: boolean;
}) => {
  const themed = usePalette();
  const C = overlay ? OVERLAY : themed;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.75,
      px: 1, py: 0.4,
      background: overlay ? 'rgba(8,8,10,.72)' : C.panel2,
      border: `1px solid ${C.borderSoft}`,
      borderRadius: 1, fontFamily: MONO,
    }}>
      <Typography sx={{ fontSize: 9, letterSpacing: 1, color: C.label }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1, color: color ?? C.text }}>{value}</Typography>
    </Box>
  );
};

// Module-scoped so its identity is stable: the card re-renders ~10×/sec (frame
// feed + face-TTL tick); an inline component would remount the tab DOM every
// render and drop clicks.
const TabButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => {
  const C = usePalette();
  return (
    <Box onClick={onClick} sx={{
      px: 1.25, py: 0.5, fontFamily: MONO, fontSize: 10, letterSpacing: 1, cursor: 'pointer', userSelect: 'none',
      color: active ? C.text : C.dim,
      borderBottom: `2px solid ${active ? C.accent : 'transparent'}`,
      '&:hover': { color: C.text },
    }}>{children}</Box>
  );
};

const AlertBadge = ({ keyword, onDismiss }: { keyword: string; onDismiss?: () => void }) => (
  <Box onClick={onDismiss} title={onDismiss ? 'dismiss alert' : undefined}
    sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.35, background: OVERLAY.redBadge, color: '#fff',
      borderRadius: 0.75, fontFamily: MONO, fontSize: 11, fontWeight: 800,
      letterSpacing: 1, textTransform: 'uppercase', cursor: onDismiss ? 'pointer' : 'default',
      boxShadow: '0 0 0 1px rgba(0,0,0,.35), 0 2px 6px rgba(217,44,44,.35)',
    }}>
    {keyword}
  </Box>
);

// ── SCENE LOG (VLM captions) + per-camera watch-word editor ───────────────────
const CaptionsPanel = ({ cam }: { cam: Cam }) => {
  const C = usePalette();
  useSubscribe('cam_captions', cam._id);
  const doc = useFind(() => CamCaptionCollection.find({ _id: cam._id }))[0];
  const items: { t: number; text: string }[] = doc?.items || [];

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  const [kw, setKw] = React.useState<string[]>(cam.captionKeywords || []);
  const [draft, setDraft] = React.useState('');
  React.useEffect(() => { setKw(cam.captionKeywords || []); }, [cam._id]);
  const saveKw = (next: string[]) => { setKw(next); Meteor.call('setCaptionKeywords', cam._id, next); };
  const addKw = () => {
    const v = draft.trim().toLowerCase();
    if (v && !kw.includes(v)) saveKw([...kw, v]);
    setDraft('');
  };
  const hits = (text: string) =>
    kw.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));

  const [fontPx, bumpFont] = useCaptionFont();

  return (
    <Box sx={{ px: 1.25, pt: 1, pb: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: C.label, fontFamily: MONO }}>
          SCENE LOG
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" title="smaller captions" onClick={() => bumpFont(-1)}
          disabled={fontPx <= CAPTION_FONT_MIN}
          sx={{ color: C.dim, p: 0.25, '&:hover': { color: C.text }, '&.Mui-disabled': { color: C.borderSoft } }}>
          <TextDecreaseIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <IconButton size="small" title="larger captions" onClick={() => bumpFont(1)}
          disabled={fontPx >= CAPTION_FONT_MAX}
          sx={{ color: C.dim, p: 0.25, '&:hover': { color: C.text }, '&.Mui-disabled': { color: C.borderSoft } }}>
          <TextIncreaseIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>
      <Box ref={scrollRef} sx={{
        height: 96, overflowY: 'auto', fontSize: fontPx, lineHeight: 1.45, fontFamily: MONO,
        pr: 0.5,
      }}>
        {items.length === 0 && (
          <Typography sx={{ fontSize: 'inherit', color: C.dim, fontStyle: 'italic', fontFamily: MONO }}>
            waiting for captions…
          </Typography>
        )}
        {items.map((it, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.4, fontSize: 'inherit' }}>
            <span style={{ color: C.dim, flexShrink: 0 }}>
              {new Date(it.t).toLocaleTimeString([], { hour12: false })}
            </span>
            <span style={{ color: hits(it.text) ? C.red : C.text }}>{it.text}</span>
          </Box>
        ))}
      </Box>
      {kw.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
          {kw.map((k) => (
            <Box key={k} sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.25,
              px: 0.75, py: 0.15, border: `1px solid ${C.border}`, borderRadius: 0.75,
              fontFamily: MONO, fontSize: 10, color: C.text,
            }}>
              {k}
              <CloseIcon onClick={() => saveKw(kw.filter((x) => x !== k))}
                sx={{ fontSize: 12, cursor: 'pointer', color: C.dim, '&:hover': { color: C.red } }} />
            </Box>
          ))}
        </Box>
      )}
      <TextField
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } }}
        placeholder="add watch-word — fall, fight, gun…"
        variant="standard" fullWidth
        InputProps={{ disableUnderline: true, sx: { fontSize: 11, color: C.text, fontFamily: MONO } }}
        sx={{
          mt: 1, px: 1, py: 0.5, background: C.panel2,
          border: `1px solid ${C.borderSoft}`, borderRadius: 0.75,
          '& input::placeholder': { color: C.dim, opacity: 1 },
        }}
      />
    </Box>
  );
};

// ── SIDEBAR: in-frame faces + line-crossing events ────────────────────────────
const SidebarPanel = ({ cam, faces }: { cam: Cam; faces: any[] }) => {
  const C = usePalette();
  useSubscribe('cam_events', cam._id || '', 10);
  const events = useFind(() => CamEventsCollection.find(
    { source: cam._id }, { sort: { timestamp: -1 }, limit: 10 }));
  const status = useFind(() => CamLiveStatusCollection.find({ _id: cam._id }))[0];
  const lineLabel = (lineId: string) => cam.lines?.find((l) => l.lineId === lineId)?.label || lineId;
  const zoneLabel = (zoneId: string) => cam.overlayZones?.find((z) => z.zoneId === zoneId)?.label || zoneId;
  const zoneCounts = Object.entries(status?.zoneCounts ?? {});

  return (
    <Box sx={{ px: 1.25, pt: 1, pb: 1.25 }}>
      <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: C.label, fontFamily: MONO, mb: 0.5 }}>
        FACES IN FRAME · {faces.length}
      </Typography>
      {faces.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: C.dim, fontStyle: 'italic', fontFamily: MONO }}>
          no faces in frame
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', pb: 0.5 }}>
          {faces.map((f, i) => (
            <Box key={i} sx={{
              position: 'relative', flex: '0 0 auto', width: 46, height: 46,
              borderRadius: 0.75, overflow: 'hidden',
              border: `1px solid ${f.frontal ? C.green : C.border}`,
            }}>
              <img src={`data:image/jpeg;base64,${f.thumb}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
          ))}
        </Box>
      )}

      {zoneCounts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {zoneCounts.map(([zid, cnt]) => (
            <StatChip key={zid} label={zoneLabel(zid).toUpperCase()} value={cnt as number}
              color={(cnt as number) > 0 ? C.red : C.text} />
          ))}
        </Box>
      )}

      <Box sx={{ mt: 1, height: 84, overflowY: 'auto', fontFamily: MONO }}>
        {events.length === 0 && (
          <Typography sx={{ fontSize: 11, color: C.dim, fontStyle: 'italic', fontFamily: MONO }}>
            no recent crossings
          </Typography>
        )}
        {events.map((ev) => (
          <Box key={ev._id} sx={{ display: 'flex', gap: 1, mb: 0.35, fontSize: 11 }}>
            <span style={{ color: C.dim, flexShrink: 0 }}>
              {ev.timestamp.toLocaleTimeString([], { hour12: false })}
            </span>
            <span style={{ color: C.text }}>P#{ev.tid} → «{lineLabel(ev.line)}» {ev.to}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ── one camera card ───────────────────────────────────────────────────────────
export const LiveCamPlayer = ({ cam, sx = {}, embedded = false }: { cam: Cam; sx?: { [x: string]: any }; embedded?: boolean }) => {
  const C = usePalette();
  const [message, setMessage] = React.useState<string | null>(null);
  const [streamEpoch, setStreamEpoch] = React.useState(0);
  const [streamState, setStreamState] = React.useState<'connecting' | 'live' | 'error'>('connecting');
  const [tab, setTab] = React.useState<'sidebar' | 'captions'>('captions');
  const [popped, setPopped] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const videoBoxRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  useWebRtcLive(cam._id || '', videoRef, streamEpoch, setStreamState);

  // live per-frame overlay + status + active keyword alert
  useSubscribe('cam_overlay', cam._id);
  useSubscribe('cam_live_status');
  useSubscribe('caption_alerts', { source: cam._id, seen: false }, 5);
  const ov = useFind(() => CamOverlayCollection.find({ _id: cam._id }))[0];
  const status = useFind(() => CamLiveStatusCollection.find({ _id: cam._id }))[0];
  const alert = useFind(() => CaptionAlertsCollection.find(
    { source: cam._id, seen: false }, { sort: { timestamp: -1 }, limit: 1 }))[0];

  const faces = useFreshFaces(ov);
  const persons = status?.persons ?? ov?.persons?.length ?? 0;
  const fps = (ov?.fps ?? status?.fps ?? 0);
  const isLive = streamState === 'live';

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === videoBoxRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else videoBoxRef.current?.requestFullscreen().catch(() => {});
  };

  return (
    <Box key={cam._id} sx={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 1.5,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', ...sx,
    }}>
      {/* card header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.9,
        borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <Box sx={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: isLive ? C.green : C.dim,
          boxShadow: isLive ? `0 0 6px ${C.green}` : 'none',
        }} />
        <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {cam.name}
        </Typography>
        {cam.zone && (
          <Typography sx={{ fontFamily: MONO, fontSize: 10, color: C.label, letterSpacing: 1, textTransform: 'uppercase' }}>
            {cam.zone}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>
          {fps.toFixed(1)} FPS
        </Typography>
        {!embedded && (
          <IconButton size="small" title={popped ? 'pop-out open' : 'pop out to window'}
            onClick={() => setPopped(true)} disabled={popped}
            sx={{ color: popped ? C.accent : C.dim, p: 0.4, '&:hover': { color: C.text } }}>
            <OpenInNewIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
        <IconButton size="small" title="restart camera"
          onClick={async () => { await Meteor.callAsync('restartCamHandler', cam._id || ''); setMessage('Cam process restarted'); }}
          sx={{ color: C.dim, p: 0.4, '&:hover': { color: C.text } }}>
          <RestartAltIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* pop-out: same tile rendered into a chromeless window */}
      {popped && (
        <PopOut title={`${cam.name}${cam.zone ? ' · ' + cam.zone : ''}`} onClose={() => setPopped(false)}>
          <LiveCamPlayer cam={cam} embedded sx={{ height: '100vh', borderRadius: 0, border: 'none' }} />
        </PopOut>
      )}

      {/* video tile */}
      <Box ref={videoBoxRef} sx={{
        position: 'relative', width: '100%', paddingTop: '56.25%',
        overflow: 'hidden', background: '#000',
      }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />

        {/* alert badge (top-left) */}
        {alert && (
          <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
            <AlertBadge keyword={alert.keyword} onDismiss={() => Meteor.call('markCaptionAlertSeen', alert._id)} />
          </Box>
        )}

        {/* live counts (top-right) */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
          <StatChip overlay label="PERSONS" value={persons} color={persons ? OVERLAY.text : OVERLAY.dim} />
          <StatChip overlay label="FACES" value={faces.length} color={faces.length ? OVERLAY.text : OVERLAY.dim} />
        </Box>

        {!isLive && (
          <Typography onClick={() => setStreamEpoch((e) => e + 1)}
            sx={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              color: OVERLAY.dim, fontFamily: MONO, fontSize: 12, cursor: 'pointer', textAlign: 'center',
            }}>
            {streamState === 'connecting' ? 'connecting…' : 'stream unavailable — click to retry'}
          </Typography>
        )}
      </Box>

      {/* tabs */}
      <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
        <TabButton active={tab === 'sidebar'} onClick={() => setTab('sidebar')}>SIDEBAR</TabButton>
        <TabButton active={tab === 'captions'} onClick={() => setTab('captions')}>CAPTIONS</TabButton>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={toggleFullscreen}
          sx={{ color: C.dim, p: 0.4, mr: 0.5, '&:hover': { color: C.text } }}>
          {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 16 }} /> : <FullscreenIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      {/* active panel */}
      {tab === 'captions' ? <CaptionsPanel cam={cam} /> : <SidebarPanel cam={cam} faces={faces} />}

      <Snackbar open={!!message} autoHideDuration={3000} onClose={() => setMessage(null)} message={message || ''} />
    </Box>
  );
};

// ── page: aggregate header + camera grid ──────────────────────────────────────
const LivestreamRenderer = () => {
  const C = usePalette();
  useSubscribe('cams');
  useSubscribe('cam_live_status');
  useSubscribe('caption_alerts_unseen');
  const cams = useFind(() => CamsCollection.find({}));
  const statuses = useFind(() => CamLiveStatusCollection.find({}));
  const unseenAlerts = useFind(() => CaptionAlertsCollection.find({ seen: false }));
  const clock = useClock();

  const totalPersons = statuses.reduce((s, x) => s + (x.persons || 0), 0);
  const liveCount = statuses.filter((s) => (s.fps || 0) > 0).length || cams.length;
  const zones = Array.from(new Set(cams.map((c) => c.zone).filter(Boolean))) as string[];
  const subtitle = zones.length ? zones.join(' · ') : `${cams.length} CAMERAS`;

  return (
    <Box sx={{ background: C.bg, minHeight: '100%', color: C.text }}>
      {/* top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5,
        borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 5,
        background: 'rgba(from var(--mui-palette-background-default) r g b / 0.92)',
        backdropFilter: 'blur(6px)',
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: C.text }}>Live Stream</Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: C.label, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {subtitle}
        </Typography>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.4,
          border: `1px solid ${C.border}`, borderRadius: 3,
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <Typography sx={{ fontFamily: MONO, fontSize: 11, color: C.text, letterSpacing: 0.5 }}>{liveCount} LIVE</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontFamily: MONO }}>
          <Typography sx={{ fontSize: 10, letterSpacing: 1, color: C.label }}>PERSONS</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.text }}>{totalPersons}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontFamily: MONO }}>
          <Typography sx={{ fontSize: 10, letterSpacing: 1, color: C.label }}>ALERTS</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: unseenAlerts.length ? C.red : C.text }}>
            {unseenAlerts.length}
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: MONO, fontSize: 13, color: C.text, letterSpacing: 1, ml: 1 }}>{clock}</Typography>
      </Box>

      {/* camera grid */}
      <Box sx={{
        display: 'grid', gap: 2, p: 2.5,
        gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
      }}>
        {cams.map((cam) => <LiveCamPlayer key={cam._id} cam={cam} />)}
      </Box>
    </Box>
  );
};

const LiveStreamApp: AppType = {
  appName: 'Live Stream',
  render: LivestreamRenderer,
  appIcon: <Icon />,
};
export default LiveStreamApp;
