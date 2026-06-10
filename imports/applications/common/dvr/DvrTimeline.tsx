import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Cam } from '/imports/api/cams';
import { Recording } from '/imports/api/recordings';

export const CAM_COLORS = [
  '#2196f3', '#4caf50', '#ff9800', '#e91e63',
  '#9c27b0', '#00bcd4', '#8bc34a', '#ff5722',
];

const ROW_HEIGHT  = 26;
const AXIS_HEIGHT = 22;
const LABEL_WIDTH = 72; // px reserved for camera name on the left

function tickInterval(rangeMs: number): number {
  if (rangeMs <=    900_000) return      60_000; // 15 min → 1 min ticks
  if (rangeMs <=  3_600_000) return     300_000; // 1 h → 5 min
  if (rangeMs <= 21_600_000) return   1_800_000; // 6 h → 30 min
  return                               3_600_000; // 24 h → 1 h
}

function tickLabel(ms: number, rangeMs: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return rangeMs <= 21_600_000 ? `${h}:${m}` : `${h}:00`;
}

interface Props {
  cams:        Array<Cam & { _id: string }>;
  recordings:  Recording[];
  viewStart:   number;
  viewEnd:     number;
  currentTime: number;
  onSeek:      (t: number) => void;
}

export const DvrTimeline: React.FC<Props> = ({
  cams, recordings, viewStart, viewEnd, currentTime, onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging]  = useState(false);

  const rangeMs = viewEnd - viewStart;

  const pct = useCallback((ms: number) =>
    ((ms - viewStart) / rangeMs) * 100, [viewStart, rangeMs]);

  const clientXToTime = useCallback((clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return currentTime;
    const available = rect.width - LABEL_WIDTH;
    const x = clientX - rect.left - LABEL_WIDTH;
    return viewStart + (x / available) * rangeMs;
  }, [viewStart, rangeMs, currentTime]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    onSeek(Math.max(viewStart, Math.min(viewEnd, clientXToTime(e.clientX))));
  }, [clientXToTime, onSeek, viewStart, viewEnd]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) =>
      onSeek(Math.max(viewStart, Math.min(viewEnd, clientXToTime(e.clientX))));
    const up = () => setDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [dragging, clientXToTime, onSeek, viewStart, viewEnd]);

  const interval = tickInterval(rangeMs);
  const firstTick = Math.ceil(viewStart / interval) * interval;
  const ticks: number[] = [];
  for (let t = firstTick; t <= viewEnd; t += interval) ticks.push(t);

  const totalHeight = AXIS_HEIGHT + cams.length * ROW_HEIGHT;
  const playheadPct = Math.max(0, Math.min(100, pct(currentTime)));

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      sx={{
        position: 'relative',
        height: totalHeight,
        cursor: 'crosshair',
        userSelect: 'none',
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
        display: 'flex',
      }}
    >
      {/* Fixed left label column */}
      <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, position: 'relative', zIndex: 2, borderRight: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ height: AXIS_HEIGHT }} /> {/* spacer for axis row */}
        {cams.map((cam, idx) => (
          <Box key={cam._id} sx={{
            height: ROW_HEIGHT,
            display: 'flex', alignItems: 'center', px: 0.5,
            borderBottom: idx < cams.length - 1 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CAM_COLORS[idx % CAM_COLORS.length], mr: 0.5, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cam.name}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Scrollable track area */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Time axis */}
        <Box sx={{ height: AXIS_HEIGHT, position: 'relative', borderBottom: '1px solid', borderColor: 'divider' }}>
          {ticks.map(t => (
            <Box key={t} sx={{ position: 'absolute', left: `${pct(t)}%`, top: 0, bottom: 0 }}>
              <Box sx={{ position: 'absolute', top: 0, width: '1px', height: '100%', bgcolor: 'divider' }} />
              <Typography variant="caption" sx={{
                position: 'absolute', top: 3, left: 3, fontSize: '0.58rem',
                color: 'text.secondary', whiteSpace: 'nowrap', lineHeight: 1,
              }}>
                {tickLabel(t, rangeMs)}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Camera recording rows */}
        {cams.map((cam, idx) => {
          const color = CAM_COLORS[idx % CAM_COLORS.length];
          const camRecs = recordings.filter(r => r.camId === cam._id);
          return (
            <Box key={cam._id} sx={{
              position: 'relative',
              height: ROW_HEIGHT,
              bgcolor: idx % 2 === 0 ? 'action.hover' : 'transparent',
              borderBottom: idx < cams.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}>
              {camRecs.map(rec => {
                const rStart = Math.max(rec.startedAt.getTime(), viewStart);
                const rEnd   = Math.min((rec.endedAt?.getTime() ?? Date.now()), viewEnd);
                if (rEnd <= rStart) return null;
                const left  = pct(rStart);
                const width = pct(rEnd) - left;
                return (
                  <Box key={rec._id} sx={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${Math.max(width, 0.15)}%`,
                    top: 4, bottom: 4,
                    bgcolor: color,
                    opacity: rec.status === 'recording' ? 0.95 : 0.6,
                    borderRadius: 0.5,
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 1 },
                  }} />
                );
              })}
            </Box>
          );
        })}

        {/* Playhead */}
        <Box sx={{
          position: 'absolute',
          left: `${playheadPct}%`,
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: 'error.main',
          zIndex: 10,
          pointerEvents: 'none',
          transform: 'translateX(-50%)',
        }}>
          {/* Triangle at top */}
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '7px solid',
            borderTopColor: 'error.main',
          }} />
        </Box>
      </Box>
    </Box>
  );
};
