import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import {
    Autocomplete, Box, Button, FormControlLabel, IconButton,
    Paper, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { CamLine, CamOverlayZone } from '/imports/api/cams';
import type { CamLineDef } from '/imports/api/camLineDefs';
import type { CamZoneDef } from '/imports/api/camZoneDefs';

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardState =
    | { phase: 'idle' }
    | { phase: 'type' }
    | { phase: 'name'; kind: 'line' | 'zone' }
    | { phase: 'orientation'; label: string }
    | { phase: 'draw-line'; label: string; orientation: 'v' | 'h'; points: [number, number][]; color: string }
    | { phase: 'draw-zone'; label: string; points: [number, number][]; color: string; marking: boolean }
    | { phase: 'edit-line'; index: number; label: string; color: string }
    | { phase: 'edit-zone'; index: number; label: string; color: string; marking: boolean };

type DragTarget =
    | { kind: 'line-p1' | 'line-p2'; index: number }
    | { kind: 'zone-point'; index: number; pointIndex: number }
    | { kind: 'new-p1' | 'new-p2' }
    | { kind: 'new-zone-point'; pointIndex: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snapToEdge(x: number, y: number, orientation: 'v' | 'h', isSecond: boolean): [number, number] {
    if (orientation === 'v') return [x, isSecond ? 1 : 0];
    return [isSecond ? 1 : 0, y];
}

function constrainDrag(line: CamLine, isP2: boolean, x: number, y: number): [number, number] {
    if (line.orientation === 'v') return [x, isP2 ? 1 : 0];
    return [isP2 ? 1 : 0, y];
}

function lineCoords(line: CamLine): [number, number, number, number] {
    if (line.orientation === 'v') return [line.top ?? 0.5, 0, line.bottom ?? 0.5, 1];
    return [0, line.left ?? 0.5, 1, line.right ?? 0.5];
}

// Default p2 when only p1 is placed — shows the full line immediately
function draftP2(p1: [number, number], orientation: 'v' | 'h'): [number, number] {
    return orientation === 'v' ? [p1[0], 1] : [1, p1[1]];
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
    imageData: string;
    lines: CamLine[];
    overlayZones: CamOverlayZone[];
    lineDefs: CamLineDef[];
    zoneDefs: CamZoneDef[];
    onChange: (lines: CamLine[], overlayZones: CamOverlayZone[]) => void;
    onError: (msg: string) => void;
};

const CamOverlay: React.FC<Props> = ({
    imageData, lines, overlayZones, lineDefs, zoneDefs, onChange, onError
}) => {
    const [wizard, setWizard] = useState<WizardState>({ phase: 'idle' });
    const [nameInput, setNameInput] = useState('');
    const [panelPos, setPanelPos] = useState({ x: 8, y: 8 });

    const svgRef = useRef<SVGSVGElement>(null);
    const dragTarget = useRef<DragTarget | null>(null);
    const dragMoved = useRef(false);

    // Always-fresh refs — avoid stale closures in global mousemove handlers
    const linesRef = useRef(lines);
    const zonesRef = useRef(overlayZones);
    useEffect(() => { linesRef.current = lines; }, [lines]);
    useEffect(() => { zonesRef.current = overlayZones; }, [overlayZones]);

    // ── Coordinate helper ─────────────────────────────────────────────────
    const getSvgXY = (clientX: number, clientY: number): [number, number] => {
        if (!svgRef.current) return [0, 0];
        const r = svgRef.current.getBoundingClientRect();
        return [
            Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
            Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
        ];
    };

    // ── Element drag (dots on lines/zones) ────────────────────────────────
    const startDrag = useCallback((target: DragTarget) => {
        dragTarget.current = target;
        dragMoved.current = false;

        const onMove = (e: MouseEvent) => {
            dragMoved.current = true;
            const [x, y] = getSvgXY(e.clientX, e.clientY);
            const dt = dragTarget.current;
            if (!dt) return;

            if (dt.kind === 'line-p1' || dt.kind === 'line-p2') {
                const isP2 = dt.kind === 'line-p2';
                const line = linesRef.current[dt.index];
                const [nx, ny] = constrainDrag(line, isP2, x, y);
                onChange(
                    linesRef.current.map((l, i) => {
                        if (i !== dt.index) return l;
                        if (isP2) return l.orientation === 'v' ? { ...l, bottom: nx } : { ...l, right: ny };
                        return l.orientation === 'v' ? { ...l, top: nx } : { ...l, left: ny };
                    }),
                    zonesRef.current
                );
            } else if (dt.kind === 'zone-point') {
                onChange(
                    linesRef.current,
                    zonesRef.current.map((z, i) => {
                        if (i !== dt.index) return z;
                        return {
                            ...z,
                            points: z.points.map((p, j) =>
                                j === dt.pointIndex ? [x, y] as [number, number] : p
                            ),
                        };
                    })
                );
            } else if (dt.kind === 'new-p1' || dt.kind === 'new-p2') {
                const isP2 = dt.kind === 'new-p2';
                setWizard(prev => {
                    if (prev.phase !== 'draw-line') return prev;
                    const [nx, ny] = snapToEdge(x, y, prev.orientation, isP2);
                    return {
                        ...prev,
                        points: prev.points.map((p, i) =>
                            i === (isP2 ? 1 : 0) ? [nx, ny] as [number, number] : p
                        ),
                    };
                });
            } else if (dt.kind === 'new-zone-point') {
                setWizard(prev => {
                    if (prev.phase !== 'draw-zone') return prev;
                    return {
                        ...prev,
                        points: prev.points.map((p, i) =>
                            i === dt.pointIndex ? [x, y] as [number, number] : p
                        ),
                    };
                });
            }
        };

        const onUp = () => {
            dragTarget.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [onChange]);

    // ── Panel drag ────────────────────────────────────────────────────────
    const startPanelDrag = (e: React.MouseEvent) => {
        e.stopPropagation();
        const startX = e.clientX - panelPos.x;
        const startY = e.clientY - panelPos.y;

        const onMove = (ev: MouseEvent) => {
            setPanelPos({ x: ev.clientX - startX, y: ev.clientY - startY });
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    // ── SVG click: place points when drawing ──────────────────────────────
    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (dragMoved.current) { dragMoved.current = false; return; }
        const [x, y] = getSvgXY(e.clientX, e.clientY);

        setWizard(prev => {
            if (prev.phase === 'draw-line') {
                if (prev.points.length === 0) {
                    // Place p1 snapped to first edge, p2 at default opposite edge
                    const p1 = snapToEdge(x, y, prev.orientation, false);
                    return { ...prev, points: [p1, draftP2(p1, prev.orientation)] };
                }
                if (prev.points.length >= 1) {
                    // Update p2 on subsequent clicks
                    return { ...prev, points: [prev.points[0], snapToEdge(x, y, prev.orientation, true)] };
                }
            } else if (prev.phase === 'draw-zone') {
                return { ...prev, points: [...prev.points, [x, y] as [number, number]] };
            }
            return prev;
        });
    };

    const handleClickLine = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (dragMoved.current) return;
        if (wizard.phase !== 'idle') return;
        const line = lines[index];
        setWizard({ phase: 'edit-line', index, label: line.label, color: line.lineColor });
    };

    const handleClickZone = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (dragMoved.current) return;
        if (wizard.phase !== 'idle') return;
        const zone = overlayZones[index];
        setWizard({ phase: 'edit-zone', index, label: zone.label, color: zone.borderColor, marking: zone.zoneMarking });
    };

    // ── Save handlers ─────────────────────────────────────────────────────
    const handleSaveLine = async () => {
        if (wizard.phase !== 'draw-line' || wizard.points.length < 2) return;
        try {
            const existing = lineDefs.find(d => d.label === wizard.label);
            const lineId: string = existing?._id
                ?? await Meteor.callAsync('insertCamLineDef', { label: wizard.label });
            const [p1, p2] = wizard.points;
            const newLine: CamLine = {
                lineId,
                label: wizard.label,
                orientation: wizard.orientation,
                lineColor: wizard.color,
                ...(wizard.orientation === 'v'
                    ? { top: p1[0], bottom: p2[0] }
                    : { left: p1[1], right: p2[1] }),
            };
            onChange([...lines, newLine], overlayZones);
            setWizard({ phase: 'idle' });
        } catch (err: any) { onError(err.reason); }
    };

    const handleSaveZone = async () => {
        if (wizard.phase !== 'draw-zone' || wizard.points.length < 3) return;
        try {
            const existing = zoneDefs.find(d => d.label === wizard.label);
            const zoneId: string = existing?._id
                ?? await Meteor.callAsync('insertCamZoneDef', { label: wizard.label });
            const newZone: CamOverlayZone = {
                zoneId,
                label: wizard.label,
                points: wizard.points,
                borderColor: wizard.color,
                zoneMarking: wizard.marking,
            };
            onChange(lines, [...overlayZones, newZone]);
            setWizard({ phase: 'idle' });
        } catch (err: any) { onError(err.reason); }
    };

    const handleSaveEdit = async () => {
        if (wizard.phase === 'edit-line') {
            const line = lines[wizard.index];
            onChange(
                lines.map((l, i) => i === wizard.index ? { ...l, label: wizard.label, lineColor: wizard.color } : l),
                overlayZones
            );
            try { await Meteor.callAsync('updateCamLineDef', line.lineId, { label: wizard.label }); } catch { }
            setWizard({ phase: 'idle' });
        } else if (wizard.phase === 'edit-zone') {
            const zone = overlayZones[wizard.index];
            onChange(
                lines,
                overlayZones.map((z, i) => i === wizard.index
                    ? { ...z, label: wizard.label, borderColor: wizard.color, zoneMarking: wizard.marking }
                    : z
                )
            );
            try { await Meteor.callAsync('updateCamZoneDef', zone.zoneId, { label: wizard.label }); } catch { }
            setWizard({ phase: 'idle' });
        }
    };

    const handleDelete = () => {
        if (wizard.phase === 'edit-line') onChange(lines.filter((_, i) => i !== wizard.index), overlayZones);
        else if (wizard.phase === 'edit-zone') onChange(lines, overlayZones.filter((_, i) => i !== wizard.index));
        setWizard({ phase: 'idle' });
    };

    const close = () => { setWizard({ phase: 'idle' }); setNameInput(''); };

    const cursor = wizard.phase === 'draw-line' || wizard.phase === 'draw-zone' ? 'crosshair' : 'default';

    // ─── Render ───────────────────────────────────────────────────────────
    return (
        <Box sx={{ position: 'relative', width: '100%' }}>
            <img
                src={`data:image/jpeg;base64,${imageData}`}
                alt="Camera Preview"
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }}
            />

            <svg
                ref={svgRef}
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor }}
                onClick={handleSvgClick}
                onMouseDown={() => { dragMoved.current = false; }}
            >
                {/* ── Existing lines ── */}
                {lines.map((line, i) => {
                    const [x1, y1, x2, y2] = lineCoords(line);
                    const editing = wizard.phase === 'edit-line' && wizard.index === i;
                    return (
                        <g key={i}
                            style={{ cursor: wizard.phase === 'idle' ? 'pointer' : 'default' }}
                            onClick={e => handleClickLine(e, i)}>
                            {/* wide transparent hit area */}
                            <line x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke="transparent" strokeWidth="20"
                                vectorEffect="non-scaling-stroke" />
                            <line x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={line.lineColor} strokeWidth="3"
                                strokeDasharray={editing ? '10,6' : undefined}
                                vectorEffect="non-scaling-stroke" />
                            {editing && (
                                <>
                                    <Dot cx={x1} cy={y1} color={line.lineColor}
                                        onMouseDown={e => { e.stopPropagation(); startDrag({ kind: 'line-p1', index: i }); }} />
                                    <Dot cx={x2} cy={y2} color={line.lineColor}
                                        onMouseDown={e => { e.stopPropagation(); startDrag({ kind: 'line-p2', index: i }); }} />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* ── Existing zones ── */}
                {overlayZones.map((zone, i) => {
                    const editing = wizard.phase === 'edit-zone' && wizard.index === i;
                    const pts = zone.points.map(p => `${p[0]},${p[1]}`).join(' ');
                    return (
                        <g key={i}
                            style={{ cursor: wizard.phase === 'idle' ? 'pointer' : 'default' }}
                            onClick={e => handleClickZone(e, i)}>
                            <polygon points={pts}
                                fill={zone.zoneMarking ? `${zone.borderColor}33` : 'transparent'}
                                stroke={zone.borderColor} strokeWidth="3"
                                strokeDasharray={editing ? '10,6' : undefined}
                                vectorEffect="non-scaling-stroke" />
                            {/* wide transparent hit area */}
                            <polygon points={pts}
                                fill="transparent" stroke="transparent"
                                strokeWidth="20" vectorEffect="non-scaling-stroke" />
                            {editing && zone.points.map((p, j) => (
                                <Dot key={j} cx={p[0]} cy={p[1]} color={zone.borderColor}
                                    onMouseDown={e => { e.stopPropagation(); startDrag({ kind: 'zone-point', index: i, pointIndex: j }); }} />
                            ))}
                        </g>
                    );
                })}

                {/* ── Draft line (shown immediately after first click) ── */}
                {wizard.phase === 'draw-line' && wizard.points.length >= 1 && (() => {
                    const p1 = wizard.points[0];
                    const p2 = wizard.points[1] ?? draftP2(p1, wizard.orientation);
                    return (
                        <>
                            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]}
                                stroke={wizard.color} strokeWidth="3"
                                strokeDasharray="10,6" vectorEffect="non-scaling-stroke" />
                            <Dot cx={p1[0]} cy={p1[1]} color={wizard.color}
                                onMouseDown={e => { e.stopPropagation(); startDrag({ kind: 'new-p1' }); }} />
                            <Dot cx={p2[0]} cy={p2[1]} color={wizard.color}
                                onMouseDown={e => { e.stopPropagation(); startDrag({ kind: 'new-p2' }); }} />
                        </>
                    );
                })()}

                {/* ── Draft zone ── */}
                {wizard.phase === 'draw-zone' && wizard.points.length > 0 && (
                    <>
                        <polygon
                            points={wizard.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                            fill={wizard.points.length >= 3 && wizard.marking ? `${wizard.color}33` : 'none'}
                            stroke={wizard.color} strokeWidth="3"
                            strokeDasharray="10,6" vectorEffect="non-scaling-stroke" />
                        {wizard.points.map((p, i) => (
                            <Dot key={i} cx={p[0]} cy={p[1]} color={wizard.color}
                                onMouseDown={e => { e.stopPropagation(); startDrag({ kind: 'new-zone-point', pointIndex: i }); }} />
                        ))}
                    </>
                )}
            </svg>

            {/* ── Line labels ── */}
            {lines.map((line, i) => {
                const [x1, y1, x2, y2] = lineCoords(line);
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                return (
                    <Box key={i} sx={{
                        position: 'absolute',
                        left: `${midX * 100}%`,
                        top: `${midY * 100}%`,
                        transform: 'translate(-50%, -160%)',
                        bgcolor: `${line.lineColor}cc`,
                        color: '#fff',
                        px: 0.75, py: 0.25,
                        borderRadius: 0.5,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                    }}>
                        {line.label}
                    </Box>
                );
            })}

            {/* ── Zone labels (at centroid) ── */}
            {overlayZones.map((zone, i) => {
                const cx = zone.points.reduce((s, p) => s + p[0], 0) / zone.points.length;
                const cy = zone.points.reduce((s, p) => s + p[1], 0) / zone.points.length;
                return (
                    <Box key={i} sx={{
                        position: 'absolute',
                        left: `${cx * 100}%`,
                        top: `${cy * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        bgcolor: `${zone.borderColor}cc`,
                        color: '#fff',
                        px: 0.75, py: 0.25,
                        borderRadius: 0.5,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                    }}>
                        {zone.label}
                    </Box>
                );
            })}

            {/* ── "Add Overlay" button ── */}
            {wizard.phase === 'idle' && (
                <Button variant="contained" size="small" startIcon={<AddIcon />}
                    sx={{ position: 'absolute', top: 8, left: 8, opacity: 0.85 }}
                    onClick={() => setWizard({ phase: 'type' })}>
                    Add Overlay
                </Button>
            )}

            {/* ── Floating wizard / edit panel ── */}
            {wizard.phase !== 'idle' && (
                <Paper elevation={6} sx={{
                    position: 'absolute',
                    top: panelPos.y,
                    left: panelPos.x,
                    p: 1.5, minWidth: 230, maxWidth: 270,
                    opacity: 0.96,
                    userSelect: 'none',
                }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    {/* ── Step 1: Type ── */}
                    {wizard.phase === 'type' && (
                        <Stack spacing={1.5}>
                            <PanelRow title="Add Overlay" onClose={close} onDragStart={startPanelDrag} />
                            <Button variant="outlined" onClick={() => setWizard({ phase: 'name', kind: 'line' })}>Line</Button>
                            <Button variant="outlined" onClick={() => setWizard({ phase: 'name', kind: 'zone' })}>Zone</Button>
                        </Stack>
                    )}

                    {/* ── Step 2: Name ── */}
                    {wizard.phase === 'name' && (
                        <Stack spacing={1.5}>
                            <PanelRow title={`New ${wizard.kind} — Name`} onClose={close} onDragStart={startPanelDrag} />
                            <Autocomplete
                                freeSolo size="small"
                                options={(wizard.kind === 'line' ? lineDefs : zoneDefs).map(d => d.label)}
                                inputValue={nameInput}
                                onInputChange={(_, v) => setNameInput(v)}
                                renderInput={params => <TextField {...params} label="Label" autoFocus />}
                            />
                            <Button variant="contained" size="small" disabled={!nameInput.trim()}
                                onClick={() => {
                                    const label = nameInput.trim();
                                    setNameInput('');
                                    if (wizard.kind === 'line') {
                                        setWizard({ phase: 'orientation', label });
                                    } else {
                                        setWizard({ phase: 'draw-zone', label, points: [], color: '#44AAFF', marking: false });
                                    }
                                }}>
                                Next
                            </Button>
                        </Stack>
                    )}

                    {/* ── Step 3 (line): Orientation ── */}
                    {wizard.phase === 'orientation' && (
                        <Stack spacing={1.5}>
                            <PanelRow title={`"${wizard.label}" — Orientation`} onClose={close} onDragStart={startPanelDrag} />
                            <ToggleButtonGroup size="small" exclusive
                                onChange={(_e, v: 'v' | 'h') => {
                                    if (v) setWizard({ phase: 'draw-line', label: wizard.label, orientation: v, points: [], color: '#FF4444' });
                                }}>
                                <ToggleButton value="v">Vertical</ToggleButton>
                                <ToggleButton value="h">Horizontal</ToggleButton>
                            </ToggleButtonGroup>
                            <Typography variant="caption" color="text.secondary">
                                Vertical → classifies persons left / right<br />
                                Horizontal → classifies persons above / below
                            </Typography>
                        </Stack>
                    )}

                    {/* ── Step 4 (line): Draw ── */}
                    {wizard.phase === 'draw-line' && (
                        <Stack spacing={1.5}>
                            <PanelRow title={`"${wizard.label}"`} onClose={close} onDragStart={startPanelDrag} />
                            <Typography variant="caption" color="text.secondary">
                                {wizard.points.length === 0
                                    ? `Click to place the line`
                                    : 'Drag dots to adjust endpoints'}
                            </Typography>
                            <ColorRow label="Color" value={wizard.color}
                                onChange={c => setWizard({ ...wizard, color: c })} />
                            <Button variant="contained" size="small" startIcon={<CheckIcon />}
                                disabled={wizard.points.length < 2}
                                onClick={handleSaveLine}>
                                Save Line
                            </Button>
                        </Stack>
                    )}

                    {/* ── Step 3 (zone): Draw ── */}
                    {wizard.phase === 'draw-zone' && (
                        <Stack spacing={1.5}>
                            <PanelRow title={`"${wizard.label}"`} onClose={close} onDragStart={startPanelDrag} />
                            <Typography variant="caption" color="text.secondary">
                                {wizard.points.length < 3
                                    ? `Click to place points (${wizard.points.length} / 3 min)`
                                    : `${wizard.points.length} points — click to add more, drag to move`}
                            </Typography>
                            <ColorRow label="Color" value={wizard.color}
                                onChange={c => setWizard({ ...wizard, color: c })} />
                            <FormControlLabel
                                control={<Switch size="small" checked={wizard.marking}
                                    onChange={(_e, v) => setWizard({ ...wizard, marking: v })} />}
                                label={<Typography variant="caption">Fill zone</Typography>}
                            />
                            <Button variant="contained" size="small" startIcon={<CheckIcon />}
                                disabled={wizard.points.length < 3}
                                onClick={handleSaveZone}>
                                Save Zone
                            </Button>
                        </Stack>
                    )}

                    {/* ── Edit line ── */}
                    {wizard.phase === 'edit-line' && (
                        <Stack spacing={1.5}>
                            <PanelRow title="Edit Line" onClose={close} onDragStart={startPanelDrag} />
                            <TextField label="Label" size="small" value={wizard.label}
                                onChange={e => setWizard({ ...wizard, label: e.target.value })}
                                helperText="Updates globally across all cams" />
                            <ColorRow label="Color" value={wizard.color}
                                onChange={c => setWizard({ ...wizard, color: c })} />
                            <Typography variant="caption" color="text.secondary">
                                Drag the dots on the image to adjust position
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Button variant="contained" size="small" startIcon={<CheckIcon />} onClick={handleSaveEdit}>Save</Button>
                                <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>Delete</Button>
                            </Stack>
                        </Stack>
                    )}

                    {/* ── Edit zone ── */}
                    {wizard.phase === 'edit-zone' && (
                        <Stack spacing={1.5}>
                            <PanelRow title="Edit Zone" onClose={close} onDragStart={startPanelDrag} />
                            <TextField label="Label" size="small" value={wizard.label}
                                onChange={e => setWizard({ ...wizard, label: e.target.value })}
                                helperText="Updates globally across all cams" />
                            <ColorRow label="Color" value={wizard.color}
                                onChange={c => setWizard({ ...wizard, color: c })} />
                            <FormControlLabel
                                control={<Switch size="small" checked={wizard.marking}
                                    onChange={(_e, v) => setWizard({ ...wizard, marking: v })} />}
                                label={<Typography variant="caption">Fill zone</Typography>}
                            />
                            <Typography variant="caption" color="text.secondary">
                                Drag the dots on the image to adjust vertices
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Button variant="contained" size="small" startIcon={<CheckIcon />} onClick={handleSaveEdit}>Save</Button>
                                <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>Delete</Button>
                            </Stack>
                        </Stack>
                    )}
                </Paper>
            )}
        </Box>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type PanelRowProps = { title: string; onClose: () => void; onDragStart: (e: React.MouseEvent) => void };
const PanelRow: React.FC<PanelRowProps> = ({ title, onClose, onDragStart }) => (
    <Stack direction="row" justifyContent="space-between" alignItems="center"
        sx={{ cursor: 'move', mx: -0.5 }}
        onMouseDown={onDragStart}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
            <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', pointerEvents: 'none' }} />
            <Typography variant="subtitle2" sx={{ pointerEvents: 'none' }}>{title}</Typography>
        </Stack>
        <IconButton size="small" onMouseDown={e => e.stopPropagation()} onClick={onClose}>
            <CloseIcon fontSize="small" />
        </IconButton>
    </Stack>
);

type ColorRowProps = { label: string; value: string; onChange: (v: string) => void };
const ColorRow: React.FC<ColorRowProps> = ({ label, value, onChange }) => (
    <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption">{label}</Typography>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
            style={{ width: 36, height: 28, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', padding: 2 }} />
    </Stack>
);

// Draggable dot used for line/zone endpoints
type DotProps = {
    cx: number; cy: number; color: string;
    onMouseDown: (e: React.MouseEvent<SVGCircleElement>) => void;
};
const Dot: React.FC<DotProps> = ({ cx, cy, color, onMouseDown }) => (
    <circle cx={cx} cy={cy} r="0.018"
        fill={color} stroke="white" strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'grab' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={onMouseDown}
    />
);

export default CamOverlay;
