import React, { useRef, useEffect, useMemo, useCallback, useState, memo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Cam } from '/imports/api/cams';
import { Recording } from '/imports/api/recordings';

interface Props {
  cam:          Cam & { _id: string };
  recordings:   Recording[];
  currentTime:  number;
  playing:      boolean;
  playbackRate: number;
  isMaster:     boolean;
  onTimeUpdate: (t: number) => void;
  onEnded:      () => void;
}

const CamPlayerInner: React.FC<Props> = ({
  cam, recordings, currentTime, playing, playbackRate, isMaster, onTimeUpdate, onEnded,
}) => {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const loadedRecIdRef  = useRef<string | null>(null);
  const isReadyRef      = useRef(false);
  const pendingPlayRef  = useRef(false);
  // Last time value the master reported via onTimeUpdate.
  // Used to distinguish self-generated currentTime updates from external seeks.
  const lastReportedRef = useRef<number>(currentTime);

  const activeRecRef   = useRef<Recording | null>(null);
  const currentTimeRef = useRef(currentTime);

  const [loading, setLoading]   = useState(false);
  const [hasError, setHasError] = useState(false);

  // Recording covering the current timeline position.
  // Add 3 s tolerance past endedAt so a video file that's slightly longer than
  // the wall-clock interval doesn't cause activeRec to flicker to null before
  // the video's own `ended` event fires.
  const activeRec = useMemo(() =>
    recordings.find(r =>
      r.camId === cam._id &&
      r.startedAt.getTime() <= currentTime &&
      (r.endedAt ? r.endedAt.getTime() + 3000 : Date.now() + 5000) >= currentTime
    ) ?? null,
    [recordings, cam._id, currentTime],
  );

  useEffect(() => { activeRecRef.current  = activeRec;    }, [activeRec]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // ── Seek helper ──────────────────────────────────────────────────────────────
  const seekToCurrentTime = useCallback(() => {
    const video = videoRef.current;
    const rec   = activeRecRef.current;
    if (!video || !rec) return;
    const t = Math.max(0, (currentTimeRef.current - rec.startedAt.getTime()) / 1000);
    if (!isFinite(t)) return;
    // Clamp to actual duration to avoid ending up on the last frame when
    // the file is shorter than the recorded wall-clock interval (e.g. ongoing segment).
    const clamped = isFinite(video.duration) && video.duration > 0
      ? Math.min(t, video.duration - 0.1)
      : t;
    video.currentTime = clamped;
  }, []);

  // ── Load new segment ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeRec?._id === loadedRecIdRef.current) return;
    loadedRecIdRef.current = activeRec?._id ?? null;
    isReadyRef.current = false;
    // Reset so the sync effect doesn't treat the next currentTime change as an external seek
    lastReportedRef.current = currentTimeRef.current;
    setHasError(false);

    const video = videoRef.current;
    if (!video) return;

    if (activeRec) {
      setLoading(true);
      pendingPlayRef.current = playing;
      video.src = `/dvr-media/${activeRec._id}`;
      video.load();
    } else {
      setLoading(false);
      video.removeAttribute('src');
      video.load();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRec?._id]);

  // ── Play / pause ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      if (isReadyRef.current) {
        video.play().catch(() => { pendingPlayRef.current = true; });
      } else {
        pendingPlayRef.current = true;
      }
    } else {
      pendingPlayRef.current = false;
      video.pause();
    }
  }, [playing]);

  // ── Playback rate ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  // ── Sync video position to external currentTime ──────────────────────────────
  //
  // Rules:
  //   paused   → always snap to currentTime (user seeking via timeline)
  //   playing, master  → skip if change came from our own handleTimeUpdate
  //                       (detected via lastReportedRef); seek only on external jumps
  //   playing, slave   → seek if drifted >2.5 s from master clock
  useEffect(() => {
    const video = videoRef.current;
    const rec   = activeRecRef.current;
    if (!video || !rec || !isReadyRef.current) return;

    const target = Math.max(0, (currentTime - rec.startedAt.getTime()) / 1000);
    if (!isFinite(target)) return;

    if (!playing) {
      const clamped = isFinite(video.duration) && video.duration > 0
        ? Math.min(target, video.duration - 0.1)
        : target;
      video.currentTime = clamped;
      return;
    }

    if (isMaster) {
      // If currentTime is close to what we last reported, it came from our own
      // timeupdate — ignore it to avoid seeking during normal playback.
      if (Math.abs(currentTime - lastReportedRef.current) > 500) {
        video.currentTime = target;
      }
    } else {
      if (Math.abs(video.currentTime - target) > 2.5) {
        video.currentTime = target;
      }
    }
  }, [currentTime, playing, isMaster]);

  // ── seeked: play if a play was requested while the video was seeking ──────────
  const handleSeeked = useCallback(() => {
    if (!pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    videoRef.current?.play().catch(() => {});
  }, []);

  // ── canplay: seek to position on first load; ignored on subsequent events ─────
  // canplay fires repeatedly during buffering (e.g. after every seek, every
  // buffer-ahead). If we seek inside every canplay we get an infinite
  // seek → canplay → seek → canplay loop that makes the video flash.
  // Guard: only act on the very first canplay after a new segment is loaded
  // (isReadyRef is false exactly then). Subsequent canplay events only clear
  // the loading spinner.
  const handleCanPlay = useCallback(() => {
    setLoading(false);
    if (isReadyRef.current) return;   // already initialised — ignore repeat events
    isReadyRef.current = true;
    seekToCurrentTime();
    if (pendingPlayRef.current) {
      const video = videoRef.current;
      if (video && !video.seeking) {
        pendingPlayRef.current = false;
        video.play().catch(() => { pendingPlayRef.current = true; });
      }
      // if still seeking, handleSeeked will fire and start play
    }
  }, [seekToCurrentTime]);

  // ── timeupdate: master drives the external clock ──────────────────────────────
  // Guards:
  //   - only master reports
  //   - only when video is ready (blocks loading-phase currentTime=0 events)
  //   - only when video is actually playing (blocks spurious events after pause)
  const handleTimeUpdate = useCallback(() => {
    if (!isMaster || !isReadyRef.current) return;
    const video = videoRef.current;
    if (!video || video.paused) return;
    const rec = activeRecRef.current;
    if (!rec) return;
    const t = rec.startedAt.getTime() + video.currentTime * 1000;
    lastReportedRef.current = t;  // record before calling setter to match React's next render
    onTimeUpdate(t);
  }, [isMaster, onTimeUpdate]);

  return (
    <Box sx={{
      bgcolor: '#0e0e0e',
      borderRadius: 1,
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid',
      borderColor: isMaster ? 'primary.main' : 'transparent',
    }}>
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        background: 'linear-gradient(rgba(0,0,0,0.65),transparent)',
        px: 1, py: 0.5, display: 'flex', justifyContent: 'space-between',
      }}>
        <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 600 }}>
          {cam.name}
        </Typography>
        {isMaster && (
          <Typography variant="caption" sx={{ color: 'primary.light', fontSize: '0.65rem' }}>
            MASTER
          </Typography>
        )}
      </Box>

      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, bgcolor: 'rgba(0,0,0,0.35)' }}>
          <CircularProgress size={28} sx={{ color: '#fff' }} />
        </Box>
      )}

      {activeRec ? (
        <video
          ref={videoRef}
          style={{ width: '100%', display: 'block', minHeight: 130, maxHeight: 360, background: '#000' }}
          onCanPlay={handleCanPlay}
          onSeeked={handleSeeked}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onEnded}
          onError={() => { setLoading(false); setHasError(true); }}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
        />
      ) : (
        <Box sx={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'grey.600', fontSize: '0.7rem' }}>
            {hasError ? 'File unavailable' : 'No recording at this time'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export const CamPlayer = memo(CamPlayerInner);
