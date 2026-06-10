import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, Stack, Chip,
  IconButton, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { CamsCollection, Cam } from '/imports/api/cams';
import { RecordingsCollection, Recording } from '/imports/api/recordings';
import { AppType, AppProps } from '../..';
import Icon from './icon';
import { DvrTimeline, CAM_COLORS } from './DvrTimeline';
import { CamPlayer } from './CamPlayer';

import PlayArrowIcon      from '@mui/icons-material/PlayArrow';
import PauseIcon          from '@mui/icons-material/Pause';
import SkipNextIcon       from '@mui/icons-material/SkipNext';
import SkipPreviousIcon   from '@mui/icons-material/SkipPrevious';
import ChevronLeftIcon    from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon   from '@mui/icons-material/ChevronRight';

// ── Helpers ──────────────────────────────────────────────────────────────────

function dayFloor(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const ZOOM_OPTIONS = [
  { label: '24h', ms: 86_400_000 },
  { label: '6h',  ms: 21_600_000 },
  { label: '1h',  ms:  3_600_000 },
  { label: '15m', ms:    900_000 },
];
const SPEED_OPTIONS = [1, 2, 4, 8];

// ── Main DVR Component ────────────────────────────────────────────────────────

const DvrApp: React.FC<AppProps> = () => {
  const now = useMemo(() => new Date(), []);

  const [viewDate,       setViewDate]       = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [selectedCamIds, setSelectedCamIds] = useState<string[]>([]);
  const [playing,        setPlaying]        = useState(false);
  const [playbackRate,   setPlaybackRate]   = useState(1);
  const [zoomMs,         setZoomMs]         = useState(86_400_000);
  const [currentTime,    setCurrentTime]    = useState<number>(() => Date.now());

  const dayStart = useMemo(() => dayFloor(viewDate), [viewDate]);
  const dayEnd   = useMemo(() => dayStart + 86_400_000, [dayStart]);

  // Timeline visible window: follows playhead when zoomed in
  const viewStart = useMemo(() => {
    if (zoomMs >= 86_400_000) return dayStart;
    const half    = zoomMs / 2;
    const clamped = Math.max(dayStart + half, Math.min(dayEnd - half, currentTime));
    return Math.max(dayStart, clamped - half);
  }, [zoomMs, dayStart, dayEnd, currentTime]);
  const viewEnd = useMemo(() => Math.min(dayEnd, viewStart + zoomMs), [viewStart, zoomMs, dayEnd]);

  // ── Meteor data ────────────────────────────────────────────────────────────
  useSubscribe('cams');
  const allCams = useFind(() => CamsCollection.find({}, { sort: { name: 1 } }));

  useSubscribe('recordings', selectedCamIds, dayStart, dayEnd, 500);
  const recordings = useFind(() =>
    RecordingsCollection.find(
      { camId: { $in: selectedCamIds }, startedAt: { $gte: new Date(dayStart), $lt: new Date(dayEnd) } },
      { sort: { startedAt: 1 } },
    ),
    [selectedCamIds, dayStart, dayEnd],
  );

  const selectedCams = useMemo(() =>
    allCams.filter(c => c._id && selectedCamIds.includes(c._id)) as Array<Cam & { _id: string }>,
    [allCams, selectedCamIds],
  );

  const masterCamId = selectedCamIds[0] ?? null;

  // ── Stable refs for callbacks ──────────────────────────────────────────────
  const recordingsRef      = useRef<Recording[]>(recordings);
  const currentTimeRef     = useRef(currentTime);
  const masterCamIdRef     = useRef(masterCamId);
  const lastClockUpdateRef = useRef(0);
  useEffect(() => { recordingsRef.current = recordings; }, [recordings]);
  useEffect(() => { masterCamIdRef.current = masterCamId; }, [masterCamId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((t: number) => {
    const clamped = Math.max(dayStart, Math.min(dayEnd - 1, t));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
  }, [dayStart, dayEnd]);

  // Throttle state updates to 200 ms — the video timeupdate event fires up to
  // 60 fps in Safari. Updating React state every frame causes all CamPlayers
  // (and their effects) to re-run on each frame, creating the feedback loop.
  // currentTimeRef is kept always-current for internal callbacks.
  const handleTimeUpdate = useCallback((t: number) => {
    currentTimeRef.current = t;
    const now = performance.now();
    if (now - lastClockUpdateRef.current >= 200) {
      lastClockUpdateRef.current = now;
      setCurrentTime(t);
    }
  }, []);

  const handleEnded = useCallback(() => {
    const cid = masterCamIdRef.current;
    // Use a 2 s look-behind so continuous recordings (R2.startedAt == R1.endedAt)
    // are found even when currentTimeRef drifts slightly past the boundary.
    // DVR segments are always several minutes long so the current segment's own
    // startedAt is never within 2 s of its endedAt.
    const next = recordingsRef.current
      .filter(r => r.camId === cid && r.startedAt.getTime() >= currentTimeRef.current - 2000)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())[0];
    if (next) {
      setCurrentTime(next.startedAt.getTime());
    } else {
      setPlaying(false);
    }
  }, []);

  const navigateDay = (delta: number) => {
    const next = new Date(viewDate.getTime() + delta * 86_400_000);
    setViewDate(next);
    setCurrentTime(dayFloor(next));
    setPlaying(false);
  };

  const jumpPrev = () => {
    const prev = recordings
      .filter(r => r.camId === masterCamId && r.startedAt.getTime() < currentTime - 500)
      .at(-1);
    if (prev) setCurrentTime(prev.startedAt.getTime());
  };
  const jumpNext = () => {
    const next = recordings
      .find(r => r.camId === masterCamId && r.startedAt.getTime() > currentTime + 500);
    if (next) setCurrentTime(next.startedAt.getTime());
  };

  const toggleCam = (camId: string) => {
    setSelectedCamIds(prev =>
      prev.includes(camId) ? prev.filter(id => id !== camId) : [...prev, camId],
    );
    setPlaying(false);
  };

  // ── Grid columns ───────────────────────────────────────────────────────────
  const gridCols = selectedCams.length <= 1 ? '1fr'
    : selectedCams.length <= 4              ? 'repeat(2, 1fr)'
    :                                         'repeat(3, 1fr)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        px: 1.5, py: 0.5,
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
        borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0,
      }}>

        {/* Date nav */}
        <Stack direction="row" alignItems="center" spacing={0}>
          <IconButton size="small" onClick={() => navigateDay(-1)}><ChevronLeftIcon fontSize="small" /></IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 88, textAlign: 'center', fontFamily: 'monospace' }}>
            {formatDate(viewDate)}
          </Typography>
          <IconButton size="small" onClick={() => navigateDay(1)}><ChevronRightIcon fontSize="small" /></IconButton>
        </Stack>

        {/* Playback */}
        <Stack direction="row" alignItems="center" spacing={0}>
          <IconButton size="small" onClick={jumpPrev} disabled={!masterCamId}>
            <SkipPreviousIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setPlaying(p => !p)}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <IconButton size="small" onClick={jumpNext} disabled={!masterCamId}>
            <SkipNextIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Clock */}
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 60 }}>
          {formatTime(currentTime)}
        </Typography>

        {/* Speed */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">Speed</Typography>
          <ToggleButtonGroup size="small" exclusive value={playbackRate}
            onChange={(_, v) => v != null && setPlaybackRate(v)}>
            {SPEED_OPTIONS.map(s => (
              <ToggleButton key={s} value={s} sx={{ px: 0.75, py: 0, minWidth: 30, fontSize: '0.68rem' }}>
                {s}×
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {/* Zoom */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">Zoom</Typography>
          <ToggleButtonGroup size="small" exclusive value={zoomMs}
            onChange={(_, v) => v != null && setZoomMs(v)}>
            {ZOOM_OPTIONS.map(z => (
              <ToggleButton key={z.ms} value={z.ms} sx={{ px: 0.75, py: 0, minWidth: 34, fontSize: '0.68rem' }}>
                {z.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* ── Camera selector ──────────────────────────────────────────────── */}
      <Box sx={{
        px: 1.5, py: 0.5,
        display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center',
        borderBottom: '1px solid', borderColor: 'divider',
        flexShrink: 0,
      }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Cameras:</Typography>
        {allCams.length === 0 && (
          <Typography variant="caption" color="text.disabled">No cameras configured</Typography>
        )}
        {allCams.map((cam) => {
          const selected = !!(cam._id && selectedCamIds.includes(cam._id));
          const color    = CAM_COLORS[selectedCamIds.indexOf(cam._id!) % CAM_COLORS.length];
          return (
            <Chip
              key={cam._id}
              label={cam.name}
              size="small"
              onClick={() => cam._id && toggleCam(cam._id)}
              variant={selected ? 'filled' : 'outlined'}
              sx={{
                height: 22,
                '& .MuiChip-label': { fontSize: '0.68rem', px: 0.75 },
                ...(selected && { bgcolor: color, color: '#fff', '&:hover': { bgcolor: color, filter: 'brightness(1.1)' } }),
              }}
            />
          );
        })}
      </Box>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      {selectedCams.length > 0 && (
        <DvrTimeline
          cams={selectedCams}
          recordings={recordings}
          viewStart={viewStart}
          viewEnd={viewEnd}
          currentTime={currentTime}
          onSeek={handleSeek}
        />
      )}

      {/* ── Video grid ───────────────────────────────────────────────────── */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        p: 1,
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: 1,
        alignContent: 'start',
      }}>
        {selectedCams.length === 0 ? (
          <Box sx={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <Typography color="text.disabled">
              Select cameras above to view recordings
            </Typography>
          </Box>
        ) : (
          selectedCams.map(cam => (
            <CamPlayer
              key={cam._id}
              cam={cam}
              recordings={recordings}
              currentTime={currentTime}
              playing={playing}
              playbackRate={playbackRate}
              isMaster={cam._id === masterCamId}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
            />
          ))
        )}
      </Box>
    </Box>
  );
};

// ── App registration ──────────────────────────────────────────────────────────

const DvrAppDef: AppType = {
  appName:  'DVR',
  render:   (props) => <DvrApp {...props} />,
  appIcon:  <Icon />,
  module:   'common',
};
export default DvrAppDef;
