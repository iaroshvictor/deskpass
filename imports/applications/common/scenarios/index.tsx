import React from 'react';
import Icon from './icon';
import { AppType } from '../..';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import {
  Stack, Typography, Paper, Box, IconButton, Button, Chip, Switch, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Badge, Snackbar, Alert, Grow, Collapse, Slider, ToggleButton,
  ToggleButtonGroup, Checkbox, FormControlLabel, Divider, Popover, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import BoltIcon from '@mui/icons-material/Bolt';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';
import SensorsIcon from '@mui/icons-material/Sensors';
import SensorsOffIcon from '@mui/icons-material/SensorsOff';
import GroupsIcon from '@mui/icons-material/Groups';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import LoginIcon from '@mui/icons-material/Login';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import PublicIcon from '@mui/icons-material/Public';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RepeatIcon from '@mui/icons-material/Repeat';
import ScheduleIcon from '@mui/icons-material/CalendarMonth';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CircleIcon from '@mui/icons-material/Circle';
import { CamsCollection } from '/imports/api/cams';
import { CamZoneDefsCollection } from '/imports/api/camZoneDefs';
import { CamLineDefsCollection } from '/imports/api/camLineDefs';
import { CamLiveStatusCollection } from '/imports/api/camEvents';
import {
  ScenarioV2, ScenariosV2Collection, ScenarioEventsV2Collection,
  Condition, PersonFilter, PersonAttributeFilter, scenarioSentence, isScenarioArmed,
} from '/imports/api/scenarioModel';
import ParFilterBuilder, {
  ParFilterState, EMPTY_PAR_FILTER, countActiveParFilters,
} from '/imports/applications/common/ParRepresentation/ParFilterBuilder';
import { IconifyIcon } from '/imports/ui/components/CompactToggleGroup';

// ── PersonAttributeFilter[] ⇄ ParFilterState adapter ─────────────────────────
// Mirrors parFilterToConditions() in ParFilterBuilder.tsx, but targets the
// scenario rule's flat attributes[] shape instead of a Mongo selector.
const parFilterToAttributes = (s: ParFilterState): PersonAttributeFilter[] => {
  const out: PersonAttributeFilter[] = [];
  if (s.gender === 'female') out.push({ attr: 'female', op: 'gte', value: 0.5 });
  if (s.gender === 'male')   out.push({ attr: 'female', op: 'lt',  value: 0.5 });
  if (s.age)        out.push({ attr: s.age,       op: 'gte', value: 0.6 });
  if (s.facing)     out.push({ attr: s.facing,    op: 'gte', value: 0.6 });
  if (s.upperType)  out.push({ attr: s.upperType, op: 'gte', value: 0.6 });
  if (s.lowerType)  out.push({ attr: s.lowerType, op: 'gte', value: 0.5 });
  if (s.headColor)  out.push({ attr: 'head_color',  op: 'eq', value: s.headColor });
  if (s.upperColor) out.push({ attr: 'upper_color', op: 'eq', value: s.upperColor });
  if (s.lowerColor) out.push({ attr: 'lower_color', op: 'eq', value: s.lowerColor });
  s.extras.forEach(a => out.push({ attr: a, op: 'gte', value: 0.5 }));
  return out;
};

const AGES = ['age_under_18', 'age_18_60', 'age_over_60'];
const FACINGS = ['facing_front', 'facing_side', 'facing_back'];
const UPPER_TYPES = ['short_sleeve', 'long_sleeve', 'long_coat'];
const LOWER_TYPES = ['trousers', 'shorts', 'skirt_dress'];

const attributesToParFilterState = (attrs?: PersonAttributeFilter[]): ParFilterState => {
  const s: ParFilterState = { ...EMPTY_PAR_FILTER, extras: [] };
  for (const a of attrs ?? []) {
    if (a.attr === 'female') s.gender = (a.op === 'lt') ? 'male' : 'female';
    else if (AGES.includes(a.attr))        s.age = a.attr as any;
    else if (FACINGS.includes(a.attr))     s.facing = a.attr as any;
    else if (UPPER_TYPES.includes(a.attr)) s.upperType = a.attr as any;
    else if (LOWER_TYPES.includes(a.attr)) s.lowerType = a.attr as any;
    else if (a.attr === 'head_color')      s.headColor = (a as any).value ?? null;
    else if (a.attr === 'upper_color')     s.upperColor = (a as any).value ?? null;
    else if (a.attr === 'lower_color')     s.lowerColor = (a as any).value ?? null;
    else s.extras.push(a.attr);
  }
  return s;
};

const SEVERITY_COLOR: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info', warning: 'warning', critical: 'error',
};

type SubjectKind = 'person' | 'motion' | 'count' | 'crossing' | 'camera' | 'scene';

const subjectOf = (c: Condition): SubjectKind =>
  c.kind.startsWith('person') ? 'person'
  : c.kind === 'motion' ? 'motion'
  : c.kind === 'count' ? 'count'
  : c.kind === 'crossing' ? 'crossing'
  : c.kind === 'camera' ? 'camera' : 'scene';

// scope kinds a condition can attach to (first entry = default)
const SCOPE_FOR: Record<Condition['kind'], ('cams' | 'zone' | 'line')[]> = {
  person_arrived: ['cams'],
  person_present: ['zone', 'cams'],
  person_dwell:   ['zone'],
  count:          ['cams', 'zone'],
  motion:         ['zone'],
  crossing:       ['line'],
  camera:         ['cams'],
  scene:          ['cams'],   // VLM captions are per-camera (whole frame)
};

const DEFAULT_DRAFT: ScenarioV2 = {
  name: '',
  enabled: true,
  scope: { kind: 'cams', camIds: [] },
  rule: { condition: { kind: 'person_arrived', person: { identity: 'unknown' } } },
  severity: 'warning',
  cooldownSec: 30,
  createdAt: new Date(),
};

