// One archive for everything that raised an alarm.
//
// Until now the same question — "what happened, and has anyone looked at it?"
// — was answered by two screens reading two collections: person-list face
// matches (alertsArchive) and scenario engine firings (scenario_events_v2).
// This screen puts them in one list.
//
// It is a CLIENT-side merge on purpose: no collection, publication or method
// changes. Both sources keep their own shape in the database; this file
// normalises them into one row type, sorts by time and renders one table.
// Marking a row seen still calls that source's own method.
//
// Paging works on the merged list, not on either source: both subscriptions
// ask for the newest `window` documents and the screen slices a page out of
// what comes back. Asking each publication for its own page instead looks
// right and is not: the two subscriptions overlap in one client-side
// collection, the notification panel publishes into the same collection, and
// nothing then tells page two from page one.
//
// The cost is that the window grows with the page, and the publications clamp
// it at WINDOW_MAX. Past that the screen says so rather than quietly showing
// less than it claims.
//
// Person and list filters stay client-side, exactly as on the old alerts
// screen: the alertsArchive publication accepts a filter on source, seen,
// seenBy, label and timestamp only, and silently drops the rest.
import { AppType } from '../..';
import React from 'react';
import { Meteor } from 'meteor/meteor';
import {
  Autocomplete, Paper, TextField, Stack, Table, TableCell, TableHead, TableRow,
  TableBody, ButtonGroup, Button, Chip, ToggleButton, ToggleButtonGroup,
  Typography, FormControlLabel, Switch, Tabs, Tab, Box,
} from '@mui/material';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import DateRangePicker from 'rsuite/DateRangePicker';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DisabledVisibleIcon from '@mui/icons-material/DisabledVisible';
import PageviewIcon from '@mui/icons-material/Pageview';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import Icon from './icon';
import { CamsCollection } from '/imports/api/cams';
import { AlertsArchiveCollection } from '/imports/api/alertsArchive';
import { AlertLists as AlertListsCollection } from '/imports/api/alertLists';
import { VisitSummaryMetaCollection } from '/imports/api/visitSummary';
import { UsersMetaCollection } from '/imports/api/operatorsMeta';
import { ScenariosV2Collection, ScenarioEventsV2Collection } from '/imports/api/scenarioModel';
import { CamZoneDefsCollection } from '/imports/api/camZoneDefs';
import { CamLineDefsCollection } from '/imports/api/camLineDefs';
import AlertItemModal from '/imports/applications/personAlert/alertsArchive/itemModal';

const PAGE = 50;
// What the publications allow in one subscription (server/main.ts PAGE.max).
const WINDOW_MAX = 500;

type Source = 'all' | 'personList' | 'scenario';

const SEVERITY_COLOR: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info', warning: 'warning', critical: 'error',
};

// What the scenario was watching for, in the operator's words. Severity does
// not answer this: a crowd and a camera going dark can both be critical.
const CONDITION_LABEL: Record<string, string> = {
  person_arrived: 'person arrived',
  person_present: 'person present',
  person_dwell: 'person lingering',
  count: 'too many people',
  personCount: 'too many people',
  motion: 'motion',
  crossing: 'line crossed',
  camera: 'camera up or down',
  scene: 'scene keyword',
};

const IDENTITY_LABEL: Record<string, string> = {
  any: 'anyone',
  known: 'recognised',
  unknown: 'unrecognised',
  ids: 'specific people',
};

/** One row of the merged list, whichever collection it came from. */
type Row = {
  id: string;
  source: 'personList' | 'scenario';
  at: Date;
  severity: string;
  camId: string;
  what: string;              // the event sentence, or the person's name
  detail: string;            // scenario name, or person list name
  seen: boolean;
  seenBy?: string;
  seenAt?: Date | null;
  suppressed?: boolean;      // a duplicate the server silenced, nobody looked
  face?: string;             // base64 thumbnail, person-list rows only
  // Every filter on this screen has a column, so a narrowed list shows what
  // it was narrowed by. Scenario rows only.
  zone?: string;
  line?: string;
  condition?: string;
  identity?: string;
};

