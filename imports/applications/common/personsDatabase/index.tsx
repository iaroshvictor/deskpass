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
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { VisitSummary, VisitsSummaryCollection } from '/imports/api/visitSummary';
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
import { VisitsCollection } from '/imports/api/visits';
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
}

const ItemDetailedRender = ({visit, cams, setMessage, setSelectedItemDialog}:{visit:VisitSummary, onClose:()=>void, cams:Cam[], setMessage:(messgae:string)=>void, setSelectedItemDialog:(param :VisitSummary | null)=>void}) => {
    const [idForm, setIdForm] = useState<boolean>(false)
    useSubscribe('visits', {tracking_id: visit._id}, 0, 0, {timestamp:-1});
    const visits = VisitsCollection.find({tracking_id: visit._id}, {sort: {timestamp: -1}}).fetch();
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
        <DialogTitle>{"Photos"}</DialogTitle>
        <DialogContent>
            <ButtonGroup sx={{mb:2}} variant="contained" aria-label="Actions">
                <Button color='primary' onClick={handleClick}>{`Optimize ${visits.length} items`}</Button>
                {selectedVisits.length > 0 && (
                    <Button color='error' onClick={handleDeleteClick}>{`Delete ${selectedVisits.length} items`}</Button>
                )}
                <Button color='success' onClick={handleIdClick}>{visit.idInfo?.firstName? <><EditIcon />{`${visit.idInfo.firstName} ${visit.idInfo.lastName}`}</>  :"Identify Person"}</Button>
            </ButtonGroup>
            <Stack  id='faceItems' spacing={1} direction='row' sx={{flexWrap:'wrap', gap:1, justifyContent:'space-between'}}>
                {visits.slice(0, 100).map((visit) => (
                    <Paper
                        elevation={selectedVisits.includes(visit._id ||'')?20:3}
                        sx={selectedVisits.includes(visit._id ||'')?{transform:'scale(.9)', p: 0, maxWidth: 80,cursor:'pointer', textAlign: 'center'}:{ p: 0, maxWidth: 80,cursor:'pointer', textAlign: 'center'}}
                        key={visit._id}
                        onClick={()=>{
                            if(visit._id)
                            setSelectedVisits(prev=>(
                                prev.includes(visit._id || '')
                                    ?prev.filter(item=> item!== visit._id)
                                    :[...prev, visit._id || '']
                                )
                            )
                        }}
                    >
                        <Stack direction="column" spacing={1} sx={{width: '100%', textAlign: 'center' }} >
                                <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                            <Typography sx={{overflow:'hidden', display:'-webkit-box', lineClamp:2, WebkitLineClamp:2,wordBreak:'break-all'}} variant="caption">{getCamName(visit.source)}</Typography>
                            <Typography sx={{mt:0}} variant="body2">{visit.timestamp.toLocaleString()}</Typography>
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
    const [filter, setFilter] =useState<Filter>({timestamp:{$gte:new Date()}})
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
