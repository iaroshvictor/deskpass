import React from 'react';
import Icon from './icon';
import { AppType } from '../..';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import {
  Stack, Typography, Paper, Box, IconButton, Button, Chip, Switch, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Badge, Snackbar, Alert, Grow, Collapse, Slider, ToggleButton,
  ToggleButtonGroup, Checkbox, FormControlLabel, Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import BoltIcon from '@mui/icons-material/Bolt';
import { CamsCollection } from '/imports/api/cams';
import { CamZoneDefsCollection } from '/imports/api/camZoneDefs';
import { CamLineDefsCollection } from '/imports/api/camLineDefs';
import { CamLiveStatusCollection } from '/imports/api/camEvents';
import {
  ScenarioV2, ScenariosV2Collection, ScenarioEventsV2Collection,
  Condition, PersonFilter, scenarioSentence,
} from '/imports/api/scenarioModel';

const PAR_ATTRS = [
  'hat', 'glasses', 'backpack', 'handbag', 'shoulder_bag', 'holds_object',
  'long_coat', 'boots', 'age_over_60', 'age_18_60', 'age_under_18', 'female',
  'short_sleeve', 'long_sleeve', 'trousers', 'shorts', 'skirt_dress',
];

const SEVERITY_COLOR: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info', warning: 'warning', critical: 'error',
};

type SubjectKind = 'person' | 'motion' | 'count' | 'crossing' | 'camera';

const subjectOf = (c: Condition): SubjectKind =>
  c.kind.startsWith('person') ? 'person'
  : c.kind === 'motion' ? 'motion'
  : c.kind === 'count' ? 'count'
  : c.kind === 'crossing' ? 'crossing' : 'camera';