// ── pill (animated chip that opens its editor) ───────────────────────────────
const Pill = ({ label, color, onClick, grow = true, outlined = false, icon }: {
  label: string, color?: any, onClick: (e: React.MouseEvent<HTMLElement>) => void,
  grow?: boolean, outlined?: boolean, icon?: React.ReactElement,
}) => (
  <Grow in={grow} timeout={350}>
    <Chip
      icon={icon}
      label={label}
      color={color ?? 'primary'}
      variant={outlined ? 'outlined' : 'filled'}
      onClick={onClick}
      sx={{
        fontWeight: 500, cursor: 'pointer', maxWidth: 380,
        transition: 'transform .15s',
        '&:hover': { transform: 'scale(1.06)' },
        '& .MuiChip-icon': { color: 'inherit', opacity: 0.85 },
      }}
    />
  </Grow>
);

const Word = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ mx: 0.3, color: 'text.secondary' }}>{children}</Typography>
);

const SectionTitle = ({ icon, children }: { icon?: React.ReactNode, children: React.ReactNode }) => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
    {icon && <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: '1rem' } }}>{icon}</Box>}
    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.5, lineHeight: 1.4 }}>
      {children}
    </Typography>
  </Stack>
);

// ── the sentence composer dialog ────────────────────────────────────────────
const Composer = ({ open, initial, onClose }: {
  open: boolean, initial: ScenarioV2, onClose: () => void,
}) => {
  const [draft, setDraft] = React.useState<ScenarioV2>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const [highlight, setHighlight] = React.useState<string | null>(null);
  React.useEffect(() => { setDraft(initial); setError(null); setHighlight(null); }, [initial, open]);

  const cams = useFind(() => CamsCollection.find({}));
  const zoneDefs = useFind(() => CamZoneDefsCollection.find({}));
  const lineDefs = useFind(() => CamLineDefsCollection.find({}));
  const statuses = useFind(() => CamLiveStatusCollection.find({}));

  const c = draft.rule.condition;
  const scope = draft.scope;
  const setCondition = (condition: Condition) => {
    const allowed = SCOPE_FOR[condition.kind];
    setDraft(d => ({
      ...d,
      rule: { ...d.rule, condition },
      scope: allowed.includes(d.scope.kind) ? d.scope : { kind: allowed[0], camIds: [] },
    }));
  };

  // cams where the selected zone/line def is placed
  const placedCams = React.useMemo(() => {
    if (scope.kind === 'zone') return cams.filter(cm => cm.overlayZones?.some(z => z.zoneId === scope.zoneDefId));
    if (scope.kind === 'line') return cams.filter(cm => cm.lines?.some(l => l.lineId === scope.lineDefId));
    return cams.filter(cm => scope.camIds?.includes(cm._id!));
  }, [cams, scope]);

  // live values for calibration + dry run
  const liveRows = placedCams.map(cm => {
    const st = statuses.find(s => s._id === cm._id);
    let value: string; let firing = false;
    if (c.kind === 'motion') {
      const v = st?.zoneMotion?.[scope.zoneDefId ?? ''];
      value = v === undefined ? '—' : v.toFixed(2) + ' px';
      firing = v !== undefined && (c.state === 'present' ? v >= c.threshold : v < c.threshold);
    } else if (c.kind === 'count') {
      const v = scope.kind === 'zone' ? st?.zoneCounts?.[scope.zoneDefId ?? ''] : st?.persons;
      value = v === undefined ? '—' : String(v);
      firing = v !== undefined && (c.op === 'gte' ? v >= c.value : v <= c.value);
    } else if (c.kind === 'person_present' || c.kind === 'person_dwell') {
      const v = scope.kind === 'zone' ? st?.zoneCounts?.[scope.zoneDefId ?? ''] : st?.persons;
      value = v === undefined ? '—' : `${v} inside`;
      firing = (v ?? 0) > 0;
    } else if (c.kind === 'camera') {
      const fresh = st?.updatedAt && Date.now() - new Date(st.updatedAt).getTime() < 5000;
      value = fresh ? 'online' : 'offline';
      firing = c.state === 'offline' ? !fresh : !!fresh;
    } else {
      value = 'event-based'; firing = false;
    }
    return { cam: cm, value, firing };
  });

  // clicking a pill scrolls to its (always-visible) editor card and flashes it
  const jumpTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setHighlight(id);
    window.setTimeout(() => setHighlight(h => (h === id ? null : h)), 1400);
  };
  const sec = (id: string, extra?: object) => ({
    ref: (el: HTMLElement | null) => { sectionRefs.current[id] = el; },
    variant: 'outlined' as const,
    sx: {
      p: 1.5,
      transition: 'box-shadow .25s ease',
      boxShadow: (th: any) => (highlight === id ? `0 0 0 2px ${th.palette.primary.main}` : 'none'),
      ...extra,
    },
  });

  // pill labels
  const personLabel = (p: PersonFilter) => {
    const base = p.identity === 'unknown' ? 'an unknown person'
      : p.identity === 'known' ? 'a known person'
      : p.identity === 'ids' ? `person: ${(p.ids ?? []).join(', ') || '…'}`
      : 'any person';
    const attrs = p.attributes?.length ? ` +${p.attributes.map(a => a.attr).join('+')}` : '';
    return base + attrs;
  };
  const subjectLabel =
    c.kind === 'person_arrived' ? `${personLabel(c.person)} arrives`
    : c.kind === 'person_present' ? `${personLabel(c.person)} is present`
    : c.kind === 'person_dwell' ? `${personLabel(c.person)} stays`
    : c.kind === 'count' ? `${c.op === 'gte' ? '≥' : '≤'} ${c.value} persons`
    : c.kind === 'motion' ? `motion ${c.state} (≥${c.threshold}px)`
    : c.kind === 'crossing' ? `line crossed${c.direction !== 'any' ? ` → ${c.direction}` : ''}`
    : c.kind === 'camera' ? `camera ${c.state}`
    : `scene mentions ${(c.keywords ?? []).join('/') || '…'}`;

  const whereLabel =
    scope.kind === 'zone' ? `zone “${zoneDefs.find(z => z._id === scope.zoneDefId)?.label ?? 'pick zone'}”${scope.camIds?.length ? ` (${scope.camIds.length}/${placedCams.length || '?'} cams)` : placedCams.length ? ` (${placedCams.length} cams)` : ''}`
    : scope.kind === 'line' ? `line “${lineDefs.find(l => l._id === scope.lineDefId)?.label ?? 'pick line'}”${placedCams.length ? ` (${placedCams.length} cams)` : ''}`
    : scope.camIds?.length ? (scope.camIds.length > 2 ? `${scope.camIds.length} cams` : placedCams.map(cm => cm.name).join(', ')) : 'pick cameras';

  // icons that mirror the current selection — used on the sentence pills and section titles
  const subjectIcon =
    c.kind === 'person_arrived' ? <LoginIcon />
    : c.kind === 'person_present' ? <VisibilityIcon />
    : c.kind === 'person_dwell' ? <HourglassBottomIcon />
    : c.kind === 'count' ? <GroupsIcon />
    : c.kind === 'motion' ? <SensorsIcon />
    : c.kind === 'crossing' ? <CompareArrowsIcon />
    : c.kind === 'camera' ? <VideocamIcon />
    : <IconifyIcon icon="mdi:image-text" />;
  const whereIcon =
    scope.kind === 'zone' ? <IconifyIcon icon="mdi:vector-polygon" />
    : scope.kind === 'line' ? <IconifyIcon icon="mdi:vector-line" />
    : <VideocamIcon />;
  const alertIcon =
    draft.severity === 'info' ? <InfoOutlinedIcon />
    : draft.severity === 'warning' ? <WarningAmberIcon />
    : <ErrorOutlineIcon />;

  const t = draft.rule.time ?? {};
  const save = async () => {
    try {
      const doc = { ...draft, name: draft.name || scenarioSentence(draft, {}) };
      if (draft._id) await Meteor.callAsync('updateScenarioV2', draft._id, doc);
      else await Meteor.callAsync('insertScenarioV2', doc);
      onClose();
    } catch (e: any) { setError(e.reason || e.message); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{draft._id ? 'Edit scenario' : 'New scenario'}</DialogTitle>
      <DialogContent>
        <TextField label="Name (optional — defaults to the sentence)" size="small" fullWidth sx={{ mt: 1, mb: 2 }}
          value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />

        {/* ── the sentence ── */}
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, minHeight: 64 }}>
          <Word>When</Word>
          <Pill label={subjectLabel} icon={subjectIcon} onClick={() => jumpTo('subject')} />
          <Word>{scope.kind === 'zone' ? 'in' : 'on'}</Word>
          <Pill label={whereLabel} icon={whereIcon} color="secondary" onClick={() => jumpTo('where')} />
          {t.forSec !== undefined
            ? <Pill label={`for ${t.forSec}s`} icon={<AccessTimeIcon />} color="default" onClick={() => jumpTo('for')} />
            : <Pill label="+ duration" icon={<AccessTimeIcon />} outlined color="default" onClick={() => jumpTo('for')} />}
          {(t.count && t.withinSec)
            ? <Pill label={`×${t.count} within ${t.withinSec}s`} icon={<RepeatIcon />} color="default" onClick={() => jumpTo('window')} />
            : <Pill label="+ rate" icon={<RepeatIcon />} outlined color="default" onClick={() => jumpTo('window')} />}
          {draft.schedule
            ? <Pill label={`${draft.schedule.from}–${draft.schedule.to}`} icon={<ScheduleIcon />} color="default" onClick={() => jumpTo('schedule')} />
            : <Pill label="+ schedule" icon={<ScheduleIcon />} outlined color="default" onClick={() => jumpTo('schedule')} />}
          <Word>→</Word>
          <Pill label={`${draft.severity} alert · ${draft.cooldownSec}s cooldown`} icon={alertIcon}
            color={SEVERITY_COLOR[draft.severity]} onClick={() => jumpTo('alert')} />
        </Paper>

        {/* ── live dry-run ── */}
        <Collapse in={placedCams.length > 0}>
          <Paper variant="outlined" sx={{ p: 1, mt: 1 }}>
            <Typography variant="caption" color="text.secondary">Live check — current values on the watched cameras:</Typography>
            {liveRows.map(r => (
              <Stack key={r.cam._id} direction="row" spacing={1} alignItems="center">
                <BoltIcon fontSize="small" sx={{
                  color: r.firing ? 'warning.main' : 'action.disabled',
                  animation: r.firing ? 'pulse 1.2s infinite' : 'none',
                  '@keyframes pulse': { '50%': { opacity: 0.3 } },
                }} />
                <Typography variant="body2" sx={{ minWidth: 160 }}>{r.cam.name}</Typography>
                <Typography variant="body2" color="text.secondary">{r.value}</Typography>
                {r.firing && <Typography variant="caption" color="warning.main">condition currently true{t.forSec ? ` — would fire after ${t.forSec}s` : ' — would fire'}</Typography>}
              </Stack>
            ))}
          </Paper>
        </Collapse>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

        {/* ── always-visible editor cards (click a pill to jump/flash) ── */}
        <Box sx={{ mt: 2, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Paper {...sec('subject', { gridColumn: '1 / -1' })}>
            <SectionTitle icon={subjectIcon}>Detect</SectionTitle>
            <SubjectEditor c={c} setCondition={setCondition} notifyKeywords={draft.notifyKeywords ?? []} />
          </Paper>

          <Paper {...sec('where', { gridColumn: '1 / -1' })}>
            <SectionTitle icon={whereIcon}>{scope.kind === 'zone' ? 'Where — zone' : scope.kind === 'line' ? 'Where — line' : 'Where — cameras'}</SectionTitle>
            <WhereEditor draft={draft} setDraft={setDraft}
              cams={cams} zoneDefs={zoneDefs} lineDefs={lineDefs} placedCams={placedCams} />
          </Paper>

          <Paper {...sec('for')}>
            <SectionTitle icon={<AccessTimeIcon />}>Duration</SectionTitle>
            <NumberEditor label="Must hold for (seconds, 0 = instant)"
              value={t.forSec ?? 0} min={0} max={600}
              onChange={v => setDraft(d => ({ ...d, rule: { ...d.rule, time: { ...d.rule.time, forSec: v || undefined } } }))} />
          </Paper>

          <Paper {...sec('window')}>
            <SectionTitle icon={<RepeatIcon />}>Rate</SectionTitle>
            <Stack spacing={1}>
              <NumberEditor label="Number of occurrences" value={t.count ?? 0} min={0} max={100}
                onChange={v => setDraft(d => ({ ...d, rule: { ...d.rule, time: { ...d.rule.time, count: v || undefined } } }))} />
              <NumberEditor label="Within (seconds)" value={t.withinSec ?? 0} min={0} max={3600}
                onChange={v => setDraft(d => ({ ...d, rule: { ...d.rule, time: { ...d.rule.time, withinSec: v || undefined } } }))} />
              <Typography variant="caption" color="text.secondary">Applies to event conditions (arrivals, crossings).</Typography>
            </Stack>
          </Paper>

          <Paper {...sec('schedule')}>
            <SectionTitle icon={<ScheduleIcon />}>Schedule</SectionTitle>
            <ScheduleEditor draft={draft} setDraft={setDraft} />
          </Paper>

          <Paper {...sec('alert')}>
            <SectionTitle icon={alertIcon}>Alert</SectionTitle>
            <Stack spacing={1.5}>
              <ToggleButtonGroup exclusive size="small" value={draft.severity}
                onChange={(_, v) => v && setDraft(d => ({ ...d, severity: v }))}>
                <TB value="info"     tip="Informational — logged, low-priority"><InfoOutlinedIcon fontSize="small" color="info" /> info</TB>
                <TB value="warning"  tip="Warning — worth a look soon"><WarningAmberIcon fontSize="small" color="warning" /> warning</TB>
                <TB value="critical" tip="Critical — needs immediate attention"><ErrorOutlineIcon fontSize="small" color="error" /> critical</TB>
              </ToggleButtonGroup>
              <NumberEditor label="Cooldown between alerts (seconds)" value={draft.cooldownSec} min={5} max={3600}
                onChange={v => setDraft(d => ({ ...d, cooldownSec: v }))} />
              {/* Notify-keywords are the SCENE trigger's job; only offer them as an
                  add-on when the primary DETECT is something else (no duplication). */}
              {draft.rule.condition.kind !== 'scene' && <>
                <Divider />
                <NotifyKeywordsEditor value={draft.notifyKeywords ?? []}
                  onChange={kw => setDraft(d => ({ ...d, notifyKeywords: kw }))} />
              </>}
            </Stack>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>{draft._id ? 'Save' : 'Create scenario'}</Button>
      </DialogActions>
    </Dialog>
  );
};

