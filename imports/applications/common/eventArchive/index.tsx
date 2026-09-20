// One archive for everything that raised an alarm.
//
// Until now the same question — "what happened, and has anyone looked at it?"
// — was answered by two screens reading two collections: watch-list face
// matches (alertsArchive) and scenario engine firings (scenario_events_v2).
// This screen puts them in one list.
//
// It is a CLIENT-side merge on purpose: no collection, publication or method
// changes. Both sources keep their own shape in the database; this file
// normalises them into one row type, sorts by time and renders one table.
// Marking a row seen still calls that source's own method.
//
// What that costs, and why it is acceptable for now:
//   - Paging is per source. "Older" asks each publication for its next page,
//     so a page here is "the next N of each", not a strict global page. With
//     both sorted by time the merged list is still in the right order.
//   - Person and list filters stay client-side, exactly as on the old alerts
//     screen: the alertsArchive publication accepts a filter on source, seen,
//     seenBy, label and timestamp only, and silently drops the rest.
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
import AlertItemModal from '/imports/applications/personAlert/alertsArchive/itemModal';

const PAGE = 50;

type Source = 'all' | 'watchlist' | 'scenario';

const SEVERITY_COLOR: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info', warning: 'warning', critical: 'error',
};

/** One row of the merged list, whichever collection it came from. */
type Row = {
  id: string;
  source: 'watchlist' | 'scenario';
  at: Date;
  severity: string;
  camId: string;
  what: string;              // the event sentence, or the person's name
  detail: string;            // scenario name, or watch list name
  seen: boolean;
  seenBy?: string;
  seenAt?: Date | null;
  face?: string;             // base64 thumbnail, watch-list rows only
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
  // Watch-list only, applied in the browser (see the note at the top).
  const [lists, setLists] = React.useState<string[]>([]);
  const [persons, setPersons] = React.useState<string[]>([]);
  // Scenario only.
  const [scenarioIds, setScenarioIds] = React.useState<string[]>([]);
  const [severities, setSeverities] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState('');

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  // Free-text search is debounced: every keystroke would otherwise restart the
  // subscription and re-query the server.
  React.useEffect(() => {
    const t = setTimeout(() => { setMessage(search.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const wantsWatchlist = source !== 'scenario';
  const wantsScenario = source !== 'watchlist';

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
    return f;
  }, [cams, unseenOnly, range, scenarioIds, severities, message]);

  // Subscribing with an empty filter to a source the tabs have turned off
  // would still pull its documents down, so each subscription is skipped by
  // asking for nothing when its source is not wanted.
  useSubscribe('alertsArchive', alertFilter, wantsWatchlist ? PAGE : 0, page * PAGE, { timestamp: -1 });
  useSubscribe('scenario_events_v2', scenarioFilter, wantsScenario ? PAGE : 0, page * PAGE, { triggeredAt: -1 });
  useSubscribe('cams');
  useSubscribe('alertLists');
  useSubscribe('visitSummaryMeta');
  useSubscribe('usersMeta');
  useSubscribe('scenarios_v2');

  const camList = useFind(() => CamsCollection.find({}));
  const alertLists = useFind(() => AlertListsCollection.find({}));
  const people = useFind(() => VisitSummaryMetaCollection.find({}));
  const operators = useFind(() => UsersMetaCollection.find({}));
  const scenarios = useFind(() => ScenariosV2Collection.find({}));

  const alerts = useFind(() => AlertsArchiveCollection.find(alertFilter, {
    sort: { timestamp: -1 }, limit: PAGE,
  }), [alertFilter, page]);
  const events = useFind(() => ScenarioEventsV2Collection.find(scenarioFilter, {
    sort: { triggeredAt: -1 }, limit: PAGE,
  }), [scenarioFilter, page]);

  const camName = (id: string) => camList.find(c => c._id === id)?.name ?? id;
  const personName = (id: string) => {
    const p = people.find(x => String(x._id) === String(id));
    return p ? `${p.idInfo?.firstName ?? ''} ${p.idInfo?.lastName ?? ''}`.trim() || 'Unknown' : 'Unknown';
  };

  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];

    if (wantsWatchlist) {
      for (const a of alerts) {
        // The publication cannot filter on these two, so they are applied here.
        if (lists.length && !lists.includes(a.listId)) continue;
        if (persons.length && !persons.includes(String(a.idInfo))) continue;
        out.push({
          id: a._id as string,
          source: 'watchlist',
          at: a.timestamp,
          // A watch-list match has no severity of its own; it is an alarm about
          // a specific person, which is what "warning" means on this screen.
          severity: 'warning',
          camId: a.source,
          what: personName(a.idInfo as unknown as string),
          detail: alertLists.find(l => l._id === a.listId)?.name ?? '—',
          seen: !!a.seen,
          seenBy: a.seenBy,
          seenAt: a.seenAt,
          face: a.face_b64,
        });
      }
    }

    if (wantsScenario) {
      for (const e of events) {
        out.push({
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
  }, [alerts, events, wantsWatchlist, wantsScenario, lists, persons, alertLists, people, camList]);

  const markSeen = (row: Row) => {
    if (row.source === 'watchlist') Meteor.callAsync('setSeenAlert', row.id);
    else Meteor.callAsync('markScenarioEventsV2Seen', [row.id]);
  };

  const markAllSeen = () => {
    if (wantsWatchlist) Meteor.callAsync('setAllAlertsSeen');
    if (wantsScenario) Meteor.callAsync('markScenarioEventsV2Seen');
  };

  const byId = <T extends { _id?: string }>(all: T[], ids: string[]) =>
    all.filter(x => ids.includes(x._id as string));

  return (
    <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box', minWidth: 720 }}>
      {detailsOf && <AlertItemModal alertId={detailsOf} onCloseModal={() => setDetailsOf(null)} />}

      <Tabs value={source} onChange={(_e, v: Source) => { setSource(v); setPage(0); }} sx={{ mb: 2 }}>
        <Tab value="all" label="All events" />
        <Tab value="watchlist" label="Watch lists" />
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
        {wantsWatchlist && (
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
        {wantsScenario && (
          <>
            <Autocomplete
              sx={{ minWidth: 200, flex: 1 }} multiple options={scenarios} size="small"
              getOptionLabel={(o) => o.name || ''} getOptionKey={(o) => o._id || ''}
              value={byId(scenarios, scenarioIds)}
              onChange={(_e, value) => reset(setScenarioIds)(value.map(v => v._id as string))}
              renderInput={(p) => <TextField {...p} label="Scenario" variant="outlined" />}
            />
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

      {/* ── one list ── */}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Time</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>Severity</TableCell>
            <TableCell>Event</TableCell>
            <TableCell>Scenario / list</TableCell>
            <TableCell>Camera</TableCell>
            <TableCell>Seen</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => (
            <TableRow key={`${row.source}:${row.id}`} sx={{ opacity: row.seen ? 0.6 : 1 }}>
              <TableCell sx={{ width: 58 }}>
                {row.face && (
                  <img src={`data:image/jpeg;base64,${row.face}`} alt=""
                    style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} />
                )}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.at.toLocaleString()}</TableCell>
              <TableCell>
                <Chip size="small" variant="outlined"
                  label={row.source === 'watchlist' ? 'watch list' : 'scenario'} />
              </TableCell>
              <TableCell>
                <Chip size="small" color={SEVERITY_COLOR[row.severity] ?? 'default'} label={row.severity} />
              </TableCell>
              <TableCell>{row.what}</TableCell>
              <TableCell>{row.detail}</TableCell>
              <TableCell>{camName(row.camId)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {row.seen ? <CheckBoxIcon fontSize="small" /> : <CheckBoxOutlineBlankIcon fontSize="small" />}
                {row.seenBy && (
                  <Typography variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                    {operators.find(u => u._id === row.seenBy)?.username ?? row.seenBy}
                    {row.seenAt ? ` · ${row.seenAt.toLocaleString()}` : ''}
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
                  {row.source === 'watchlist' && (
                    <Button onClick={() => setDetailsOf(row.id)} startIcon={<PageviewIcon />}>
                      Details
                    </Button>
                  )}
                </ButtonGroup>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow><TableCell colSpan={9}>
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
          <Button endIcon={<NavigateNextIcon />}
            disabled={alerts.length < PAGE && events.length < PAGE}
            onClick={() => setPage(p => p + 1)}>Older</Button>
        </ButtonGroup>
        <Box sx={{ color: 'text.secondary', fontSize: 12 }}>
          {rows.length} shown
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
