import React, { useState } from 'react';
import { Box, Button, Popover, Stack, Tooltip } from '@mui/material';
import Iconify from '/imports/ui/components/iconify/iconify';
import CheckIcon from '@mui/icons-material/Check';
import { Row, ExclusiveGroup, MultiGroup, IconifyIcon as I } from '/imports/ui/components/CompactToggleGroup';

import ManIcon       from '@mui/icons-material/Man';
import WomanIcon     from '@mui/icons-material/Woman';
import ElderlyIcon   from '@mui/icons-material/Elderly';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PersonIcon    from '@mui/icons-material/Person';

// ── Color map (BGR→RGB, matching the engine's clothing-color palette) ────────
const COLOR_MAP: Record<string, string> = {
    black:  '#0a0a0a',
    white:  '#f5f5f5',
    gray:   '#808080',
    red:    '#c81e1e',
    orange: '#dc7814',
    yellow: '#dcdc14',
    green:  '#289628',
    blue:   '#1e50c8',
    navy:   '#0f1e5a',
    purple: '#8c1e8c',
    brown:  '#5a3719',
    beige:  '#cdcda5',
    pink:   '#d76ea5',
};
const COLOR_NAMES = Object.keys(COLOR_MAP);

// ── Color picker button + popover ────────────────────────────────────────────
const ColorPickerButton = ({ label, value, onChange }: {
    label: string;
    value: string | null;
    onChange: (color: string | null) => void;
}) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const css = value ? COLOR_MAP[value] : null;

    return (
        <>
            <Tooltip title={value ? `${label}: ${value}` : `Filter by ${label} color`}>
                <Box
                    onClick={e => setAnchor(e.currentTarget)}
                    sx={{
                        width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                        bgcolor: css ?? 'background.paper',
                        border: value ? '2px solid transparent' : '1.5px dashed',
                        borderColor: value ? 'transparent' : 'text.disabled',
                        outline: value ? '2px solid' : 'none',
                        outlineColor: 'primary.main',
                        outlineOffset: 1,
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'outline 0.1s, border-color 0.1s',
                        '&:hover': { borderColor: value ? 'transparent' : 'primary.main' },
                    }}
                >
                    {!value && <Iconify icon="mdi:palette-outline" width={13} style={{ opacity: 0.6 }} />}
                </Box>
            </Tooltip>
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Box sx={{ p: 1 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                        {COLOR_NAMES.map(name => {
                            const selected = value === name;
                            const light = name === 'white' || name === 'beige' || name === 'yellow';
                            return (
                                <Tooltip key={name} title={name}>
                                    <Box
                                        onClick={() => { onChange(selected ? null : name); setAnchor(null); }}
                                        sx={{
                                            width: 32, height: 32, borderRadius: 1, cursor: 'pointer',
                                            bgcolor: COLOR_MAP[name],
                                            border: '1px solid rgba(0,0,0,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            '&:hover': { transform: 'scale(1.1)', transition: 'transform 0.1s' },
                                        }}
                                    >
                                        {selected && (
                                            <CheckIcon sx={{ fontSize: 18, color: light ? '#333' : '#fff' }} />
                                        )}
                                    </Box>
                                </Tooltip>
                            );
                        })}
                    </Box>
                </Box>
            </Popover>
        </>
    );
};

// ── Types ────────────────────────────────────────────────────────────────────
type Gender    = 'male' | 'female';
type Age       = 'age_over_60' | 'age_18_60' | 'age_under_18';
type Facing    = 'facing_front' | 'facing_side' | 'facing_back';
type UpperType = 'long_coat' | 'long_sleeve' | 'short_sleeve';
type LowerType = 'trousers' | 'shorts' | 'skirt_dress';

export interface ParFilterState {
    gender:    Gender    | null;
    age:       Age       | null;
    facing:    Facing    | null;
    upperType: UpperType | null;
    lowerType: LowerType | null;
    headColor:  string   | null;
    upperColor: string   | null;
    lowerColor: string   | null;
    extras:    string[];
}

export const EMPTY_PAR_FILTER: ParFilterState = {
    gender: null, age: null, facing: null,
    upperType: null, lowerType: null,
    headColor: null, upperColor: null, lowerColor: null,
    extras: [],
};

export const parFilterToConditions = (s: ParFilterState): Record<string, any> => {
    const c: Record<string, any> = {};
    if (s.gender === 'female') c['par.female'] = { $gte: 0.5 };
    if (s.gender === 'male')   c['par.female'] = { $lt: 0.5 };
    if (s.age)        c[`par.${s.age}`]        = { $gte: 0.6 };
    if (s.facing)     c[`par.${s.facing}`]     = { $gte: 0.6 };
    if (s.upperType)  c[`par.${s.upperType}`]  = { $gte: 0.6 };
    if (s.lowerType)  c[`par.${s.lowerType}`]  = { $gte: 0.5 };
    if (s.headColor)  c['par.head_color']       = s.headColor;
    if (s.upperColor) c['par.upper_color']      = s.upperColor;
    if (s.lowerColor) c['par.lower_color']      = s.lowerColor;
    s.extras.forEach(a => { c[`par.${a}`] = { $gte: 0.5 }; });
    return c;
};

export const countActiveParFilters = (s: ParFilterState): number =>
    [s.gender, s.age, s.facing, s.upperType, s.lowerType, s.headColor, s.upperColor, s.lowerColor]
        .filter(Boolean).length + s.extras.length;

const MATCH_ALL_HINT = 'Matches people with ALL selected tags at once';

// ── Main component ───────────────────────────────────────────────────────────
interface Props {
    initial?: ParFilterState;
    onChange: (conditions: Record<string, any>, state: ParFilterState) => void;
}

const ParFilterBuilder = ({ initial, onChange }: Props) => {
    const [state, setState] = useState<ParFilterState>(initial ?? EMPTY_PAR_FILTER);

    const update = (patch: Partial<ParFilterState>) => {
        const next = { ...state, ...patch };
        setState(next);
        onChange(parFilterToConditions(next), next);
    };

    const updateExtras = (group: string[], next: string[]) =>
        update({ extras: [...state.extras.filter(e => !group.includes(e)), ...next] });

    const clear = () => { setState(EMPTY_PAR_FILTER); onChange({}, EMPTY_PAR_FILTER); };

    const UPPER_PATTERNS = ['upper_logo', 'upper_plaid', 'upper_stride', 'upper_splice'];
    const LOWER_PATTERNS = ['lower_stripe', 'lower_pattern'];

    return (
        <Stack spacing={1.5} sx={{ p: 1.5, minWidth: 340 }}>

            {/* ── Gender ───────────────────────────────── */}
            <Row label="Gender">
                <ExclusiveGroup<Gender>
                    value={state.gender} onChange={v => update({ gender: v })}
                    options={[
                        { v: 'male',   label: 'Male',   icon: <ManIcon fontSize="small" /> },
                        { v: 'female', label: 'Female', icon: <WomanIcon fontSize="small" /> },
                    ]}
                />
            </Row>

            {/* ── Age ──────────────────────────────────── */}
            <Row label="Age">
                <ExclusiveGroup<Age>
                    value={state.age} onChange={v => update({ age: v })}
                    options={[
                        { v: 'age_under_18', label: 'Under 18', icon: <ChildCareIcon fontSize="small" /> },
                        { v: 'age_18_60',    label: '18 – 60',  icon: <PersonIcon fontSize="small" /> },
                        { v: 'age_over_60',  label: 'Over 60',  icon: <ElderlyIcon fontSize="small" /> },
                    ]}
                />
            </Row>

            {/* ── Facing ───────────────────────────────── */}
            <Row label="Facing">
                <ExclusiveGroup<Facing>
                    value={state.facing} onChange={v => update({ facing: v })}
                    options={[
                        { v: 'facing_front', label: 'Facing front (face visible)', icon: <I icon="mdi:eye" /> },
                        { v: 'facing_side',  label: 'Facing side (profile)',       icon: <I icon="mdi:face-man-profile" /> },
                        { v: 'facing_back',  label: 'Facing away (back turned)',   icon: <I icon="mdi:eye-off" /> },
                    ]}
                />
            </Row>

            {/* ── Head ─────────────────────────────────── */}
            <Row label="Head">
                <ColorPickerButton label="head" value={state.headColor} onChange={v => update({ headColor: v })} />
            </Row>

            {/* ── Upper clothing ───────────────────────── */}
            <Row label="Upper">
                <ColorPickerButton label="upper" value={state.upperColor} onChange={v => update({ upperColor: v })} />
                <ExclusiveGroup<UpperType>
                    value={state.upperType} onChange={v => update({ upperType: v })}
                    options={[
                        { v: 'short_sleeve', label: 'Short sleeve', icon: <I icon="mdi:tshirt-crew" /> },
                        { v: 'long_sleeve',  label: 'Long sleeve',  icon: <I icon="lucide-lab:shirt-long-sleeve" /> },
                        { v: 'long_coat',    label: 'Long coat',    icon: <I icon="game-icons:cloak" /> },
                    ]}
                />
                <MultiGroup
                    values={state.extras.filter(e => UPPER_PATTERNS.includes(e))}
                    onChange={next => updateExtras(UPPER_PATTERNS, next)}
                    options={[
                        { v: 'upper_logo',   label: 'Logo print',    icon: <I icon="mdi:tag-outline" /> },
                        { v: 'upper_plaid',  label: 'Plaid pattern', icon: <I icon="mdi:grid" /> },
                        { v: 'upper_stride', label: 'Striped',       icon: <I icon="mdi:view-headline" /> },
                        { v: 'upper_splice', label: 'Color-blocked (spliced)', icon: <I icon="mdi:view-grid" /> },
                    ]}
                    hint={MATCH_ALL_HINT}
                />
            </Row>

            {/* ── Lower clothing ───────────────────────── */}
            <Row label="Lower">
                <ColorPickerButton label="lower" value={state.lowerColor} onChange={v => update({ lowerColor: v })} />
                <ExclusiveGroup<LowerType>
                    value={state.lowerType} onChange={v => update({ lowerType: v })}
                    options={[
                        { v: 'trousers',    label: 'Trousers',      icon: <I icon="game-icons:trousers" /> },
                        { v: 'shorts',      label: 'Shorts',        icon: <I icon="game-icons:shorts" /> },
                        { v: 'skirt_dress', label: 'Skirt / dress', icon: <I icon="game-icons:skirt" /> },
                    ]}
                />
                <MultiGroup
                    values={state.extras.filter(e => LOWER_PATTERNS.includes(e))}
                    onChange={next => updateExtras(LOWER_PATTERNS, next)}
                    options={[
                        { v: 'lower_stripe',  label: 'Striped',  icon: <I icon="mdi:view-headline" /> },
                        { v: 'lower_pattern', label: 'Patterned', icon: <I icon="mdi:texture-box" /> },
                    ]}
                    hint={MATCH_ALL_HINT}
                />
            </Row>

            {/* ── Accessories ──────────────────────────── */}
            <Row label="Acc.">
                <MultiGroup
                    values={state.extras.filter(e => ['hat','glasses','backpack','handbag','shoulder_bag','holds_object','boots'].includes(e))}
                    onChange={next => updateExtras(['hat','glasses','backpack','handbag','shoulder_bag','holds_object','boots'], next)}
                    options={[
                        { v: 'hat',          label: 'Hat',          icon: <I icon="mdi:hat-fedora" /> },
                        { v: 'glasses',      label: 'Glasses',      icon: <I icon="mdi:glasses" /> },
                        { v: 'backpack',     label: 'Backpack',     icon: <I icon="mdi:bag-personal" /> },
                        { v: 'handbag',      label: 'Handbag',      icon: <I icon="mdi:purse" /> },
                        { v: 'shoulder_bag', label: 'Shoulder bag', icon: <I icon="mdi:bag-carry-on" /> },
                        { v: 'holds_object', label: 'Holds object', icon: <I icon="mdi:hand-extended" /> },
                        { v: 'boots',        label: 'Boots',        icon: <I icon="mingcute:shoe-fill" /> },
                    ]}
                    hint={MATCH_ALL_HINT}
                />
            </Row>

            {countActiveParFilters(state) > 0 && (
                <Box>
                    <Button size="small" color="inherit" onClick={clear}>Clear filter</Button>
                </Box>
            )}
        </Stack>
    );
};

export default ParFilterBuilder;
