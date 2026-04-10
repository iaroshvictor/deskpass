import { AppType } from "../..";
import React from "react";
import {Meteor} from "meteor/meteor";
import { Autocomplete, Paper, TextField, Stack, FormControlLabel, Switch, Table, TableCell, TableHead, TableRow, TableBody, ButtonGroup, Button } from "@mui/material";
import Icon from './icon';
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import {AlertLists as AlertListsCollection} from '/imports/api/alertLists';
import {VisitSummaryMetaCollection} from '/imports/api/visitSummary';
import  DateRangePicker  from 'rsuite/DateRangePicker';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { CamsCollection } from '/imports/api/cams';
import NotificationsPausedIcon from '@mui/icons-material/NotificationsPaused';
import { AlertsArchiveCollection } from "/imports/api/alertsArchive";
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DisabledVisibleIcon from '@mui/icons-material/DisabledVisible';
import PageviewIcon from '@mui/icons-material/Pageview';
import {UsersMetaCollection} from '/imports/api/operatorsMeta';
import AlertItemModal from './itemModal'
 const AlertsArchiveRenderer = () => {
   
    const [filter, setFilter] = React.useState<{[key: string]: any}>({seenBy:{$ne: 'root'}});
    useSubscribe('alertsArchive', filter, 100, 0, {timestamp:-1});
    useSubscribe('visitSummaryMeta');
    useSubscribe('alertLists');
    useSubscribe('cams');
    useSubscribe('usersMeta');
    const[itemModal, setItemModal]=React.useState<string | null>(null)
    const handleCloseModal=()=>{
        setItemModal(null)
    }
    const allUsers = useFind(() => UsersMetaCollection.find({}), []);
    const AlertsArchive = useFind(()=>AlertsArchiveCollection.find(filter), [filter])
    const AlertsList = useFind(() => AlertListsCollection.find({}));
    const PersonFilter = useFind(() => VisitSummaryMetaCollection.find({}));
    const Cams = useFind(() => {
        return CamsCollection.find({});
    });
    const selectedList = React.useMemo(() => {
        return AlertsList.filter(alert => filter.listId ? filter.listId.$in?.includes(alert._id) : false);
    }, [AlertsList, filter.listId]);
    const selectedPerson = React.useMemo(() => {
        return PersonFilter.filter(person => filter.idInfo ? filter.idInfo.$in?.includes(person._id) : false);
    }, [PersonFilter, filter.idInfo]);
    const selectedCams = React.useMemo(() => {
        return Cams.filter(cam => filter.source ? filter.source.$in?.includes(cam._id) : false);
    }, [Cams, filter.source]);

    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            {itemModal && (
                <AlertItemModal
                    alertId={itemModal || '' }
                    onCloseModal={handleCloseModal}
                />
            )}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
           <Autocomplete
                sx={{width:'100%'}}
                options={AlertsList}
                getOptionLabel={(option) => option.name || ''}
                getOptionKey={(option) => option._id || ''}
                multiple
                value={selectedList}
                onChange={(_event, value) => {
                    if(!value || value.length === 0) {
                        setFilter(prev => {delete prev.listId; return {...prev}});
                    } else {
                        setFilter(prev=>({...prev, listId:{$in: value.map(v => v._id)}}));
                    }
                }}
                renderInput={(params) => <TextField {...params} label="Person List filter" variant="outlined" />}
           />
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
            <FormControlLabel
                control={
                    <Switch
                        checked={filter.seenBy === undefined}
                        onChange={(_e, checked)=>{setFilter(prev => {if(checked){delete prev.seenBy; return prev} return {...prev, seenBy:{$ne:'root'}}})}}
                    />
                }
                label={<NotificationsPausedIcon />}
            />
            </Stack>
            <Paper elevation={3} sx={{mt:2}}>
                {AlertsArchive.length >0 
                    ?<>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell></TableCell>
                                    <TableCell>Cam</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>List</TableCell>
                                    <TableCell>Timestamp</TableCell>
                                    <TableCell>Seen</TableCell>
                                    <TableCell>Seen By</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {AlertsArchive.map((visit) => (
                                    <TableRow key={visit._id}>
                                        <TableCell>
                                            <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Intruder Face" style={{ width: '50px', height: '50px' }} />
                                        </TableCell>

                                        <TableCell>{Cams.find(cam => cam._id === visit.source)?.name || 'Unknown Cam'}</TableCell>
                                        <TableCell>{PersonFilter.find(cam => String(cam._id) === String(visit.idInfo))?.idInfo?.firstName || 'Unknown'} {PersonFilter.find(cam => String(cam._id) === String(visit.idInfo))?.idInfo?.lastName || ''}</TableCell>
                                        <TableCell>{AlertsList.find(cam => cam._id === visit.listId)?.name || 'Unknown'}</TableCell>
                                        <TableCell>{visit.timestamp.toLocaleString()}</TableCell>
                                        <TableCell>{visit.seen ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon />}</TableCell>
                                        <TableCell>{visit.seenBy ? `${allUsers.find(u=>u._id === visit.seenBy)?.username} at ${visit.seenAt?.toLocaleString() || ''}` : 'N/A'}</TableCell>
                                        <TableCell>
                                            <ButtonGroup>
                                                <Button size='small' onClick={() => {
                                                        Meteor.callAsync('setSeenAlert', visit._id);
                                                }}>Mark seen
                                                    <DisabledVisibleIcon />
                                                </Button>
                                                <Button size='small' onClick={()=>{
                                                    setItemModal(visit._id || '');
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

const AlertsArchive: AppType = {
    appName: 'Alerts Archive',
    appIcon: <Icon />,
    render: AlertsArchiveRenderer,
    module: 'personAlert',
};
export default AlertsArchive;
