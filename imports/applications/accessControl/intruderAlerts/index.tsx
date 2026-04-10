import { AppType } from "../..";
import React, { useEffect } from "react";
import {Meteor} from "meteor/meteor";
import { Autocomplete,
    Paper,
    TextField,
    Stack,
    Switch,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    ButtonGroup,
    Button,
    Divider,
    Pagination
} from "@mui/material";
import Icon from './icon';
import { IntruderAlertsCollection } from '/imports/api/intruderAlerts';
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import  DateRangePicker  from 'rsuite/DateRangePicker';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { CamsCollection } from '/imports/api/cams';
import PageviewIcon from '@mui/icons-material/Pageview';
import {UsersMetaCollection} from '/imports/api/operatorsMeta';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DisabledVisibleIcon from '@mui/icons-material/DisabledVisible';
import IntruderItemModal from './intruderItemModal';
 const IntruderAlertsArchiveRenderer = () => {
    const limit = 100;
    const [skip, setSkip] = React.useState<number>(0);
    const [filter, setFilter] = React.useState<{[key: string]: any}>({});
    useSubscribe('cams');
    useSubscribe('intruderAlerts', filter, limit, skip, {timestamp:-1});
    const [itemsCount, setItemsCount] = React.useState<number>(0);
    const intruders = useFind(() => IntruderAlertsCollection.find(filter), [filter]);
    useSubscribe('usersMeta');
    const allUsers = useFind(() => UsersMetaCollection.find({}), []);
    const Cams = useFind(() => {
        return CamsCollection.find({});
    });
    const selectedCams = React.useMemo(() => {
        return Cams.filter(cam => filter.source ? filter.source.$in?.includes(cam._id) : false);
    }, [Cams, filter.source]);
    const [intruderModal , setIntruderModal] = React.useState<string | null>(null);
    const onCloseModal = () => {
        setIntruderModal(null);
    }
    useEffect(() => {
        (async ()=>{
            const count = await Meteor.callAsync('countIntruder', filter)
            setItemsCount(count);
        })()
        
    }, [filter]);
    
    return (
        
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            {intruderModal && (
                <IntruderItemModal
                    alertId={intruderModal || '' }
                    onCloseModal={onCloseModal}
                />
            )}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Autocomplete
                 options={Cams}
                 sx={{width:'100%'}}
                 getOptionKey={(option) => option._id || ''}
                 getOptionLabel={(option) => option.name || ''}
                 renderInput={(params) => <TextField {...params} label="Source filter" variant="outlined" />}
                 multiple
                 value={selectedCams}
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
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography>All</Typography>
                <Switch checked = {filter.seen === true} onChange={(_e, checked) => { setFilter(prev => {if (checked){return {...prev, seen:true}}else{delete prev.seen; return prev}}) }} />
                <Typography>Unseen Only</Typography>
            </Stack>
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
            <Paper elevation={3} sx={{mt:2}}>
                {intruders.length >0 
                    ?<>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell></TableCell>
                                    <TableCell>Cam Name</TableCell>
                                    <TableCell>Timestamp</TableCell>
                                    <TableCell>Trigger</TableCell>
                                    <TableCell>Seen</TableCell>
                                    <TableCell>Seen By</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {intruders.map((visit) => (
                                    <TableRow key={visit._id}>
                                        <TableCell>
                                            <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Intruder Face" style={{ width: '50px', height: '50px' }} />
                                        </TableCell>
                                        <TableCell>{Cams.find(cam => cam._id === visit.source)?.name || 'Unknown Cam'}</TableCell>
                                        <TableCell>{visit.timestamp.toLocaleString()}</TableCell>
                                        <TableCell>
                                            {visit.triggerLine && visit.triggerSide
                                                ? (() => {
                                                    const cam = Cams.find(c => c._id === visit.source);
                                                    const line = cam?.lines?.find(l => l.lineId === visit.triggerLine);
                                                    return `${line?.label ?? visit.triggerLine} → ${visit.triggerSide}`;
                                                })()
                                                : '—'}
                                        </TableCell>
                                        <TableCell>{visit.seen ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon />}</TableCell>
                                        <TableCell>{visit.seenBy ? `${allUsers.find(u=>u._id === visit.seenBy)?.username} at ${visit.seenAt?.toLocaleString()}` : 'N/A'}</TableCell>
                                        <TableCell>
                                            <ButtonGroup>
                                                <Button size='small' onClick={() => {
                                                     Meteor.callAsync('setSeenIntruder', visit._id);
                                                }}>Mark seen
                                                    <DisabledVisibleIcon />
                                                </Button>
                                                <Button size='small' onClick={()=>{
                                                    setIntruderModal(visit._id || '');
                                                }}>
                                                    <PageviewIcon />
                                                    View details
                                                </Button>
                                            </ButtonGroup>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </>
                    :<>
                    </>
                }

            </Paper>
        </Paper>
    );
}

const IntruderAlertsArchive: AppType = {
    appName: 'Intruder Alerts',
    appIcon: <Icon />,
    render: IntruderAlertsArchiveRenderer,
    module: 'accessControl',
};
export default IntruderAlertsArchive;