// scope kinds a condition can attach to (first entry = default)
const SCOPE_FOR: Record<Condition['kind'], ('cams' | 'zone' | 'line')[]> = {
  person_arrived: ['cams'],
  person_present: ['zone', 'cams'],
  person_dwell:   ['zone'],
  count:          ['cams', 'zone'],
  motion:         ['zone'],
  crossing:       ['line'],
  camera:         ['cams'],
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
const Pill = ({ label, color, onClick, grow = true, outlined = false }: {
  label: string, color?: any, onClick: (e: React.MouseEvent<HTMLElement>) => void,
  grow?: boolean, outlined?: boolean,
}) => (
  <Grow in={grow} timeout={350}>
    <Chip
      label={label}
      color={color ?? 'primary'}
      variant={outlined ? 'outlined' : 'filled'}
      onClick={onClick}
      sx={{
        fontWeight: 500, cursor: 'pointer', maxWidth: 380,
        transition: 'transform .15s',
        '&:hover': { transform: 'scale(1.06)' },
      }}
    />
  </Grow>
);

const Word = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ mx: 0.3, color: 'text.secondary' }}>{children}</Typography>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="overline" color="text.secondary"
    sx={{ display: 'block', mb: 0.75, letterSpacing: 0.5, lineHeight: 1.4 }}>
    {children}
  </Typography>
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
    : `camera ${c.state}`;

  const whereLabel =
    scope.kind === 'zone' ? `zone “${zoneDefs.find(z => z._id === scope.zoneDefId)?.label ?? 'pick zone'}”${scope.camIds?.length ? ` (${scope.camIds.length}/${placedCams.length || '?'} cams)` : placedCams.length ? ` (${placedCams.length} cams)` : ''}`
    : scope.kind === 'line' ? `line “${lineDefs.find(l => l._id === scope.lineDefId)?.label ?? 'pick line'}”${placedCams.length ? ` (${placedCams.length} cams)` : ''}`
    : scope.camIds?.length ? (scope.camIds.length > 2 ? `${scope.camIds.length} cams` : placedCams.map(cm => cm.name).join(', ')) : 'pick cameras';

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
          <Pill label={subjectLabel} onClick={() => jumpTo('subject')} />
          <Word>{scope.kind === 'zone' ? 'in' : 'on'}</Word>
          <Pill label={whereLabel} color="secondary" onClick={() => jumpTo('where')} />
          {t.forSec !== undefined
            ? <Pill label={`for ${t.forSec}s`} color="default" onClick={() => jumpTo('for')} />
            : <Pill label="+ duration" outlined color="default" onClick={() => jumpTo('for')} />}
          {(t.count && t.withinSec)
            ? <Pill label={`×${t.count} within ${t.withinSec}s`} color="default" onClick={() => jumpTo('window')} />
            : <Pill label="+ rate" outlined color="default" onClick={() => jumpTo('window')} />}
          {draft.schedule
            ? <Pill label={`${draft.schedule.from}–${draft.schedule.to}`} color="default" onClick={() => jumpTo('schedule')} />
            : <Pill label="+ schedule" outlined color="default" onClick={() => jumpTo('schedule')} />}
          <Word>→</Word>
          <Pill label={`${draft.severity} alert · ${draft.cooldownSec}s cooldown`}
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
            <SectionTitle>Detect</SectionTitle>
            <SubjectEditor c={c} setCondition={setCondition} />
          </Paper>

          <Paper {...sec('where', { gridColumn: '1 / -1' })}>
            <SectionTitle>{scope.kind === 'zone' ? 'Where — zone' : scope.kind === 'line' ? 'Where — line' : 'Where — cameras'}</SectionTitle>
            <WhereEditor draft={draft} setDraft={setDraft}
              cams={cams} zoneDefs={zoneDefs} lineDefs={lineDefs} placedCams={placedCams} />
          </Paper>

          <Paper {...sec('for')}>
            <SectionTitle>Duration</SectionTitle>
            <NumberEditor label="Must hold for (seconds, 0 = instant)"
              value={t.forSec ?? 0} min={0} max={600}
              onChange={v => setDraft(d => ({ ...d, rule: { ...d.rule, time: { ...d.rule.time, forSec: v || undefined } } }))} />
          </Paper>

          <Paper {...sec('window')}>
            <SectionTitle>Rate</SectionTitle>
            <Stack spacing={1}>
              <NumberEditor label="Number of occurrences" value={t.count ?? 0} min={0} max={100}
                onChange={v => setDraft(d => ({ ...d, rule: { ...d.rule, time: { ...d.rule.time, count: v || undefined } } }))} />
              <NumberEditor label="Within (seconds)" value={t.withinSec ?? 0} min={0} max={3600}
                onChange={v => setDraft(d => ({ ...d, rule: { ...d.rule, time: { ...d.rule.time, withinSec: v || undefined } } }))} />
              <Typography variant="caption" color="text.secondary">Applies to event conditions (arrivals, crossings).</Typography>
            </Stack>
          </Paper>

          <Paper {...sec('schedule')}>
            <SectionTitle>Schedule</SectionTitle>
            <ScheduleEditor draft={draft} setDraft={setDraft} />
          </Paper>

          <Paper {...sec('alert')}>
            <SectionTitle>Alert</SectionTitle>
            <Stack spacing={1.5}>
              <ToggleButtonGroup exclusive size="small" value={draft.severity}
                onChange={(_, v) => v && setDraft(d => ({ ...d, severity: v }))}>
                <ToggleButton value="info">info</ToggleButton>
                <ToggleButton value="warning">warning</ToggleButton>
                <ToggleButton value="critical">critical</ToggleButton>
              </ToggleButtonGroup>
              <NumberEditor label="Cooldown between alerts (seconds)" value={draft.cooldownSec} min={5} max={3600}
                onChange={v => setDraft(d => ({ ...d, cooldownSec: v }))} />
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

const NumberEditor = ({ label, value, min, max, onChange }: {
  label: string, value: number, min: number, max: number, onChange: (v: number) => void,
}) => (
  <TextField label={label} type="number" size="small" fullWidth value={value}
    inputProps={{ min, max }} onChange={e => onChange(Number(e.target.value))} />
);

