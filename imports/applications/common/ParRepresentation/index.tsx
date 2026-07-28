import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import Iconify from '/imports/ui/components/iconify/iconify';

import ManIcon         from '@mui/icons-material/Man';
import WomanIcon       from '@mui/icons-material/Woman';
import ElderlyIcon     from '@mui/icons-material/Elderly';
import ChildCareIcon   from '@mui/icons-material/ChildCare';
import PersonIcon      from '@mui/icons-material/Person';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon  from '@mui/icons-material/FlipToBack';
import EastIcon        from '@mui/icons-material/East';

const I = ({ icon, size = 20 }: { icon: string; size?: number }) => (
    <Iconify icon={icon} width={size} />
);

type Par = Record<string, number | string>;

const score = (par: Par, key: string): number =>
    typeof par[key] === 'number' ? (par[key] as number) : 0;

const active = (par: Par, key: string, threshold = 0.5): boolean =>
    score(par, key) >= threshold;

const ColorDot = ({ color, label }: { color: string; label: string }) => (
    <Tooltip title={`${label}: ${color}`}>
        <Box sx={{
            width: 18, height: 18, borderRadius: '50%',
            bgcolor: color, border: '1.5px solid', borderColor: 'divider',
            flexShrink: 0,
        }} />
    </Tooltip>
);

const AttrIcon = ({ icon, label, pct, active }: {
    icon: React.ReactNode; label: string; pct?: number; active: boolean;
}) => (
    <Tooltip title={`${label}${pct !== undefined ? ` ${pct}%` : ''}`}>
        <Box sx={{ color: active ? 'text.primary' : 'action.disabled', lineHeight: 0, cursor: 'default' }}>
            {icon}
        </Box>
    </Tooltip>
);

