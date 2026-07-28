import { AppType } from "../..";
import React from "react";
import { Meteor } from "meteor/meteor";
import {
  Autocomplete, Paper, TextField, Stack, Table, TableCell, TableHead, TableRow,
  TableBody, ButtonGroup, Button, Chip, ToggleButton, ToggleButtonGroup,
  Typography, FormControlLabel, Switch,
} from "@mui/material";
import Icon from './icon';
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import DateRangePicker from 'rsuite/DateRangePicker';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { CamsCollection } from '/imports/api/cams';
import { ScenariosV2Collection, ScenarioEventsV2Collection } from '/imports/api/scenarioModel';

const PAGE = 50;
const SEVERITY_COLOR: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info', warning: 'warning', critical: 'error',
};

const ScenarioArchiveRenderer = () => {
  const [filter, setFilter] = React.useState<{ [key: string]: any }>({});
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState('');

  // debounce free-text search into the filter
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilter(prev => {
        const next = { ...prev };
        if (search.trim()) next.message = { $regex: search.trim(), $options: 'i' };
        else delete next.message;
        return next;
      });
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useSubscribe('scenario_events_v2', filter, PAGE, page * PAGE, { triggeredAt: -1 });
  useSubscribe('scenarios_v2');
  useSubscribe('cams');

  const events = useFind(() =>
    ScenarioEventsV2Collection.find(filter, { sort: { triggeredAt: -1 }, limit: PAGE }),
    [filter, page]);
  const scenarios = useFind(() => ScenariosV2Collection.find({}));
  const cams = useFind(() => CamsCollection.find({}));
  const camName = (id: string) => cams.find(c => c._id === id)?.name ?? id;

  const setF = (patch: (prev: any) => any) => { setFilter(patch); setPage(0); };

  const selectedScenarios = scenarios.filter(s => filter.scenarioId?.$in?.includes(s._id));
  const selectedCams = cams.filter(c => filter.camId?.$in?.includes(c._id));
  const severities: string[] = filter.severity?.$in ?? [];

  return (
    <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box', minWidth: 720 }}>
      {/* ── filters ── */}
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        <Autocomplete
          sx={{ width: '100%' }} multiple options={scenarios}
          getOptionLabel={(o) => o.name || ''} getOptionKey={(o) => o._id || ''}
          value={selectedScenarios}
          onChange={(_e, value) => setF(prev => {
            const next = { ...prev };
            if (value.length) next.scenarioId = { $in: value.map(v => v._id) };
            else delete next.scenarioId;
            return next;
          })}
          renderInput={(p) => <TextField {...p} label="Scenario filter" variant="outlined" size="small" />}
        />
        <Autocomplete
          sx={{ width: '100%' }} multiple options={cams}
          getOptionLabel={(o) => o.name || ''} getOptionKey={(o) => o._id || ''}
          value={selectedCams}
          onChange={(_e, value) => setF(prev => {
            const next = { ...prev };
            if (value.length) next.camId = { $in: value.map(v => v._id) };
            else delete next.camId;
            return next;
          })}
          renderInput={(p) => <TextField {...p} label="Camera filter" variant="outlined" size="small" />}
        />
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <ToggleButtonGroup size="small" value={severities}
          onChange={(_e, value: string[]) => setF(prev => {
            const next = { ...prev };
            if (value.length) next.severity = { $in: value };
            else delete next.severity;
            return next;
          })}>
          <ToggleButton value="info">info</ToggleButton>
          <ToggleButton value="warning">warning</ToggleButton>
          <ToggleButton value="critical">critical</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel control={
          <Switch size="small" checked={filter.seen === false}
            onChange={(_e, v) => setF(prev => {
              const next = { ...prev };
              if (v) next.seen = false; else delete next.seen;
              return next;
            })} />
        } label="unseen only" />
        <DateRangePicker
          placeholder="Time range" format="yyyy-MM-dd HH:mm" showMeridiem={false}
          value={filter.triggeredAt ? [filter.triggeredAt.$gte, filter.triggeredAt.$lte] : null}
          onChange={(range) => setF(prev => {
            const next = { ...prev };
            if (range?.[0] && range?.[1]) next.triggeredAt = { $gte: range[0], $lte: range[1] };
            else delete next.triggeredAt;
            return next;
          })}
        />
        <TextField label="Search message" size="small" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
        <Button startIcon={<DoneAllIcon />} size="small"
          onClick={() => Meteor.callAsync('markScenarioEventsV2Seen')}>
          Mark all seen
        </Button>
      </Stack>

      {/* ── results ── */}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Severity</TableCell>
            <TableCell>Event</TableCell>
            <TableCell>Scenario</TableCell>
            <TableCell>Camera</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map(ev => (
            <TableRow key={ev._id} sx={{ opacity: ev.seen ? 0.6 : 1 }}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(ev.triggeredAt).toLocaleString()}</TableCell>
              <TableCell><Chip size="small" color={SEVERITY_COLOR[ev.severity]} label={ev.severity} /></TableCell>
              <TableCell>{ev.message}</TableCell>
              <TableCell>{ev.scenarioName}</TableCell>
              <TableCell>{camName(ev.camId)}</TableCell>
              <TableCell>
                {!ev.seen && <Chip size="small" variant="outlined" label="mark seen"
                  onClick={() => Meteor.callAsync('markScenarioEventsV2Seen', [ev._id])} />}
              </TableCell>
            </TableRow>
          ))}
          {!events.length && (
            <TableRow><TableCell colSpan={6}>
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No events match the current filters.
              </Typography>
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {/* ── pagination ── */}
      <Stack direction="row" justifyContent="center" sx={{ mt: 1 }}>
        <ButtonGroup size="small">
          <Button startIcon={<NavigateBeforeIcon />} disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}>Newer</Button>
          <Button disabled>page {page + 1}</Button>
          <Button endIcon={<NavigateNextIcon />} disabled={events.length < PAGE}
            onClick={() => setPage(p => p + 1)}>Older</Button>
        </ButtonGroup>
      </Stack>
    </Paper>
  );
};

const ScenarioArchiveApp: AppType = {
  appName: 'Scenario Archive',
  render: ScenarioArchiveRenderer,
  appIcon: <Icon />,
};
export default ScenarioArchiveApp;