const EventArchiveRenderer = () => {
  const [source, setSource] = React.useState<Source>('all');
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [detailsOf, setDetailsOf] = React.useState<string | null>(null);

  // Filters shared by both sources, kept in the shape each publication wants.
  const [cams, setCams] = React.useState<string[]>([]);
  const [range, setRange] = React.useState<[Date, Date] | null>(null);
  const [unseenOnly, setUnseenOnly] = React.useState(false);
  // Person-list only, applied in the browser (see the note at the top).
  const [lists, setLists] = React.useState<string[]>([]);
  const [persons, setPersons] = React.useState<string[]>([]);
  // Scenario only.
  const [scenarioIds, setScenarioIds] = React.useState<string[]>([]);
  const [severities, setSeverities] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState('');
  // These two live on the scenario, not on the event, so they are matched by
  // joining each event to its scenario in the browser. That means they narrow
  // the page already fetched — a rare condition can look empty while older
  // matches sit on the next page. Moving them server-side would mean storing
  // the condition on the event, or a whitelist entry and a lookup.
  const [conditions, setConditions] = React.useState<string[]>([]);
  const [identities, setIdentities] = React.useState<string[]>([]);
  // Unlike the two above, these are on the event itself and whitelisted in the
  // publication, so the server does the narrowing and the whole archive is
  // searched — not just the window on screen.
  const [zones, setZones] = React.useState<string[]>([]);
  const [lines, setLines] = React.useState<string[]>([]);

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  // Free-text search is debounced: every keystroke would otherwise restart the
  // subscription and re-query the server.
  React.useEffect(() => {
    const t = setTimeout(() => { setMessage(search.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Narrowing by something only one source has — a scenario, a severity, a
  // person — is a statement about what the operator is looking for, so the
  // other source steps aside. Without this, picking one scenario still left
  // every person-list alert in the list and the filter looked broken.
  const scenarioNarrowed = scenarioIds.length > 0 || severities.length > 0 || message !== ''
    || conditions.length > 0 || identities.length > 0 || zones.length > 0 || lines.length > 0;
  const personListNarrowed = lists.length > 0 || persons.length > 0;
  const wantsPersonList = source === 'personList'
    || (source === 'all' && (!scenarioNarrowed || personListNarrowed));
  const wantsScenario = source === 'scenario'
    || (source === 'all' && (!personListNarrowed || scenarioNarrowed));
  // Which controls are on screen is the tab's business alone. Tying it to the
  // filters too would hide the scenario controls the moment a person filter
  // was set, and there would be no way to narrow both at once.
  const showPersonListFilters = source !== 'scenario';
  const showScenarioFilters = source !== 'personList';
  const hiddenBySource = source !== 'all' ? null
    : !wantsPersonList ? 'Person-list alerts are hidden while a scenario filter is set.'
    : !wantsScenario ? 'Scenario events are hidden while a person or list filter is set.'
    : null;

  const alertFilter = React.useMemo(() => {
    const f: { [k: string]: any } = {};
    if (cams.length) f.source = { $in: cams };
    if (unseenOnly) f.seen = false;
    if (range) f.timestamp = { $gte: range[0], $lte: range[1] };
    return f;
  }, [cams, unseenOnly, range]);

  const scenarioFilter = React.useMemo(() => {
    const f: { [k: string]: any } = {};
    if (cams.length) f.camId = { $in: cams };
    if (unseenOnly) f.seen = false;
    if (range) f.triggeredAt = { $gte: range[0], $lte: range[1] };
    if (scenarioIds.length) f.scenarioId = { $in: scenarioIds };
    if (severities.length) f.severity = { $in: severities };
    if (message) f.message = { $regex: message, $options: 'i' };
    if (zones.length) f.zoneDefId = { $in: zones };
    if (lines.length) f.lineDefId = { $in: lines };
    return f;
  }, [cams, unseenOnly, range, scenarioIds, severities, message, zones, lines]);

  // Everything down to the current page, in one subscription per source.
  // A source that is not on screen is not subscribed at all: passing a limit
  // of zero does not do that — clampLimit reads zero as "unset" and hands
  // back the default page — but an undefined name skips the hook's work.
  const windowSize = Math.min((page + 1) * PAGE, WINDOW_MAX);
  useSubscribe(wantsPersonList ? 'alertsArchive' : undefined,
    alertFilter, windowSize, 0, { timestamp: -1 });
  useSubscribe(wantsScenario ? 'scenario_events_v2' : undefined,
    scenarioFilter, windowSize, 0, { triggeredAt: -1 });
  useSubscribe('cams');
  useSubscribe('alertLists');
  useSubscribe('visitSummaryMeta');
  useSubscribe('usersMeta');
  useSubscribe('scenarios_v2');
  useSubscribe('cam_zone_defs');
  useSubscribe('cam_line_defs');

  const camList = useFind(() => CamsCollection.find({}));
  const alertLists = useFind(() => AlertListsCollection.find({}));
  const people = useFind(() => VisitSummaryMetaCollection.find({}));
  const operators = useFind(() => UsersMetaCollection.find({}));
  const scenarios = useFind(() => ScenariosV2Collection.find({}));
  const zoneDefs = useFind(() => CamZoneDefsCollection.find({}));
  const lineDefs = useFind(() => CamLineDefsCollection.find({}));

  const alerts = useFind(() => AlertsArchiveCollection.find(alertFilter, {
    sort: { timestamp: -1 }, limit: windowSize,
  }), [alertFilter, windowSize]);
  const events = useFind(() => ScenarioEventsV2Collection.find(scenarioFilter, {
    sort: { triggeredAt: -1 }, limit: windowSize,
  }), [scenarioFilter, windowSize]);

  const scenarioOf = React.useMemo(
    () => new Map(scenarios.map(s => [s._id as string, s])), [scenarios]);
  const conditionOf = (scenarioId: string) =>
    (scenarioOf.get(scenarioId)?.rule?.condition as { kind?: string } | undefined)?.kind;
  const identityOf = (scenarioId: string) =>
    ((scenarioOf.get(scenarioId)?.rule?.condition as any)?.person?.identity) as string | undefined;

  // Offer only what the scenarios in this deployment actually use, so the
  // control never lists a condition nobody watches for.
  const conditionOptions = React.useMemo(() => [...new Set(
    scenarios.map(s => (s.rule?.condition as { kind?: string } | undefined)?.kind).filter(Boolean),
  )] as string[], [scenarios]);
  const identityOptions = React.useMemo(() => [...new Set(
    scenarios.map(s => (s.rule?.condition as any)?.person?.identity).filter(Boolean),
  )] as string[], [scenarios]);

  const camName = (id: string) => camList.find(c => c._id === id)?.name ?? id;
  const personName = (id: string) => {
    const p = people.find(x => String(x._id) === String(id));
    return p ? `${p.idInfo?.firstName ?? ''} ${p.idInfo?.lastName ?? ''}`.trim() || 'Unknown' : 'Unknown';
  };

  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];

    if (wantsPersonList) {
      for (const a of alerts) {
        // The publication cannot filter on these two, so they are applied here.
        if (lists.length && !lists.includes(a.listId)) continue;
        if (persons.length && !persons.includes(String(a.idInfo))) continue;
        out.push({
          id: a._id as string,
          source: 'personList',
          at: a.timestamp,
          // A person-list alert has no severity of its own; it is an alarm about
          // a specific person, which is what "warning" means on this screen.
          severity: 'warning',
          camId: a.source,
          what: personName(a.idInfo as unknown as string),
          detail: alertLists.find(l => l._id === a.listId)?.name ?? '—',
          seen: !!a.seen,
          // A repeat sighting inside the person's alertpause window is stored
          // already seen, with 'root' standing in for the operator. Showing it
          // as a name would credit a person who never looked.
          seenBy: a.seenBy === 'root' ? undefined : a.seenBy,
          suppressed: a.seenBy === 'root',
          seenAt: a.seenAt,
          face: a.face_b64,
        });
      }
    }

    if (wantsScenario) {
      for (const e of events) {
        const kind = conditionOf(e.scenarioId);
        const who = identityOf(e.scenarioId);
        if (conditions.length && !conditions.includes(kind ?? '')) continue;
        if (identities.length && !identities.includes(who ?? '')) continue;
        out.push({
          zone: e.zoneDefId ? (zoneDefs.find(z => z._id === e.zoneDefId)?.label ?? e.zoneDefId) : undefined,
          line: e.lineDefId ? (lineDefs.find(l => l._id === e.lineDefId)?.label ?? e.lineDefId) : undefined,
          condition: kind ? (CONDITION_LABEL[kind] ?? kind) : undefined,
          identity: who ? (IDENTITY_LABEL[who] ?? who) : undefined,
          id: e._id as string,
          source: 'scenario',
          at: new Date(e.triggeredAt),
          severity: e.severity,
          camId: e.camId,
          what: e.message,
          detail: e.scenarioName,
          seen: !!e.seen,
        });
      }
    }

    return out.sort((x, y) => y.at.getTime() - x.at.getTime());
  }, [alerts, events, wantsPersonList, wantsScenario, lists, persons, conditions, identities,
      alertLists, people, camList, scenarioOf, zoneDefs, lineDefs]);

  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);
  // Thirteen columns of mostly dashes helps nobody: each of these appears
  // when the rows on screen have something to put in it.
  const shows = {
    zone: pageRows.some(r => r.zone),
    line: pageRows.some(r => r.line),
    condition: pageRows.some(r => r.condition),
    identity: pageRows.some(r => r.identity),
    face: pageRows.some(r => r.face),
  };
  const columnCount = 8 + Object.values(shows).filter(Boolean).length;
  const windowFull = windowSize >= WINDOW_MAX;
  const canGoOlder = !windowFull && rows.length >= (page + 1) * PAGE;

  const markSeen = (row: Row) => {
    if (row.source === 'personList') Meteor.callAsync('setSeenAlert', row.id);
    else Meteor.callAsync('markScenarioEventsV2Seen', [row.id]);
  };

  const markAllSeen = () => {
    if (wantsPersonList) Meteor.callAsync('setAllAlertsSeen');
    if (wantsScenario) Meteor.callAsync('markScenarioEventsV2Seen');
  };

  const byId = <T extends { _id?: string }>(all: T[], ids: string[]) =>
    all.filter(x => ids.includes(x._id as string));

  return (
    <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box', minWidth: 720 }}>
      {detailsOf && <AlertItemModal alertId={detailsOf} onCloseModal={() => setDetailsOf(null)} />}

      <Tabs value={source} onChange={(_e, v: Source) => { setSource(v); setPage(0); }} sx={{ mb: 2 }}>
        <Tab value="all" label="All events" />
        <Tab value="personList" label="Person lists" />
        <Tab value="scenario" label="Scenarios" />
      </Tabs>

      {/* ── filters both sources understand ── */}
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        <Autocomplete
          sx={{ width: '100%' }} multiple options={camList} size="small"
          getOptionLabel={(o) => o.name || ''} getOptionKey={(o) => o._id || ''}
          value={byId(camList, cams)}
          onChange={(_e, value) => reset(setCams)(value.map(v => v._id as string))}
          renderInput={(p) => <TextField {...p} label="Camera" variant="outlined" />}
        />
        <DateRangePicker
          // keep the calendar inside the screen: these windows often sit near
          // the right edge, where the default placement puts it out of view
          preventOverflow
          style={{ width: '100%' }}
          format="dd.MM.yy HH:mm"
          placeholder="Select date/time range"
          caretAs={CalendarMonthIcon}
          value={range}
          onChange={(value) => reset(setRange)(value as [Date, Date] | null)}
        />
        <FormControlLabel
          sx={{ whiteSpace: 'nowrap' }}
          control={<Switch size="small" checked={unseenOnly}
            onChange={(_e, v) => reset(setUnseenOnly)(v)} />}
          label="unseen only"
        />
      </Stack>

      {/* ── filters that only make sense for one source ── */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {showPersonListFilters && (
          <>
            <Autocomplete
              sx={{ minWidth: 200, flex: 1 }} multiple options={alertLists} size="small"
              getOptionLabel={(o) => o.name || ''} getOptionKey={(o) => o._id || ''}
              value={byId(alertLists, lists)}
              onChange={(_e, value) => reset(setLists)(value.map(v => v._id as string))}
              renderInput={(p) => <TextField {...p} label="Person list" variant="outlined" />}
            />
            <Autocomplete
              sx={{ minWidth: 200, flex: 1 }} multiple options={people} size="small"
              getOptionLabel={(o) => `${o.idInfo?.firstName ?? ''} ${o.idInfo?.lastName ?? ''}`}
              getOptionKey={(o) => o._id || ''}
              value={byId(people, persons)}
              onChange={(_e, value) => reset(setPersons)(value.map(v => v._id as string))}
              renderInput={(p) => <TextField {...p} label="Person" variant="outlined" />}
            />
          </>
        )}
        {showScenarioFilters && (
          <>
            <Autocomplete
              sx={{ minWidth: 200, flex: 1 }} multiple options={scenarios} size="small"
              getOptionLabel={(o) => o.name || ''} getOptionKey={(o) => o._id || ''}
              value={byId(scenarios, scenarioIds)}
              onChange={(_e, value) => reset(setScenarioIds)(value.map(v => v._id as string))}
              renderInput={(p) => <TextField {...p} label="Scenario" variant="outlined" />}
            />
            {zoneDefs.length > 0 && (
              <Autocomplete
                sx={{ minWidth: 170, flex: 1 }} multiple options={zoneDefs} size="small"
                getOptionLabel={(o) => o.label || ''} getOptionKey={(o) => o._id || ''}
                value={zoneDefs.filter(z => zones.includes(z._id as string))}
                onChange={(_e, value) => reset(setZones)(value.map(v => v._id as string))}
                renderInput={(p) => <TextField {...p} label="Zone" variant="outlined" />}
              />
            )}
            {lineDefs.length > 0 && (
              <Autocomplete
                sx={{ minWidth: 170, flex: 1 }} multiple options={lineDefs} size="small"
                getOptionLabel={(o) => o.label || ''} getOptionKey={(o) => o._id || ''}
                value={lineDefs.filter(l => lines.includes(l._id as string))}
                onChange={(_e, value) => reset(setLines)(value.map(v => v._id as string))}
                renderInput={(p) => <TextField {...p} label="Line" variant="outlined" />}
              />
            )}
            {conditionOptions.length > 1 && (
              <Autocomplete
                sx={{ minWidth: 180, flex: 1 }} multiple options={conditionOptions} size="small"
                getOptionLabel={(o) => CONDITION_LABEL[o] ?? o}
                value={conditions}
                onChange={(_e, value) => reset(setConditions)(value)}
                renderInput={(p) => <TextField {...p} label="Condition" variant="outlined" />}
              />
            )}
            {identityOptions.length > 1 && (
              <Autocomplete
                sx={{ minWidth: 170, flex: 1 }} multiple options={identityOptions} size="small"
                getOptionLabel={(o) => IDENTITY_LABEL[o] ?? o}
                value={identities}
                onChange={(_e, value) => reset(setIdentities)(value)}
                renderInput={(p) => <TextField {...p} label="Who" variant="outlined" />}
              />
            )}
            <ToggleButtonGroup size="small" value={severities}
              onChange={(_e, value: string[]) => reset(setSeverities)(value)}>
              <ToggleButton value="info">info</ToggleButton>
              <ToggleButton value="warning">warning</ToggleButton>
              <ToggleButton value="critical">critical</ToggleButton>
            </ToggleButtonGroup>
            <TextField label="Search message" size="small" value={search}
              onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
          </>
        )}
        <Button startIcon={<DoneAllIcon />} size="small" onClick={markAllSeen}>
          Mark all seen
        </Button>
      </Stack>

      {hiddenBySource && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {hiddenBySource}
        </Typography>
      )}
      {(conditions.length > 0 || identities.length > 0) && (
        // Say it rather than let the operator wonder: these two match against
        // the scenario, which is only known for the events already fetched.
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          Condition and Who are matched against the scenario, so they narrow the {windowSize} most
          recent events rather than the whole archive.
        </Typography>
      )}
      <Box sx={{ mb: 1 }} />

      {/* ── one list ── */}
      <Table size="small">
        <TableHead>
          <TableRow>
            {shows.face && <TableCell />}
            <TableCell>Time</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>Severity</TableCell>
            {shows.condition && <TableCell>Condition</TableCell>}
            {shows.identity && <TableCell>Who</TableCell>}
            <TableCell>Event</TableCell>
            <TableCell>Scenario / list</TableCell>
            <TableCell>Camera</TableCell>
            {shows.zone && <TableCell>Zone</TableCell>}
            {shows.line && <TableCell>Line</TableCell>}
            <TableCell>Seen</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pageRows.map(row => (
            <TableRow key={`${row.source}:${row.id}`} sx={{ opacity: row.seen ? 0.6 : 1 }}>
              {shows.face && (
                <TableCell sx={{ width: 58 }}>
                  {row.face && (
                    <img src={`data:image/jpeg;base64,${row.face}`} alt=""
                      style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} />
                  )}
                </TableCell>
              )}
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.at.toLocaleString()}</TableCell>
              <TableCell>
                <Chip size="small" variant="outlined"
                  label={row.source === 'personList' ? 'person list' : 'scenario'} />
              </TableCell>
              <TableCell>
                <Chip size="small" color={SEVERITY_COLOR[row.severity] ?? 'default'} label={row.severity} />
              </TableCell>
              {shows.condition && <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.condition ?? '—'}</TableCell>}
              {shows.identity && <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.identity ?? '—'}</TableCell>}
              <TableCell>{row.what}</TableCell>
              <TableCell>{row.detail}</TableCell>
              <TableCell>{camName(row.camId)}</TableCell>
              {shows.zone && <TableCell>{row.zone ?? '—'}</TableCell>}
              {shows.line && <TableCell>{row.line ?? '—'}</TableCell>}
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {row.seen ? <CheckBoxIcon fontSize="small" /> : <CheckBoxOutlineBlankIcon fontSize="small" />}
                {row.seenBy && (
                  <Typography variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                    {operators.find(u => u._id === row.seenBy)?.username ?? row.seenBy}
                    {row.seenAt ? ` · ${row.seenAt.toLocaleString()}` : ''}
                  </Typography>
                )}
                {row.suppressed && (
                  <Typography variant="caption" sx={{ ml: 0.5, color: 'text.disabled' }}>
                    repeat, silenced
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <ButtonGroup size="small">
                  {!row.seen && (
                    <Button onClick={() => markSeen(row)} startIcon={<DisabledVisibleIcon />}>
                      Mark seen
                    </Button>
                  )}
                  {row.source === 'personList' && (
                    <Button onClick={() => setDetailsOf(row.id)} startIcon={<PageviewIcon />}>
                      Details
                    </Button>
                  )}
                </ButtonGroup>
              </TableCell>
            </TableRow>
          ))}
          {!pageRows.length && (
            <TableRow><TableCell colSpan={columnCount}>
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No events match the current filters.
              </Typography>
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Stack direction="row" justifyContent="center" alignItems="center" sx={{ mt: 1 }} spacing={2}>
        <ButtonGroup size="small">
          <Button startIcon={<NavigateBeforeIcon />} disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}>Newer</Button>
          <Button disabled>page {page + 1}</Button>
          <Button endIcon={<NavigateNextIcon />} disabled={!canGoOlder}
            onClick={() => setPage(p => p + 1)}>Older</Button>
        </ButtonGroup>
        <Box sx={{ color: 'text.secondary', fontSize: 12 }}>
          {pageRows.length
            ? `${page * PAGE + 1}–${page * PAGE + pageRows.length} of ${rows.length} loaded`
            : 'nothing on this page'}
          {windowFull && ' · the archive hands out the newest 500; narrow the filters to go further back'}
        </Box>
      </Stack>
    </Paper>
  );
};

const EventArchiveApp: AppType = {
  appName: 'Event Archive',
  appIcon: <Icon />,
  render: EventArchiveRenderer,
};
export default EventArchiveApp;