const Label = ({ text, active }: { text: string; active: boolean }) => (
    <Typography
        variant="caption"
        sx={{
            px: 0.75, py: 0.1,
            borderRadius: 1,
            bgcolor: active ? 'primary.main' : 'action.disabledBackground',
            color: active ? 'primary.contrastText' : 'text.disabled',
            fontSize: '0.6rem',
            lineHeight: 1.6,
            whiteSpace: 'nowrap',
        }}
    >
        {text}
    </Typography>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Stack direction="row" spacing={0.75} alignItems="center">
        <Typography variant="caption" color="text.secondary"
            sx={{ minWidth: 42, fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
        </Typography>
        {children}
    </Stack>
);

// ── Gender ──────────────────────────────────────────────────────────────────
const GenderBlock = ({ par }: { par: Par }) => {
    const femalePct = score(par, 'female');
    const isFemale  = femalePct >= 0.5;
    const pct       = isFemale ? femalePct : 1 - femalePct;
    return (
        <Tooltip title={`${isFemale ? 'Female' : 'Male'} ${(pct * 100).toFixed(0)}%`}>
            <Box sx={{ lineHeight: 0, color: isFemale ? 'pink' : 'cornflowerblue' }}>
                {isFemale ? <WomanIcon /> : <ManIcon />}
            </Box>
        </Tooltip>
    );
};

// ── Age ─────────────────────────────────────────────────────────────────────
const AgeBlock = ({ par }: { par: Par }) => {
    const o60 = score(par, 'age_over_60');
    const a18 = score(par, 'age_18_60');
    const u18 = score(par, 'age_under_18');
    const best = [
        { key: 'age_over_60',  label: '>60',   icon: <ElderlyIcon />,   s: o60 },
        { key: 'age_18_60',    label: '18–60',  icon: <PersonIcon />,    s: a18 },
        { key: 'age_under_18', label: '<18',    icon: <ChildCareIcon />, s: u18 },
    ].reduce((a, b) => (b.s > a.s ? b : a));
    return (
        <Tooltip title={`Age ${best.label} — ${(best.s * 100).toFixed(0)}%`}>
            <Box sx={{ lineHeight: 0, color: 'text.secondary' }}>{best.icon}</Box>
        </Tooltip>
    );
};

// ── Facing ──────────────────────────────────────────────────────────────────
const FacingBlock = ({ par }: { par: Par }) => {
    const front = score(par, 'facing_front');
    const side  = score(par, 'facing_side');
    const back  = score(par, 'facing_back');
    const best = [
        { label: 'facing front', icon: <FlipToFrontIcon />, s: front },
        { label: 'facing side',  icon: <EastIcon />,        s: side  },
        { label: 'facing back',  icon: <FlipToBackIcon />,  s: back  },
    ].reduce((a, b) => (b.s > a.s ? b : a));
    return (
        <Tooltip title={`${best.label} — ${(best.s * 100).toFixed(0)}%`}>
            <Box sx={{ lineHeight: 0, color: 'text.secondary' }}>{best.icon}</Box>
        </Tooltip>
    );
};

// ── Upper clothing type (winner-takes-all) ───────────────────────────────────
const UpperTypeBlock = ({ par }: { par: Par }) => {
    const coat  = score(par, 'long_coat');
    const long  = score(par, 'long_sleeve');
    const short = score(par, 'short_sleeve');
    const best = [
        { label: 'long coat',    icon: <I icon="game-icons:cloak" />,                  s: coat  },
        { label: 'long sleeve',  icon: <I icon="lucide-lab:shirt-long-sleeve" />,       s: long  },
        { label: 'short sleeve', icon: <I icon="mdi:tshirt-crew" />,                    s: short },
    ].reduce((a, b) => (b.s > a.s ? b : a));
    return (
        <Tooltip title={`${best.label} — ${(best.s * 100).toFixed(0)}%`}>
            <Box sx={{ lineHeight: 0, color: 'text.secondary' }}>{best.icon}</Box>
        </Tooltip>
    );
};

// ── Lower clothing type (winner-takes-all) ───────────────────────────────────
const LowerTypeBlock = ({ par }: { par: Par }) => {
    const trousers = score(par, 'trousers');
    const shorts   = score(par, 'shorts');
    const skirt    = score(par, 'skirt_dress');
    const best = [
        { label: 'trousers',    s: trousers },
        { label: 'shorts',      s: shorts   },
        { label: 'skirt/dress', s: skirt    },
    ].reduce((a, b) => (b.s > a.s ? b : a));
    return <Label text={best.label} active={best.s >= 0.5} />;
};

// ── Main component ───────────────────────────────────────────────────────────
interface Props {
    par: Par;
}

const ParRepresentation = ({ par }: Props) => {
    const headColor  = par.head_color  as string | undefined;
    const upperColor = par.upper_color as string | undefined;
    const lowerColor = par.lower_color as string | undefined;

    return (
        <Stack spacing={0.75} sx={{ userSelect: 'none' }}>

            {/* ── Identity row: gender + age + facing ─── */}
            <Stack direction="row" spacing={1.5} alignItems="center">
                {'female' in par && <GenderBlock par={par} />}
                {'age_18_60' in par && <AgeBlock par={par} />}
                {'facing_front' in par && <FacingBlock par={par} />}
            </Stack>

            {/* ── Head ─────────────────────────────────── */}
            <Row label="Head">
                {headColor && <ColorDot color={headColor} label="head" />}
                <AttrIcon icon={<I icon="mdi:hat-fedora" />}  label="hat"     pct={Math.round(score(par, 'hat')     * 100)} active={active(par, 'hat')} />
                <AttrIcon icon={<I icon="mdi:glasses" />}     label="glasses" pct={Math.round(score(par, 'glasses') * 100)} active={active(par, 'glasses')} />
            </Row>

            {/* ── Upper ────────────────────────────────── */}
            <Row label="Upper">
                {upperColor && <ColorDot color={upperColor} label="upper" />}
                {'long_sleeve' in par && <UpperTypeBlock par={par} />}
                {active(par, 'upper_logo')   && <Label text="logo"   active />}
                {active(par, 'upper_plaid')  && <Label text="plaid"  active />}
                {active(par, 'upper_stride') && <Label text="stride" active />}
                {active(par, 'upper_splice') && <Label text="splice" active />}
            </Row>

            {/* ── Lower ────────────────────────────────── */}
            <Row label="Lower">
                {lowerColor && <ColorDot color={lowerColor} label="lower" />}
                {'trousers' in par && <LowerTypeBlock par={par} />}
                {active(par, 'lower_stripe')  && <Label text="stripe"  active />}
                {active(par, 'lower_pattern') && <Label text="pattern" active />}
            </Row>

            {/* ── Accessories ──────────────────────────── */}
            <Row label="Acc.">
                <AttrIcon icon={<I icon="mdi:bag-personal" />}    label="backpack"     pct={Math.round(score(par, 'backpack')     * 100)} active={active(par, 'backpack')} />
                <AttrIcon icon={<I icon="mdi:purse" />}           label="handbag"      pct={Math.round(score(par, 'handbag')      * 100)} active={active(par, 'handbag')} />
                <AttrIcon icon={<I icon="mdi:bag-carry-on" />}    label="shoulder bag" pct={Math.round(score(par, 'shoulder_bag') * 100)} active={active(par, 'shoulder_bag')} />
                <AttrIcon icon={<I icon="mdi:hand-extended" />}   label="holds object" pct={Math.round(score(par, 'holds_object') * 100)} active={active(par, 'holds_object')} />
                <AttrIcon icon={<I icon="mingcute:shoe-fill" />}    label="boots"        pct={Math.round(score(par, 'boots')        * 100)} active={active(par, 'boots')} />
            </Row>

        </Stack>
    );
};

export default ParRepresentation;