const SubjectEditor = ({ c, setCondition }: { c: Condition, setCondition: (c: Condition) => void }) => {
  const subject = subjectOf(c);
  const person: PersonFilter = (c as any).person ?? { identity: 'unknown' };
  const setPerson = (p: Partial<PersonFilter>) =>
    setCondition({ ...(c as any), person: { ...person, ...p } } as Condition);

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup exclusive size="small" value={subject} sx={{ flexWrap: 'wrap' }}
        onChange={(_, v: SubjectKind | null) => {
          if (!v) return;
          if (v === 'person') setCondition({ kind: 'person_arrived', person });
          else if (v === 'motion') setCondition({ kind: 'motion', state: 'absent', threshold: 1.0 });
          else if (v === 'count') setCondition({ kind: 'count', op: 'gte', value: 3 });
          else if (v === 'crossing') setCondition({ kind: 'crossing', direction: 'any' });
          else setCondition({ kind: 'camera', state: 'offline' });
        }}>
        <ToggleButton value="person">Person</ToggleButton>
        <ToggleButton value="motion">Motion</ToggleButton>
        <ToggleButton value="count">Count</ToggleButton>
        <ToggleButton value="crossing">Crossing</ToggleButton>
        <ToggleButton value="camera">Camera</ToggleButton>
      </ToggleButtonGroup>
      <Divider />

      {subject === 'person' && <>
        <ToggleButtonGroup exclusive size="small" value={c.kind}
          onChange={(_, v) => v && setCondition({ kind: v, person } as Condition)}>
          <ToggleButton value="person_arrived">arrives</ToggleButton>
          <ToggleButton value="person_present">is present</ToggleButton>
          <ToggleButton value="person_dwell">stays (dwell)</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup exclusive size="small" value={person.identity}
          onChange={(_, v) => v && setPerson({ identity: v })}>
          <ToggleButton value="any">any</ToggleButton>
          <ToggleButton value="known">known</ToggleButton>
          <ToggleButton value="unknown">unknown</ToggleButton>
          <ToggleButton value="ids">specific</ToggleButton>
        </ToggleButtonGroup>
        {person.identity === 'ids' &&
          <TextField label="Person ids (comma-separated)" size="small"
            value={(person.ids ?? []).join(', ')}
            onChange={e => setPerson({ ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />}
        <TextField select label="Attribute filter (optional)" size="small"
          value={person.attributes?.[0]?.attr ?? ''}
          onChange={e => setPerson({ attributes: e.target.value ? [{ attr: e.target.value, min: 0.5 }] : [] })}>
          <MenuItem value="">— none —</MenuItem>
          {PAR_ATTRS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        {c.kind === 'person_dwell' &&
          <Typography variant="caption" color="text.secondary">Set how long via the “+ duration” pill.</Typography>}
      </>}

      {subject === 'motion' && c.kind === 'motion' && <>
        <ToggleButtonGroup exclusive size="small" value={c.state}
          onChange={(_, v) => v && setCondition({ ...c, state: v })}>
          <ToggleButton value="present">present</ToggleButton>
          <ToggleButton value="absent">absent</ToggleButton>
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
          <ToggleButton value="gte">at least</ToggleButton>
          <ToggleButton value="lte">at most</ToggleButton>
        </ToggleButtonGroup>
        <NumberEditor label="Persons" value={c.value} min={0} max={500}
          onChange={v => setCondition({ ...c, value: v })} />
      </>}

      {subject === 'crossing' && c.kind === 'crossing' && (
        <ToggleButtonGroup exclusive size="small" value={c.direction} sx={{ flexWrap: 'wrap' }}
          onChange={(_, v) => v && setCondition({ ...c, direction: v })}>
          {['any', 'left', 'right', 'above', 'below'].map(d =>
            <ToggleButton key={d} value={d}>{d}</ToggleButton>)}
        </ToggleButtonGroup>
      )}

      {subject === 'camera' && c.kind === 'camera' && (
        <ToggleButtonGroup exclusive size="small" value={c.state}
          onChange={(_, v) => v && setCondition({ ...c, state: v })}>
          <ToggleButton value="offline">goes offline</ToggleButton>
          <ToggleButton value="online">comes back online</ToggleButton>
        </ToggleButtonGroup>
      )}
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
          {allowed.map((k: string) => <ToggleButton key={k} value={k}>{k === 'cams' ? 'cameras' : k}</ToggleButton>)}
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
const ScheduleEditor = ({ draft, setDraft }: any) => {
  const sched = draft.schedule ?? { days: [], from: '22:00', to: '06:00' };
  const set = (patch: any) => setDraft((d: ScenarioV2) => ({ ...d, schedule: { ...sched, ...patch } }));
  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup size="small" value={sched.days} sx={{ flexWrap: 'wrap' }}
        onChange={(_, days) => set({ days })}>
        {DAYS.map((d, i) => <ToggleButton key={d} value={i}>{d}</ToggleButton>)}
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary">No days selected = every day</Typography>
      <Stack direction="row" spacing={1}>
        <TextField label="From" type="time" size="small" value={sched.from}
          onChange={e => set({ from: e.target.value })} />
        <TextField label="To" type="time" size="small" value={sched.to}
          onChange={e => set({ to: e.target.value })} />
      </Stack>
      <Button size="small" color="inherit"
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
        <Tab label="Scenarios" />
        <Tab label={<Badge badgeContent={unseen.length} color="error"><Box sx={{ pr: unseen.length ? 2 : 0 }}>Events</Box></Badge>} />
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