// Scenario-level watch-words: any scenario can fire its alert when the live VLM
// scene caption on a scoped camera mentions one of these words.
const NotifyKeywordsEditor = ({ value, onChange }: { value: string[], onChange: (v: string[]) => void }) => {
  const [draft, setDraft] = React.useState('');
  const kws = value ?? [];
  const add = () => {
    const v = draft.trim().toLowerCase();
    if (v && !kws.includes(v)) onChange([...kws, v]);
    setDraft('');
  };
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color="text.secondary">
        Notify keywords — also fire this alert when the live scene caption (VLM) on a scoped camera mentions any of these words.
      </Typography>
      {kws.length > 0 &&
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {kws.map(k => (
            <Chip key={k} label={k} size="small" onDelete={() => onChange(kws.filter(x => x !== k))} />
          ))}
        </Stack>}
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {['fall', 'fight', 'gun', 'fire', 'smoke'].filter(p => !kws.includes(p)).map(p => (
          <Chip key={p} label={`+ ${p}`} size="small" variant="outlined" onClick={() => onChange([...kws, p])} />
        ))}
      </Stack>
      <TextField size="small" fullWidth placeholder="add word, press Enter…"
        value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    </Stack>
  );
};

const NumberEditor = ({ label, value, min, max, onChange }: {
  label: string, value: number, min: number, max: number, onChange: (v: number) => void,
}) => (
  <TextField label={label} type="number" size="small" fullWidth value={value}
    inputProps={{ min, max }} onChange={e => onChange(Number(e.target.value))} />
);

