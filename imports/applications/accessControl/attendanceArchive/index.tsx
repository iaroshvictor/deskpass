import * as React from 'react';
import { AppType } from "../..";
import Icon from './icon';
import  { Meteor } from 'meteor/meteor';
import { Autocomplete, Paper, TextField, Stack, Pagination, Divider, Typography, Table, TableBody, TableHead, TableRow, TableCell, Avatar, Button } from "@mui/material";

import { useFind, useSubscribe } from "meteor/react-meteor-data";

import {VisitSummaryMetaCollection} from '/imports/api/visitSummary';
import  DateRangePicker  from 'rsuite/DateRangePicker';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { GatesCollection } from '/imports/api/gates';
import { AccessReportCollection } from '/imports/api/accessReport';
import PageviewIcon from '@mui/icons-material/Pageview';
const AttendanceArchiveRenderer = () => {
    const [_accessModal, setAccessModal] = React.useState<string | null>(null);
    const [filter, setFilter] = React.useState<{[key: string]: any}>({});
    const limit =100;
    const [skip, setSkip] = React.useState(0);
    const [itemsCount, setItemsCount] = React.useState<number>(0);
    useSubscribe('attendanceArchive', filter, limit, skip, {timestamp:-1});
    const AccessReport = useFind(() => AccessReportCollection.find(filter), [filter]);
    React.useEffect(() => {
        (async ()=>{
            const count = await Meteor.callAsync('countAccessReport', filter);
            setItemsCount(count);
        })()
    }, [filter]);
    useSubscribe('visitSummaryMeta');
    useSubscribe('gates');
    const PersonFilter = useFind(() => VisitSummaryMetaCollection.find({}));
    const Gates = useFind(() => {
        return GatesCollection.find({});
    });
    const selectedPerson = React.useMemo(() => {
        return PersonFilter.filter(person => filter.idInfo ? filter.idInfo.$in?.includes(person._id) : false);
    }, [PersonFilter, filter.idInfo]);
    const selectedGates = React.useMemo(() => {
        return Gates.filter(gate => filter.source ? filter.source.$in?.includes(gate._id) : false);
    }, [Gates, filter.source]);
    const getPersonName = (idInfo: string | number) => {
        if (!idInfo) return 'Unknown';
        const pers = PersonFilter.find(p => String(p._id) === String(idInfo));
        if (!pers) return 'Unknown';
        return `${pers.idInfo?.firstName || ''} ${pers.idInfo?.lastName || ''}`.trim() || 'Unknown';
    };
    const getGateName = (source: string) => {
        if (!source) return 'Unknown Gate';
        const gate = Gates.find(g => g._id === source);
        return gate ? gate.name : 'Unknown Gate';
    };
    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
           
           <Autocomplete
                sx={{width:'100%'}}
                options={PersonFilter}
                getOptionKey={(option) => option._id || ''}
                getOptionLabel={(option) => `${option.idInfo?.firstName || ''} ${option.idInfo?.lastName || ''}`}
                renderInput={(params) => <TextField {...params} label="Person filter" variant="outlined" />}
                multiple
                value={selectedPerson}
                onChange={(_event, value) => {
                    if(!value || value.length === 0) {
                        setFilter(prev => {delete prev.idInfo; return {...prev}});
                    } else {
                        setFilter(prev=>({...prev, idInfo:{$in: value.map(v => v._id)}}));
                    }
                }}
           />
            <Autocomplete
                 options={Gates}
                 sx={{width:'100%'}}
                 getOptionKey={(option) => option._id || ''}
                 getOptionLabel={(option) => option.name || ''}
                 renderInput={(params) => <TextField {...params} label="Source filter" variant="outlined" />}
                 multiple
                 value={selectedGates}
                 onChange={(_event, value) => {
                      if(!value || value.length === 0) {
                            setFilter(prev => {delete prev.source; return {...prev}});
                      } else {
                            setFilter(prev=>({...prev, source:{$in: value.map(v => v._id)}}));
                      }
                 }}
           />
            <DateRangePicker
                style={{width:'100%'}}
                format="dd.MM.yy HH:mm:ss"
                placeholder="Select date/time range"
                caretAs={CalendarMonthIcon}
                size="lg"
                onChange={(value) => {
                    if(value){
                        setFilter(prev => ({...prev, timestamp: {$gte: value[0], $lte: value[1]}}));
                    }else{
                        setFilter(prev => {delete prev.timestamp; return {...prev}});
                    }
                }}
            />
            
            </Stack>
            <Divider sx={{mb:1}}/>
            <Pagination
                count={Math.ceil(itemsCount / limit)}
                color="secondary"

                page={(skip+limit)/limit}
                onChange={(_e, v)=>{
                    setSkip((v-1)*limit);
                }}
            />
            {AccessReport.length > 0 ? (
               <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell></TableCell>
                                    <TableCell>First/Last name</TableCell>
                                    <TableCell>Gate</TableCell>
                                    <TableCell>Time</TableCell>
                                    <TableCell>Action</TableCell>
                                    <TableCell>View</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {AccessReport.map((visit) => (
                                    <TableRow key={visit._id}>
                                        <TableCell>
                                            <Avatar
                                                src={`data:image/jpeg;base64,${visit.face_b64}`}
                                                alt="Face"
                                                sx={{ width: 56, height: 56, borderRadius:2 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {getPersonName(visit.idInfo)}
                                        </TableCell>
                                        <TableCell>
                                            {getGateName(visit.source)}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(visit.timestamp).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {visit.type}
                                        </TableCell>
                                        <TableCell>
                                            <Button size='small' onClick={()=>{
                                                setAccessModal(visit._id || '');
                                            }}>
                                                <PageviewIcon />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                        </Table>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    No access reports found.
                </Typography>
            )}
        </Paper>
    );
}
const AttendanceArchiveApp: AppType = {
    appName: 'Attendance Archive',
    appIcon: <Icon />,
    render: AttendanceArchiveRenderer,
    module: 'accessControl',
};

export default AttendanceArchiveApp;
