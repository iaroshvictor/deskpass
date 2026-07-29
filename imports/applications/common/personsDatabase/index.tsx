import * as React from 'react';
import { Meteor } from 'meteor/meteor';
import { AppType } from "../..";
import Icon from './icon';
import {useEffect, useState, useRef } from 'react';
import{
    Paper,
    Stack,
    Typography,
    Badge,
    Autocomplete,
    TextField,
    Box,
    Chip,
    Divider,
    Grid,
    Pagination,
    LinearProgress,
    Tabs,
    Tab,
    Fab,
    Zoom,
    Popover,
    MenuList,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Snackbar,
    Button,
    ButtonGroup,
    Tooltip,
    IconButton,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';


const PAR_COLOR_KEYS = ['head_color','upper_color','lower_color'] as const;
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { VisitSummary, VisitsSummaryCollection } from '/imports/api/visitSummary';
import { parToChips, AlertRecordingPlayer } from '/imports/applications/personAlert/alertsArchive/itemModal';
import ParRepresentation from '/imports/applications/common/ParRepresentation';
import ParFilterBuilder, { countActiveParFilters, ParFilterState } from '/imports/applications/common/ParRepresentation/ParFilterBuilder';
import { AlertLists } from '/imports/api/alertLists';

const aggregatePar = (visits: Visit[]): Record<string, number | string> | null => {
    const withPar = visits.filter(v => v.par && Object.keys(v.par).length > 0);
    if (withPar.length === 0) return null;
    const result: Record<string, number | string> = {};
    const numericKeys = new Set<string>();
    withPar.forEach(v => Object.keys(v.par!).forEach(k => { if (typeof v.par![k] === 'number') numericKeys.add(k); }));
    numericKeys.forEach(k => {
        const vals = withPar.filter(v => typeof v.par![k] === 'number').map(v => v.par![k] as number);
        result[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    PAR_COLOR_KEYS.forEach(k => {
        const colors = withPar.filter(v => v.par && typeof v.par[k] === 'string').map(v => v.par![k] as string);
        if (colors.length > 0) {
            const freq = colors.reduce((acc, c) => ({ ...acc, [c]: (acc[c] || 0) + 1 }), {} as Record<string, number>);
            result[k] = Object.entries(freq).sort(([,a],[,b]) => b - a)[0][0];
        }
    });
    return Object.keys(result).length ? result : null;
};
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import AddLinkIcon from '@mui/icons-material/AddLink';
import { CamsCollection, Cam } from '/imports/api/cams';
import EditIcon from '@mui/icons-material/Edit';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { Visit, VisitsCollection } from '/imports/api/visits';
import IdentifyEdit from './indetifyEditForm';
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

type Filter={
    source?:string,
    timestamp?: {
        $gte?: Date,
        $lte?: Date
    },
    [key: string]: any,
}

const ParBadge = ({par}: {par?: Record<string, number | string>}) => {
    if (!par || Object.keys(par).length === 0) return null;
    const activeAttrs = parToChips(par);
    const colors = PAR_COLOR_KEYS.map(k => par[k] as string | undefined).filter(Boolean);
    if (activeAttrs.length === 0 && colors.length === 0) return null;
    return (
        <Tooltip title={
            <Stack spacing={0.5}>
                {colors.length > 0 && (
                    <Stack direction='row' spacing={1}>
                        {PAR_COLOR_KEYS.map(k => par[k] && (
                            <Stack key={k} direction='row' spacing={0.3} alignItems='center'>
                                <Box sx={{width:8, height:8, borderRadius:'50%', bgcolor:String(par[k]), border:'1px solid #fff', flexShrink:0}} />
                                <Typography variant="caption">{k.replace('_color','')}: {par[k]}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                )}
                <Stack direction='row' flexWrap='wrap' gap={0.3}>
                    {activeAttrs.map(({label, score}) => (
                        <Chip key={label} label={`${label} ${(score*100).toFixed(0)}%`} size="small" sx={{height:16, fontSize:'0.6rem'}} />
                    ))}
                </Stack>
            </Stack>
        }>
            <Stack direction='row' spacing={0.3} justifyContent='center' sx={{cursor:'default'}}>
                {colors.slice(0,3).map((c, i) => (
                    <Box key={i} sx={{width:8, height:8, borderRadius:'50%', bgcolor:c, border:'1px solid #ccc', flexShrink:0}} />
                ))}
                {activeAttrs.length > 0 && (
                    <Typography variant="caption" sx={{fontSize:'0.55rem', lineHeight:1, color:'text.secondary'}}>
                        {activeAttrs.length} attr
                    </Typography>
                )}
            </Stack>
        </Tooltip>
    );
};

const ItemDetailedRender = ({visit, cams, setMessage, setSelectedItemDialog}:{visit:VisitSummary, onClose:()=>void, cams:Cam[], setMessage:(messgae:string)=>void, setSelectedItemDialog:(param :VisitSummary | null)=>void}) => {
    const [idForm, setIdForm] = useState<boolean>(false)
    useSubscribe('visits', {tracking_id: visit._id}, 0, 0, {timestamp:-1});
    useSubscribe('alertLists');
    const visits = VisitsCollection.find({tracking_id: visit._id}, {sort: {timestamp: -1}}).fetch();
    const alertLists = AlertLists.find({}).fetch();
    const alertList = visit.idInfo?.alertList ? alertLists.find(l => l._id === visit.idInfo!.alertList) : null;
    const aggregatedPar = aggregatePar(visits);
    const parWithData = visits.filter(v => v.par && Object.keys(v.par).length > 0).length;
    const getCamName = (camId: string) => {
        const cam = cams.find(c => c._id === camId);
        return cam ? cam.name : 'Unknown Camera';
    }
    const [selectedVisits, setSelectedVisits] = useState<string[]>([]);
    const identifyEditRef = useRef<{ save: () => boolean, deleteSummary: ()=>boolean }>(null);
    
    const handleSave = () => {
        if (identifyEditRef.current) {
            const result = identifyEditRef.current.save();
            if(result){
                setMessage('Person information saved');
            }else{
                setMessage('Error saving information');
            }
            // handle result
        }
    };
    const handleRemove = () => {
        if (identifyEditRef.current) {
            const result = identifyEditRef.current.deleteSummary();
            if(result){
                setMessage('Person information deleted');
            }else{
                setMessage('Error removing information');
            }
            setIdForm(false);
            // handle result
        }
    }
    const handleClick = ()=>{
       try{
            Meteor.callAsync('optimizeVisits', visit._id)
            setMessage('Faces optimized successfully');
       }catch(e:any){
           console.error('Error optimizing embeddings:', e);
              setMessage('Error optimizing embeddings: ' + e.message as string);
       }
    }

    const handleDeleteClick=()=>{
        try{
            Meteor.callAsync('removeVisitItems', selectedVisits);
            setMessage('Faces deleted successfully');
        }catch(e:any){
            console.error('Error deleting visits:', e);
            setMessage('Error deleting visits: ' + e.message as string);
        }
       
        setSelectedVisits([]);
    }

    const handleIdClick=()=>{
        setIdForm(true)
    }
   

return  idForm ?(
    <Dialog
        open={true} 
        maxWidth='xl'
        fullWidth
        slots={{
        transition: Transition,
        }}
        keepMounted
        onClose={() => setSelectedItemDialog(null)}
        aria-describedby="alert-dialog-slide-description"
    >
        <DialogTitle>{visit.idInfo?.firstName? <><EditIcon />{`${visit.idInfo.firstName} ${visit.idInfo.lastName}`}</> :"Identify Person"}</DialogTitle>
        <DialogContent>
            <IdentifyEdit ref={identifyEditRef} tracking_id={visits[0]?.tracking_id || ''} visits={visits.map(i=>i._id || '')} />
        </DialogContent>
        <DialogActions>
            <Button onClick={handleSave}>Save</Button>
            <Button onClick={handleRemove}>Delete</Button>
            <Button onClick={() => setSelectedItemDialog(null)}>Close</Button>
        </DialogActions>
    </Dialog>
    ) :(
    <Dialog
        open={true} 
        maxWidth='xl'
        fullWidth
        slots={{
        transition: Transition,
        }}
        keepMounted
        onClose={() => setSelectedItemDialog(null)}
        aria-describedby="alert-dialog-slide-description"
    >
        <DialogTitle>
            {visit.idInfo?.firstName
                ? <><EditIcon sx={{mr:1, verticalAlign:'middle'}}/>{visit.idInfo.firstName} {visit.idInfo.lastName}</>
                : 'Photos'}
        </DialogTitle>
        <DialogContent>
            {/* ── Identity banner ─────────────────────────────────────── */}
            {visit.idInfo?.firstName && (
                <Paper variant="outlined" sx={{p:2, mb:2, borderLeft:'4px solid', borderColor:'secondary.main'}}>
                    <Stack direction='row' spacing={2} alignItems='flex-start'>
                        <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Face"
                            style={{width:60, height:60, objectFit:'cover', borderRadius:4}} />
                        <Stack spacing={0.5} flexGrow={1}>
                            <Typography variant="h6" lineHeight={1.2}>
                                {visit.idInfo.firstName} {visit.idInfo.lastName}
                            </Typography>
                            {visit.idInfo.comment && (
                                <Typography variant="body2" color="text.secondary">{visit.idInfo.comment}</Typography>
                            )}
                            <Stack direction='row' spacing={1} flexWrap='wrap'>
                                {alertList && (
                                    <Chip label={alertList.name} size="small" color="warning"
                                        sx={{...(alertList.color ? {bgcolor: alertList.color, color:'#fff'} : {})}} />
                                )}
                                {visit.idInfo.divission && (
                                    <Chip label={visit.idInfo.divission} size="small" variant="outlined" />
                                )}
                                {visit.idInfo.cA && (
                                    <Chip label="Access Control" size="small" color="success" />
                                )}
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>
            )}

            {/* ── Recording + PAR overview ─────────────────────────────── */}
            <Grid container spacing={2} sx={{mb:2}}>
                <Grid size={7}>
                    <AlertRecordingPlayer camId={visit.source} timestamp={new Date(visit.timestamp)} />
                </Grid>
                <Grid size={5}>
                    {aggregatedPar ? (
                        <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary" sx={{fontWeight:600}}>
                                PAR OVERVIEW ({parWithData} / {visits.length} detections)
                            </Typography>
                            <ParRepresentation par={aggregatedPar} />
                            <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
                                {[...new Set(visits.map(v => v.source))].map(src => (
                                    <Chip key={src} label={getCamName(src)} size="small" variant="outlined" />
                                ))}
                            </Stack>
                            {visits.length > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                    {new Date(visits[visits.length - 1].timestamp).toLocaleString()} → {new Date(visits[0].timestamp).toLocaleString()}
                                </Typography>
                            )}
                        </Stack>
                    ) : (
                        <Typography variant="caption" color="text.secondary">No PAR data for these detections.</Typography>
                    )}
                </Grid>
            </Grid>

            <Divider sx={{mb:2}} />

            {/* ── Action buttons ──────────────────────────────────────── */}
            <ButtonGroup sx={{mb:2}} variant="contained" aria-label="Actions">
                <Button color='primary' onClick={handleClick}>{`Optimize ${visits.length} items`}</Button>
                {selectedVisits.length > 0 && (
                    <Button color='error' onClick={handleDeleteClick}>{`Delete ${selectedVisits.length} items`}</Button>
                )}
                <Button color='success' onClick={handleIdClick}>
                    {visit.idInfo?.firstName ? <><EditIcon />{`${visit.idInfo.firstName} ${visit.idInfo.lastName}`}</> : 'Identify Person'}
                </Button>
            </ButtonGroup>

            {/* ── Face grid ───────────────────────────────────────────── */}
            <Stack id='faceItems' spacing={1} direction='row' sx={{flexWrap:'wrap', gap:1, justifyContent:'space-between'}}>
                {visits.slice(0, 100).map((v) => (
                    <Paper
                        elevation={selectedVisits.includes(v._id || '') ? 20 : 3}
                        sx={selectedVisits.includes(v._id || '')
                            ? {transform:'scale(.9)', p:0, maxWidth:80, cursor:'pointer', textAlign:'center'}
                            : {p:0, maxWidth:80, cursor:'pointer', textAlign:'center'}}
                        key={v._id}
                        onClick={() => {
                            if (v._id)
                                setSelectedVisits(prev =>
                                    prev.includes(v._id || '')
                                        ? prev.filter(item => item !== v._id)
                                        : [...prev, v._id || '']
                                )
                        }}
                    >
                        <Stack direction="column" spacing={0.5} sx={{width:'100%', textAlign:'center'}}>
                            <img src={`data:image/jpeg;base64,${v.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                            <ParBadge par={v.par} />
                        </Stack>
                    </Paper>
                ))}
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setSelectedItemDialog(null)}>Close</Button>
        </DialogActions>
    </Dialog>
)}

const PersonsDatabaseRenderer= () =>{
    useSubscribe('cams');
    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
    const [selectedTab, setSelectedTab] = useState<'all' | 'selected'>('all');
    const [message, setMessage] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>({});
    const [parFilterState, setParFilterState] = useState<ParFilterState>({
        gender: null, age: null, facing: null, upperType: null, lowerType: null,
        headColor: null, upperColor: null, lowerColor: null, extras: [],
    });
    const [parAnchor, setParAnchor] = useState<HTMLButtonElement | null>(null);

    const handleParFilterChange = (conditions: Record<string, any>, state: ParFilterState) => {
        setParFilterState(state);
        setFilter(prev => {
            const next: Filter = {};
            if (prev.source) next.source = prev.source;
            if (prev.timestamp) next.timestamp = prev.timestamp;
            Object.assign(next, conditions);
            return next;
        });
    };
    const [lastSelected, setLastSelected] = useState<number | null>(null);
    const [selectedItems , setSelectedItems] = useState<VisitSummary[]>([]);
    const limit=100;
    const [skip, setSkip]   = useState(0);
    const load = useSubscribe('visitssummary', filter, limit, skip);
    const visits = useFind(() => VisitsSummaryCollection.find(filter, { sort: { timestamp: -1 } })) || [];
    const [numPages, setNumPages] = useState(0);
    const [selectedItemDialog, setSelectedItemDialog] = useState<VisitSummary | null>(null);
    const setMessageFunc =(msg:string)=>{
        setMessage(msg);
    }
    useEffect(() => {
        (async()=>{
            try{
                const count = await Meteor.callAsync('countVisits', filter) as number;
                setNumPages(Math.ceil(count / 100));
            }catch (e) {
                console.error('Error counting visits:', e);
            }
        })()
    }, [filter])
    const Cams = useFind(() => CamsCollection.find({}, { sort: { name: 1 } }));
   
    const getCamName = (camId: string) => {
        const cam = Cams.find(c => c._id === camId);
        return cam ? cam.name : 'Unknown Camera';
    }

    const handleClick = (e:React.MouseEvent<HTMLDivElement, MouseEvent>, index:number, visit:VisitSummary) => {
        //check if target has Class badgePhotos
        if((e.target as HTMLElement).classList.contains('MuiBadge-badge')){
            setSelectedItemDialog(visit);
            return;
        }
        setLastSelected(index)
        if( e.shiftKey ){
            if (lastSelected !== null) {
                const start = Math.min(lastSelected, index);
                const end = Math.max(lastSelected, index);
                const newSelectedItems = visits.slice(start, end + 1).filter(v => !selectedItems.map(e => e._id).includes(v._id));
                setSelectedItems(prev => [...prev, ...newSelectedItems]);
            }else{
                if (selectedItems.map(e=>e._id).includes(visit._id)){
                    setSelectedItems(prev => {
                        if(prev.filter(item => item._id !== visit._id).length ===0){
                            setSelectedTab('all')
                        }
                        return prev.filter(item => item._id !== visit._id)
                    });
                }else{
                    setSelectedItems(prev => [...prev, visit]);
                }
            }
        }else{
            if (selectedItems.map(e=>e._id).includes(visit._id)){
                setSelectedItems(prev => {
                    if(prev.filter(item => item._id !== visit._id).length ===0){
                        setSelectedTab('all')
                    }
                    return prev.filter(item => item._id !== visit._id)
                });
            }else{
                setSelectedItems(prev => [...prev, visit]);
            }
        }
    }
    const deleteItems = ()=>{
        if (window.confirm('Are you sure you want to delete selected items?')) {
            selectedItems.forEach(item => {
                try{
                    Meteor.callAsync('removeVisit', item._id).catch(e => console.error('Error removing visit:', e));
                    setMessage('Items removed successfully');
                }catch(e:any){
                    console.error('Error deleting visit:', e);
                    setMessage('Error merging visits: ' + e.message as string);
                }
            });
            setSelectedItems([]);
            setSelectedTab('all');
            setAnchorEl(null);
        }
    }
    const mergeItems = () => {
        try{
            Meteor.callAsync('mergeVisits', selectedItems.map(item => item._id))
            setMessage('Items merged successfully');
        }catch(e: any){
            console.error('Error merging visits:', e);
            setMessage('Error merging visits: ' + e.message as string);
        }
        setSelectedItems([]);
        setSelectedTab('all');
        setAnchorEl(null);
        
    }
    const open = Boolean(anchorEl);
    return(
         <Paper sx={{minHeight:'100%',p:2,boxSizing:'border-box'}}>
            {load() && (
                <Box sx={{width:'100%' , mb:2}}>
                    <LinearProgress />
                </Box>
            )}
            <Stack  direction='row' spacing ={2} sx={{mb:2}}>
                <Autocomplete
                    disablePortal
                    options={Cams}
                    getOptionLabel={(option) => option.name}
                    onChange={(_event, newValue) => {
                        if (newValue) {
                            setFilter(prev => ({ ...prev, source: newValue._id }));
                        } else {
                            setFilter(prev => (delete prev.source, {...prev}));
                        }
                    }}
                    sx={{ width: '100%' }}
                    renderInput={(params) => <TextField {...params} label="Cam" />}
                />
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateTimePicker sx={{width:'100%'}} label="Time start" ampm={false} onChange={(val)=>{
                        if (val) {
                            setFilter(prev => ({ ...prev, timestamp: { ...prev.timestamp, $gte: val.toDate() } }));
                        } else {
                            setFilter(prev => (delete prev.timestamp, {...prev}));
                        }
                    }} />
                    <DateTimePicker sx={{width:'100%'}} label="Time end" ampm={false} onChange={(val)=>{
                        if (val) {
                            setFilter(prev => ({ ...prev, timestamp: { ...prev.timestamp, $lte: val.toDate() } }));
                        } else {
                            setFilter(prev => (delete prev.timestamp, {...prev}));
                        }
                    }} />
                </LocalizationProvider>
                <Tooltip title="PAR filter">
                    <Badge badgeContent={countActiveParFilters(parFilterState)} color="primary">
                        <IconButton onClick={(e) => setParAnchor(e.currentTarget)}>
                            <FilterListIcon />
                        </IconButton>
                    </Badge>
                </Tooltip>
                <Popover
                    open={Boolean(parAnchor)}
                    anchorEl={parAnchor}
                    onClose={() => setParAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <ParFilterBuilder initial={parFilterState} onChange={handleParFilterChange} />
                </Popover>
            </Stack>
            <Stack direction='row' spacing={2} sx={{mb:2}}>
                {selectedItems.length > 0 && (
                <Tabs
                    sx={{width:'100%'}}
                    value={selectedTab}
                    onChange={(_event, newValue) => {setSelectedTab(newValue)}}
                    textColor="secondary"
                    indicatorColor="secondary"
                    aria-label="secondary tabs example"
                    >
                    <Tab value="all" label="All" />
                    <Tab value="selected" label={`Selected ${selectedItems.length}`} />
                </Tabs>
                )}
                <Pagination
                    sx={{width:'100%'}}
                    count={numPages}
                    color="secondary"
                    page={(skip+limit)/limit}
                    onChange={(_e, v)=>{
                        setSkip((v-1)*limit);
                    }}
                />
            </Stack>
            
            <Stack  id='faceItems' spacing={1} direction='row' sx={{flexWrap:'wrap', gap:1, justifyContent:'space-between'}}>
              {selectedTab === 'all' ? visits.map((visit, index) => (
                <Paper elevation={selectedItems.map(e=>e._id).includes(visit._id)?20:3} sx={selectedItems.map(e=>e._id).includes(visit._id)?{transform:'scale(.9)',p: 0, maxWidth: 80, textAlign: 'center', cursor:'pointer'}:{ p: 0, maxWidth: 80,cursor:'pointer', textAlign: 'center'}} key={visit._id} >
                    <Stack direction="column" spacing={1} sx={{width: '100%', textAlign: 'center' }} onClick={(e) => {handleClick(e, index, visit)}}>
                        <Badge  badgeContent={visit.faces || 0} color={visit.idInfo?"secondary":"primary"} max={9999} >
                            <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                        </Badge>
                        <Typography sx={{overflow:'hidden', display:'-webkit-box', lineClamp:2, WebkitLineClamp:2,wordBreak:'break-all'}} variant="caption">{getCamName(visit.source)}</Typography>
                        <Typography sx={{mt:0}} variant="body2">{visit.timestamp.toLocaleString()}</Typography>
                    </Stack>
                </Paper>
                ))
            : selectedItems.map((visit, index) => (
                <Paper elevation={20} sx={{ p: 0, maxWidth: 80, textAlign: 'center', cursor:'pointer'}} key={visit._id} >
                    <Stack direction="column" spacing={1} sx={{width: '100%', textAlign: 'center' }} onClick={(e) => {handleClick(e, index, visit)}}>
                        <Badge badgeContent={visit.faces || 0} color="primary" max={9999}>
                            <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                        </Badge>
                        <Typography sx={{overflow:'hidden', display:'-webkit-box', lineClamp:2, WebkitLineClamp:2,wordBreak:'break-all'}} variant="caption">{getCamName(visit.source)}</Typography>
                        <Typography sx={{mt:0}} variant="body2">{visit.timestamp.toLocaleString()}</Typography>
                    </Stack>
                </Paper>
            ))
            }
            </Stack>
            {selectedItems.length > 0 && (
                <>
                <Zoom
                    in={true}
                    timeout={0.5}
                    unmountOnExit
                >
                    <Fab 
                        sx={{position:'absolute', bottom:'12px', right:'16px'}}
                        size="small"
                        color="secondary"
                        aria-label="More"
                        onClick={(e)=>{
                            setAnchorEl(e.currentTarget as HTMLButtonElement)
                        }}
                    >
                        <MoreVertIcon />
                    </Fab>
                </Zoom>
                <Popover
                    id={'more-menu'}
                    open={open}
                    anchorEl={anchorEl}
                    onClose={()=>setAnchorEl(null)}
                    anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                    }}
                >
                    <MenuList>
                        <MenuItem onClick={()=>{mergeItems()}}>
                        <ListItemIcon>
                            <AddLinkIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Merge Selected</ListItemText>
                        </MenuItem>
                     <MenuItem onClick={deleteItems}>
                        <ListItemIcon>
                            <DeleteSweepOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Delete Selected</ListItemText>
                        </MenuItem>
                    </MenuList>
                </Popover>
                </>
            )}
            {selectedItemDialog && (
                <ItemDetailedRender setSelectedItemDialog={setSelectedItemDialog} setMessage={setMessageFunc} cams={Cams} visit={selectedItemDialog} onClose={() => setSelectedItemDialog(null)} /> 
            )}
            <Snackbar
                open={Boolean(message)}
                autoHideDuration={6000}
                onClose={()=>setMessage(null)}
                message={message}
            />
        </Paper>
    )
}
const PersonsDatabaseApp: AppType = {
    appName: 'Persons Database',
    appIcon: <Icon />,
    render: PersonsDatabaseRenderer
};

export default PersonsDatabaseApp;