// icon + label ToggleButton with an explanatory tooltip — used throughout the
// scenario builder's toggle groups so options read at a glance, not just from text.
const TB = ({ value, tip, children }: {
  value: string | number, tip: string, children: React.ReactNode,
}) => (
  <Tooltip title={tip}>
    <ToggleButton value={value} sx={{ gap: 0.5 }}>
      {children}
    </ToggleButton>
  </Tooltip>
);

const SubjectEditor = ({ c, setCondition, notifyKeywords = [] }: {
  c: Condition, setCondition: (c: Condition) => void, notifyKeywords?: string[],
}) => {
  const subject = subjectOf(c);
  const person: PersonFilter = (c as any).person ?? { identity: 'unknown' };
  const setPerson = (p: Partial<PersonFilter>) =>
    setCondition({ ...(c as any), person: { ...person, ...p } } as Condition);

  // Remember the scene keywords across DETECT-type switches so toggling away and
  // back (or opening a keyword scenario and switching to Scene) doesn't wipe them.
  // Seed from the current scene condition, else the scenario's notify-keywords.
  const kwMemory = React.useRef<string[]>((c as any).keywords ?? notifyKeywords);
  if (c.kind === 'scene') kwMemory.current = c.keywords;

  const [parAnchor, setParAnchor] = React.useState<HTMLElement | null>(null);
  const [kwDraft, setKwDraft] = React.useState('');
  const parFilterState = React.useMemo(() => attributesToParFilterState(person.attributes), [person.attributes]);
  const activeParCount = countActiveParFilters(parFilterState);
  const handleParFilterChange = (_conditions: Record<string, any>, state: ParFilterState) =>
    setPerson({ attributes: parFilterToAttributes(state) });

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup exclusive size="small" value={subject} sx={{ flexWrap: 'wrap' }}
        onChange={(_, v: SubjectKind | null) => {
          if (!v) return;
          if (v === 'person') setCondition({ kind: 'person_arrived', person });
          else if (v === 'motion') setCondition({ kind: 'motion', state: 'absent', threshold: 1.0 });
          else if (v === 'count') setCondition({ kind: 'count', op: 'gte', value: 3 });
          else if (v === 'crossing') setCondition({ kind: 'crossing', direction: 'any' });
          else if (v === 'camera') setCondition({ kind: 'camera', state: 'offline' });
          else setCondition({ kind: 'scene', keywords: [...kwMemory.current] });
        }}>
        <TB value="person"   tip="Trigger on a person detection">     <PersonIcon fontSize="small" />   Person</TB>
        <TB value="motion"   tip="Trigger on motion in a zone">        <SensorsIcon fontSize="small" />  Motion</TB>
        <TB value="count"    tip="Trigger on a person count threshold"><GroupsIcon fontSize="small" />   Count</TB>
        <TB value="crossing" tip="Trigger when a defined line is crossed"><CompareArrowsIcon fontSize="small" /> Crossing</TB>
        <TB value="camera"   tip="Trigger on camera online/offline status"><VideocamIcon fontSize="small" /> Camera</TB>
        <TB value="scene"    tip="Trigger when the VLM scene caption mentions a word"><IconifyIcon icon="mdi:image-text" /> Scene</TB>
      </ToggleButtonGroup>
      <Divider />

      {subject === 'person' && <>
        <ToggleButtonGroup exclusive size="small" value={c.kind}
          onChange={(_, v) => v && setCondition({ kind: v, person } as Condition)}>
          <TB value="person_arrived" tip="Fires once per track, the moment the person enters view">
            <LoginIcon fontSize="small" /> arrives</TB>
          <TB value="person_present" tip="True for as long as the person is in view / in the zone">
            <VisibilityIcon fontSize="small" /> is present</TB>
          <TB value="person_dwell" tip="True once the person has stayed continuously — set duration below">
            <HourglassBottomIcon fontSize="small" /> stays (dwell)</TB>
        </ToggleButtonGroup>
        <ToggleButtonGroup exclusive size="small" value={person.identity}
          onChange={(_, v) => v && setPerson({ identity: v })}>
          <TB value="any"     tip="Matches any person, known or not"><PublicIcon fontSize="small" /> any</TB>
          <TB value="known"   tip="Matches only people recognized in the persons database"><VerifiedUserIcon fontSize="small" /> known</TB>
          <TB value="unknown" tip="Matches only people not recognized in the persons database"><HelpOutlineIcon fontSize="small" /> unknown</TB>
          <TB value="ids"     tip="Matches only the specific person id(s) listed below"><PersonSearchIcon fontSize="small" /> specific</TB>
        </ToggleButtonGroup>
        {person.identity === 'ids' &&
          <TextField label="Person ids (comma-separated)" size="small"
            value={(person.ids ?? []).join(', ')}
            onChange={e => setPerson({ ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />}
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Attribute filter (optional)">
            <Badge badgeContent={activeParCount} color="primary">
              <Button size="small" variant="outlined" startIcon={<FilterListIcon fontSize="small" />}
                onClick={e => setParAnchor(e.currentTarget)}>
                Attribute filter
              </Button>
            </Badge>
          </Tooltip>
          {c.kind !== 'person_arrived' && activeParCount > 0 &&
            <Typography variant="caption" color="warning.main">
              Attribute filter only applies to “arrives” — ignored for {c.kind === 'person_present' ? 'is present' : 'stays (dwell)'}.
            </Typography>}
        </Stack>
        <Popover
          open={Boolean(parAnchor)}
          anchorEl={parAnchor}
          onClose={() => setParAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <ParFilterBuilder initial={parFilterState} onChange={handleParFilterChange} />
        </Popover>
        {c.kind === 'person_dwell' &&
          <Typography variant="caption" color="text.secondary">Set how long via the “+ duration” pill.</Typography>}
      </>}

      {subject === 'motion' && c.kind === 'motion' && <>
        <ToggleButtonGroup exclusive size="small" value={c.state}
          onChange={(_, v) => v && setCondition({ ...c, state: v })}>
          <TB value="present" tip="Fires when motion appears (currently still)"><SensorsIcon fontSize="small" /> present</TB>
          <TB value="absent"  tip="Fires when motion stops (currently moving)"><SensorsOffIcon fontSize="small" /> absent</TB>
        </ToggleButtonGroup>
        <Typography variant="caption">Motion threshold: {c.threshold.toFixed(1)} px
          <Typography component="span" variant="caption" color="text.secondary"> (static scene ≈ 0.3, real motion ≥ 2)</Typography>
        </Typography>
        <Slider size="small" min={0.2} max={8} step={0.1} value={c.threshold}
          onChange={(_, v) => setCondition({ ...c, threshold: v as number })} />
      </>}

      {subject === 'count' && c.kind === 'count' && <>
        <ToggleButtonGroup exclusive size="small" value={c.op}
          onChange={(_, v) => v && setCondition({ ...c, op: v })}>
          <TB value="gte" tip="Fires when the count rises to or above the value"><TrendingUpIcon fontSize="small" /> at least</TB>
          <TB value="lte" tip="Fires when the count drops to or below the value"><TrendingDownIcon fontSize="small" /> at most</TB>
        </ToggleButtonGroup>
        <NumberEditor label="Persons" value={c.value} min={0} max={500}
          onChange={v => setCondition({ ...c, value: v })} />
      </>}

      {subject === 'crossing' && c.kind === 'crossing' && (
        <ToggleButtonGroup exclusive size="small" value={c.direction} sx={{ flexWrap: 'wrap' }}
          onChange={(_, v) => v && setCondition({ ...c, direction: v })}>
          <TB value="any"   tip="Either direction crosses the line"><SyncAltIcon fontSize="small" /> any</TB>
          <TB value="left"  tip="Crossing right-to-left"><ArrowBackIcon fontSize="small" /> left</TB>
          <TB value="right" tip="Crossing left-to-right"><ArrowForwardIcon fontSize="small" /> right</TB>
          <TB value="above" tip="Crossing upward, bottom-to-top"><ArrowUpwardIcon fontSize="small" /> above</TB>
          <TB value="below" tip="Crossing downward, top-to-bottom"><ArrowDownwardIcon fontSize="small" /> below</TB>
        </ToggleButtonGroup>
      )}

      {subject === 'camera' && c.kind === 'camera' && (
        <ToggleButtonGroup exclusive size="small" value={c.state}
          onChange={(_, v) => v && setCondition({ ...c, state: v })}>
          <TB value="offline" tip="Fires when the camera stops sending frames"><VideocamOffIcon fontSize="small" /> goes offline</TB>
          <TB value="online"  tip="Fires when the camera resumes sending frames"><VideocamIcon fontSize="small" /> comes back online</TB>
        </ToggleButtonGroup>
      )}

      {subject === 'scene' && c.kind === 'scene' && <>
        <Typography variant="caption" color="text.secondary">
          Fires when the live VLM scene caption for a scoped camera mentions any of these words.
        </Typography>
        {c.keywords.length > 0 &&
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {c.keywords.map(k => (
              <Chip key={k} label={k} size="small"
                onDelete={() => setCondition({ ...c, keywords: c.keywords.filter(x => x !== k) })} />
            ))}
          </Stack>}
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {['fall', 'fight', 'gun', 'fire', 'smoke'].filter(p => !c.keywords.includes(p)).map(p => (
            <Chip key={p} label={`+ ${p}`} size="small" variant="outlined"
              onClick={() => setCondition({ ...c, keywords: [...c.keywords, p] })} />
          ))}
        </Stack>
        <TextField size="small" fullWidth placeholder="add word, press Enter…"
          value={kwDraft} onChange={e => setKwDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const v = kwDraft.trim().toLowerCase();
              if (v && !c.keywords.includes(v)) setCondition({ ...c, keywords: [...c.keywords, v] });
              setKwDraft('');
            }
          }} />
      </>}
    </Stack>
  );
};

const WhereEditor = ({ draft, setDraft, cams, zoneDefs, lineDefs, placedCams }: any) => {
  const c: Condition = draft.rule.condition;
  const allowed = SCOPE_FOR[c.kind];
  const scope = draft.scope;
  const setScope = (patch: any) => setDraft((d: ScenarioV2) => ({ ...d, scope: { ...d.scope, ...patch } }));

  return (
    <Stack spacing={1.5}>
      {allowed.length > 1 && (
        <ToggleButtonGroup exclusive size="small" value={scope.kind}
          onChange={(_, v) => v && setScope({ kind: v, camIds: [], zoneDefId: undefined, lineDefId: undefined })}>
          {allowed.map((k: string) => (
            <TB key={k} value={k}
              tip={k === 'cams' ? 'Watch specific cameras directly'
                : k === 'zone' ? 'Watch a shared zone, expanded to every camera it is placed on'
                : 'Watch a shared line, expanded to every camera it is placed on'}>
              {k === 'cams' ? <VideocamIcon fontSize="small" />
                : k === 'zone' ? <IconifyIcon icon="mdi:vector-polygon" />
                : <IconifyIcon icon="mdi:vector-line" />}
              {k === 'cams' ? 'cameras' : k}
            </TB>
          ))}
        </ToggleButtonGroup>
      )}
      {scope.kind === 'cams' && (
        <Stack>
          {cams.map((cm: any) => (
            <FormControlLabel key={cm._id} control={
              <Checkbox size="small" checked={scope.camIds?.includes(cm._id) ?? false}
                onChange={(_, v) => setScope({
                  camIds: v ? [...(scope.camIds ?? []), cm._id]
                           : (scope.camIds ?? []).filter((x: string) => x !== cm._id),
                })} />
            } label={cm.name} />
          ))}
        </Stack>
      )}
      {scope.kind === 'zone' && (
        <TextField select label="Zone (shared definition)" size="small"
          value={scope.zoneDefId ?? ''} onChange={e => setScope({ zoneDefId: e.target.value, camIds: [] })}>
          {zoneDefs.map((z: any) => <MenuItem key={z._id} value={z._id}>{z.label}</MenuItem>)}
        </TextField>
      )}
      {scope.kind === 'line' && (
        <TextField select label="Line (shared definition)" size="small"
          value={scope.lineDefId ?? ''} onChange={e => setScope({ lineDefId: e.target.value, camIds: [] })}>
          {lineDefs.map((l: any) => <MenuItem key={l._id} value={l._id}>{l.label}</MenuItem>)}
        </TextField>
      )}
      {(scope.kind === 'zone' || scope.kind === 'line') && placedCams.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Placed on {placedCams.length} camera{placedCams.length > 1 ? 's' : ''} — watching all; untick to narrow:
          </Typography>
          {placedCams.map((cm: any) => (
            <FormControlLabel key={cm._id} sx={{ display: 'block' }} control={
              <Checkbox size="small"
                checked={!scope.camIds?.length || scope.camIds.includes(cm._id)}
                onChange={(_, v) => {
                  const all = placedCams.map((p: any) => p._id);
                  const cur = scope.camIds?.length ? scope.camIds : all;
                  setScope({ camIds: v ? [...cur, cm._id] : cur.filter((x: string) => x !== cm._id) });
                }} />
            } label={cm.name} />
          ))}
        </Box>
      )}
    </Stack>
  );
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const timeToMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const isHourArmed = (from: string, to: string, hour: number) => {
  const f = timeToMin(from), t = timeToMin(to), cur = hour * 60;
  return f <= t ? cur >= f && cur < t : cur >= f || cur < t;
};

// ── 7×24 visual preview/editor — click a day header to toggle it, drag across
// hour rows to set the From/To range (exact minutes still come from the fields).
const ScheduleHeatmap = ({ days, from, to, onToggleDay, onDragRange }: {
  days: number[]; from: string; to: string;
  onToggleDay: (i: number) => void; onDragRange: (from: string, to: string) => void;
}) => {
  const [dragStart, setDragStart] = React.useState<number | null>(null);
  const [dragEnd, setDragEnd] = React.useState<number | null>(null);
  const dayActive = (d: number) => !days.length || days.includes(d);

  const commitDrag = () => {
    if (dragStart === null || dragEnd === null) return;
    const lo = Math.min(dragStart, dragEnd), hi = Math.max(dragStart, dragEnd) + 1;
    const fmt = (h: number) => h >= 24 ? '23:59' : `${String(h).padStart(2, '0')}:00`;
    onDragRange(fmt(lo), fmt(hi));
    setDragStart(null); setDragEnd(null);
  };
  React.useEffect(() => {
    if (dragStart === null) return;
    const up = () => commitDrag();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [dragStart, dragEnd]);

  return (
    <Box sx={{ userSelect: 'none' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '34px repeat(7, 1fr)', gap: '2px', maxWidth: 360 }}>
        <Box />
        {DAYS.map((d, i) => (
          <Tooltip key={d} title={`${DAY_NAMES[i]} — click to toggle`}>
            <Box onClick={() => onToggleDay(i)} sx={{
              cursor: 'pointer', textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, py: 0.4,
              borderRadius: 0.5,
              bgcolor: dayActive(i) ? 'primary.main' : 'action.hover',
              color: dayActive(i) ? 'primary.contrastText' : 'text.secondary',
            }}>
              {d}
            </Box>
          </Tooltip>
        ))}
        {Array.from({ length: 24 }, (_, h) => h).map(h => (
          <React.Fragment key={h}>
            <Box sx={{ fontSize: '0.55rem', color: 'text.secondary', textAlign: 'right', pr: 0.5, lineHeight: '13px' }}>
              {h % 3 === 0 ? `${String(h).padStart(2, '0')}:00` : ''}
            </Box>
            {DAYS.map((_, d) => {
              const dragging = dragStart !== null && dragEnd !== null
                && h >= Math.min(dragStart, dragEnd) && h <= Math.max(dragStart, dragEnd);
              const armed = dayActive(d) && isHourArmed(from, to, h);
              return (
                <Box key={d}
                  onMouseDown={() => { setDragStart(h); setDragEnd(h); }}
                  onMouseEnter={() => { if (dragStart !== null) setDragEnd(h); }}
                  sx={{
                    height: 13, borderRadius: 0.25, cursor: 'pointer',
                    bgcolor: dragging ? 'primary.light' : armed ? 'primary.main' : 'action.hover',
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Drag across hours to set the range · click a day letter to toggle it
      </Typography>
    </Box>
  );
};

const ScheduleEditor = ({ draft, setDraft }: any) => {
  const sched = draft.schedule ?? { days: [], from: '22:00', to: '06:00' };
  const set = (patch: any) => setDraft((d: ScenarioV2) => ({ ...d, schedule: { ...sched, ...patch } }));
  const toggleDay = (i: number) => {
    const cur: number[] = sched.days ?? [];
    set({ days: cur.includes(i) ? cur.filter((x: number) => x !== i) : [...cur, i].sort() });
  };

  const [view, setView] = React.useState<'list' | 'heatmap'>('list');
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const armedNow = isScenarioArmed(draft.schedule, now);
  const overnight = !!draft.schedule && sched.from > sched.to;
  const zeroLength = !!draft.schedule && sched.from === sched.to;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Tooltip title={draft.schedule ? "Whether this scenario is armed right now, per its schedule" : "No schedule set — always armed"}>
          <Chip size="small" icon={<CircleIcon sx={{ fontSize: '0.6rem !important' }} />}
            label={armedNow ? 'Armed now' : 'Not armed now'}
            color={armedNow ? 'success' : 'default'} variant={armedNow ? 'filled' : 'outlined'} />
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setView(v)}>
          <Tooltip title="List view"><ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton></Tooltip>
          <Tooltip title="Heatmap view"><ToggleButton value="heatmap"><GridViewIcon fontSize="small" /></ToggleButton></Tooltip>
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={() => set({ days: [...ALL_DAYS] })}>Every day</Button>
        <Button size="small" onClick={() => set({ days: [...WEEKDAYS] })}>Weekdays</Button>
        <Button size="small" onClick={() => set({ days: [...WEEKENDS] })}>Weekends</Button>
      </Stack>

      {view === 'list' ? (
        <>
          <ToggleButtonGroup size="small" value={sched.days} sx={{ flexWrap: 'wrap' }}
            onChange={(_, days) => set({ days })}>
            {DAYS.map((d, i) => (
              <Tooltip key={d} title={DAY_NAMES[i]}>
                <ToggleButton value={i}>{d}</ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">No days selected = every day</Typography>
        </>
      ) : (
        <ScheduleHeatmap days={sched.days ?? []} from={sched.from} to={sched.to}
          onToggleDay={toggleDay} onDragRange={(from, to) => set({ from, to })} />
      )}

      <Stack direction="row" spacing={1}>
        <TextField label="From" type="time" size="small" value={sched.from}
          onChange={e => set({ from: e.target.value })} />
        <TextField label="To" type="time" size="small" value={sched.to}
          onChange={e => set({ to: e.target.value })} />
      </Stack>
      {overnight && !zeroLength && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <NightsStayIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">Overnight — spans midnight ({sched.from} to {sched.to} the next day)</Typography>
        </Stack>
      )}
      {zeroLength && (
        <Typography variant="caption" color="error">
          From and To are equal — this schedule will never be armed. Widen the range or remove the schedule.
        </Typography>
      )}

      <Button size="small" color="inherit" startIcon={<EventBusyIcon fontSize="small" />}
        onClick={() => setDraft((d: ScenarioV2) => ({ ...d, schedule: undefined }))}>
        Remove schedule (always armed)
      </Button>
    </Stack>
  );
};

// ── scenario list + events ───────────────────────────────────────────────────
const ScenariosTab = () => {
  const scenarios = useFind(() => ScenariosV2Collection.find({}, { sort: { createdAt: -1 } }));
  const cams = useFind(() => CamsCollection.find({}));
  const zoneDefs = useFind(() => CamZoneDefsCollection.find({}));
  const lineDefs = useFind(() => CamLineDefsCollection.find({}));
  const [dialog, setDialog] = React.useState<ScenarioV2 | null>(null);

  const sentence = (s: ScenarioV2) => scenarioSentence(s, {
    cams: s.scope.camIds?.map(id => cams.find(cm => cm._id === id)?.name ?? id),
    zone: zoneDefs.find(z => z._id === s.scope.zoneDefId)?.label,
    line: lineDefs.find(l => l._id === s.scope.lineDefId)?.label,
  });

  return (
    <Box>
      <Button startIcon={<AddIcon />} variant="contained" size="small" sx={{ mb: 1 }}
        onClick={() => setDialog({ ...DEFAULT_DRAFT })}>
        New scenario
      </Button>
      <Stack spacing={1}>
        {scenarios.map(s => (
          <Grow in key={s._id} timeout={300}>
            <Paper sx={{ p: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Switch size="small" checked={s.enabled}
                  onChange={(_, v) => Meteor.callAsync('setScenarioV2Enabled', s._id, v)} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sentence(s)}
                    {s.lastTriggeredAt ? ` · last: ${new Date(s.lastTriggeredAt).toLocaleString()}` : ' · never fired'}
                  </Typography>
                </Box>
                <Chip size="small" color={SEVERITY_COLOR[s.severity]} label={s.severity} />
                <Chip size="small" variant="outlined" label={`${s.triggerCount ?? 0}×`} />
                <IconButton size="small" onClick={() => setDialog(s)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => {
                  if (window.confirm(`Delete scenario "${s.name}"?`)) Meteor.callAsync('removeScenarioV2', s._id);
                }}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            </Paper>
          </Grow>
        ))}
        {!scenarios.length &&
          <Typography variant="body2" color="text.secondary">No scenarios yet — build your first one.</Typography>}
      </Stack>
      {dialog && <Composer open initial={dialog} onClose={() => setDialog(null)} />}
    </Box>
  );
};

const EventsTab = () => {
  useSubscribe('scenario_events_v2', {}, 100);
  const events = useFind(() => ScenarioEventsV2Collection.find({}, { sort: { triggeredAt: -1 }, limit: 100 }));
  const cams = useFind(() => CamsCollection.find({}));
  const camName = (id: string) => cams.find(cm => cm._id === id)?.name ?? id;

  return (
    <Box>
      <Button startIcon={<DoneAllIcon />} size="small" sx={{ mb: 1 }}
        onClick={() => Meteor.callAsync('markScenarioEventsV2Seen')}>
        Mark all seen
      </Button>
      <Stack spacing={0.5}>
        {events.map(ev => (
          <Paper key={ev._id} sx={{
            p: 1, opacity: ev.seen ? 0.65 : 1,
            borderLeft: 4, borderColor: `${SEVERITY_COLOR[ev.severity]}.main`,
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">{ev.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ev.scenarioName} · {camName(ev.camId)} · {new Date(ev.triggeredAt).toLocaleString()}
                </Typography>
              </Box>
              {!ev.seen && <Chip size="small" color={SEVERITY_COLOR[ev.severity]} label="new"
                onClick={() => Meteor.callAsync('markScenarioEventsV2Seen', [ev._id])} />}
            </Stack>
          </Paper>
        ))}
        {!events.length && <Typography variant="body2" color="text.secondary">No events logged yet.</Typography>}
      </Stack>
    </Box>
  );
};

const ScenariosRenderer = () => {
  useSubscribe('scenarios_v2');
  useSubscribe('cams');
  useSubscribe('cam_zone_defs');
  useSubscribe('cam_line_defs');
  useSubscribe('cam_live_status');
  useSubscribe('scenario_events_v2_unseen');
  const unseen = useFind(() => ScenarioEventsV2Collection.find({ seen: false }));
  const [tab, setTab] = React.useState(0);
  const [toast, setToast] = React.useState<string | null>(null);
  const lastCount = React.useRef(0);

  React.useEffect(() => {
    if (unseen.length > lastCount.current && lastCount.current > 0) {
      setToast(unseen[0]?.message ?? 'Scenario triggered');
    }
    lastCount.current = unseen.length;
  }, [unseen.length]);

  return (
    <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box', minWidth: 640 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab icon={<BoltIcon fontSize="small" />} iconPosition="start" label="Scenarios" />
        <Tab icon={<DoneAllIcon fontSize="small" />} iconPosition="start"
          label={<Tooltip title="Log of scenario triggers"><Badge badgeContent={unseen.length} color="error"><Box sx={{ pr: unseen.length ? 2 : 0 }}>Events</Box></Badge></Tooltip>} />
      </Tabs>
      {tab === 0 ? <ScenariosTab /> : <EventsTab />}
      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity="warning" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Paper>
  );
};

const ScenariosApp: AppType = {
  appName: 'Scenarios',
  render: ScenariosRenderer,
  appIcon: <Icon />,
};
export default ScenariosApp;
