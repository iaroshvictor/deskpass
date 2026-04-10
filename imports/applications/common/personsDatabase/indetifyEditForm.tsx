import React from 'react';
import {useState, useEffect, useImperativeHandle, forwardRef} from 'react';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { VisitsCollection } from '/imports/api/visits';
import { VisitsSummaryCollection, IdInfo } from '/imports/api/visitSummary';
import { GatesCollection, Gate } from '/imports/api/gates';
import { ZonesCollection, Zone } from '/imports/api/zones';
import { DivisionsCollection, Division } from '/imports/api/divisions';
import { AlertLists, AlertList } from '/imports/api/alertLists';
import { SettingsCollection, APIConfig} from '/imports/api/settings'
import{
    Box,
    Grid,
    Avatar,
    TextField,
    Stack,
    Divider,
    Card,
    Paper,
    Slider,
    FormControl,
    FormControlLabel,
    FormGroup,
    Switch,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Popover,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Radio,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    TableContainer,
    Table,
    TableRow,
    TableCell,
    TableBody,
    ButtonGroup,
    Autocomplete,
    Checkbox

} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StarPurple500Icon from '@mui/icons-material/StarPurple500';
import DeleteIcon from '@mui/icons-material/Delete';

type params ={
    tracking_id: string;
    visits: string[];
}
type divissionItemProps={
    selectedDivissionId:string | null,
    setSelectedDivissionId:(zoneId:string | null)=>void,
    divission:Division,
    divissions:Division[]
}
const DivissionItemSelector = (props:divissionItemProps)=>{
    const {selectedDivissionId, setSelectedDivissionId, divission, divissions} = props;
    return (
        <>
        <ListItem
            disableGutters
            key={divission._id}
            sx={{p:0, }}
            
          >
            <ListItemButton  role={undefined} onClick={()=>{setSelectedDivissionId(divission._id||'')}} dense>
              <ListItemIcon>
                <Radio
                    sx={{p:0}}
                    checked={selectedDivissionId === divission._id}
                    onChange={setSelectedDivissionId.bind(null, divission._id||'')}
                    value="b"
                    name="zone"
                />
              </ListItemIcon>
              <ListItemText id={divission._id} primary={divission.name} />
            </ListItemButton>
          </ListItem>
       
        {divissions.filter(z=>z.parent === divission._id).length > 0 && (
            <List dense sx={{borderTop:'1px solid #8080801f', borderBottom:'1px solid #8080801f', ml:3, borderLeft:'1px solid #cfcfcf'}}>
            {divissions.filter(z=>z.parent === divission._id).map((childZone)=>(
                <DivissionItemSelector
                    key={childZone._id}
                    divission={childZone}
                    selectedDivissionId={selectedDivissionId}
                    setSelectedDivissionId={setSelectedDivissionId}
                    divissions={divissions}
                />
            ))}
            </List>
        )}
        </>
    );
}
type ZoneItemProps = {
    allowedGates: string[];
    setAllowedGates: (param: string[]) => void;
    zone: Zone;
    Gates: Gate[];
    Zones: Zone[];
    action: 'add' | 'remove';
};
const ZoneItem = ({allowedGates, setAllowedGates, zone, Gates, Zones, action}:ZoneItemProps)=>{
    const handleAction = (id:string)=>{
        setAllowedGates(action === 'add'?[...allowedGates, id]: allowedGates.filter(gateId => gateId !== id));
    }
    const handleBulkAction = (id?:string) =>{
        if(id){
            //find recursively all zones under this zone 
            function getAllZoneDescendants(zones: Zone[], parentId: string): Zone[] {
                const directChildren = zones.filter(z => z.parent === parentId);
                return directChildren.flatMap(child => [
                    child,
                    ...getAllZoneDescendants(zones, child._id || '')
                ]);
            }
            const allZones = [id, ...getAllZoneDescendants(Zones, id).map(z => z._id || '')]
            setAllowedGates(action === 'add' 
                ? [...allowedGates,
                    ...Gates.filter(gate => allZones.includes(gate.zone)).map(gate => gate._id || '')]
                : allowedGates.filter(gateId => !allZones.includes(Gates.find(g => g._id === gateId)?.zone || '')));
        }
    }
    const myGates =  (zone:Zone)=>{
      return Gates.filter(gate => {return gate.zone === zone._id && (action == 'add' ? !allowedGates.includes(gate._id||'') : allowedGates.includes(gate._id||''))})  
    }
    return(
        <>
        <Accordion sx={{boxShadow: '0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)', mb: 1}}  key={zone._id}>
            <Stack direction='row'>
                {action === 'add' 
                ? (<>
                    <AccordionSummary   expandIcon={<ExpandMoreIcon />} sx={{backgroundColor:'#f5f5f5'}}>
                        {`${zone.name} (${Gates.filter(gate => gate.zone === zone._id).length})`} 
                    </AccordionSummary>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={()=>handleBulkAction(zone._id)}
                        aria-label="move all right"
                    >
                        ≫
                    </Button>
                </>)
                :(<>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={()=>handleBulkAction(zone._id)}
                        aria-label="move all right"
                    >
                        {`<<`}
                    </Button>
                    <AccordionSummary   expandIcon={<ExpandMoreIcon />} sx={{backgroundColor:'#f5f5f5'}}>
                        {`${zone.name} (${myGates(zone).length})`} 
                    </AccordionSummary>
                </>)}
            
            </Stack>
            <AccordionDetails sx={{pr:0}}>
                {myGates(zone).length>0 &&(
                    <TableContainer>
                        <Table>
                            <TableBody>
                                {myGates(zone).map(myGate=>{
                                    return (
                                        <TableRow key={myGate._id}>
                                            {action === 'add' ?(
                                                <>
                                                <TableCell>
                                                    {myGate.name}
                                                </TableCell>
                                                <TableCell>
                                                        <Button
                                                        sx={{ my: 0.5 }}
                                                        variant="outlined"
                                                        size="small"
                                                        onClick={()=>handleAction(myGate._id || '')}
                                                        aria-label="Grant Access"
                                                    >
                                                        &gt;
                                                    </Button>
                                                </TableCell>
                                                </>
                                            ):(
                                                <>
                                                <TableCell>
                                                        <Button
                                                        sx={{ my: 0.5 }}
                                                        variant="outlined"
                                                        size="small"
                                                        onClick={()=>handleAction(myGate._id || '')}
                                                        aria-label="Deny Access"
                                                    >
                                                        &lt;
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    {myGate.name}
                                                </TableCell>
                                                
                                                </>
                                            )}
                                            
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                {Zones.filter(z => z.parent === zone._id).length > 0 && (
                    Zones.filter(z => z.parent === zone._id).map((subZone) => (
                        <ZoneItem allowedGates={allowedGates} setAllowedGates={setAllowedGates} action={action} key={subZone._id} zone={subZone} Gates={Gates} Zones={Zones} />
                    ))
                )}
            </AccordionDetails>
        </Accordion>
    </>
    )
}

const IdentifyEdit = forwardRef(({tracking_id, visits}:params, ref) => {
    useSubscribe('settings');
    const apacsSettings = useFind(()=>SettingsCollection.find({type:"apacs"}))
    useSubscribe('visits', {tracking_id}, 10000);
    useSubscribe('visitSummary', {_id:tracking_id});
    useSubscribe('divisions');
    useSubscribe('zones');
    useSubscribe('alertLists');
    useSubscribe('gates');
    const [showApacs, setShowApacs] = useState<boolean>(false)
    useEffect(()=>{
        if(apacsSettings.length > 0 ){
            const config = apacsSettings[0].config as APIConfig;
            if(config.url && config.username && config.password){
                setShowApacs(true)  
            }
        }
    },[apacsSettings])
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const Divissions = useFind(()=> DivisionsCollection.find({}));
    const AlertListsItems = useFind(() => AlertLists.find({}));
    const Person = useFind(() => VisitsSummaryCollection.find({_id: tracking_id}));
    const [idInfo, setIdInfo] = useState<IdInfo>({
        firstName: '',
        lastName:'',
        comment: '',
        alertList: '',
        alertpause: 5,
        alertThreshold: 80,
        cA: false,
        divission: '',
        accessCard: [],
        allowedGates: [],
        syncId: undefined,
        bypassFace: false
    });
    useEffect(() => {
        if (Person.length > 0) {
            if(Person[0].idInfo){
                setIdInfo(Person[0].idInfo);
            }
        }
    },[Person]);
    const Visits = useFind(() =>visits.length ? VisitsCollection.find({_id:{$in:visits}}) : VisitsCollection.find({reference:true, tracking_id:tracking_id}, {sort: {timestamp: -1}}), [visits, tracking_id]);
    const Gates  = useFind (() => GatesCollection.find({}));
    const Zones = useFind(() => ZonesCollection.find({}));
    const [avatarAnchorEl, setAvatarAnchorEl] = useState<null | HTMLElement>(null);
    const save = ()=>{
        try{
            // Set reference models
            Meteor.callAsync('setRefereceModels', visits);
            Meteor.callAsync('editVisitSummary', tracking_id, {idInfo});
        }
        catch(e){
            console.error('Error saving visit summary:', e);
            return false;
        }
        //do some server side stuff
        return true
    };
    const deleteSummary = ()=>{
        try{
            if (window.confirm('Are you sure you want to delete selected person?')) {
                Meteor.callAsync('removeVisit', tracking_id);
            }
        }catch(e){
            console.error('Error saving visit summary:', e);
            return false;
        }
        //do some server side stuff
        return true
    }
    useImperativeHandle(ref, () => ({
        save,
        deleteSummary
    }));
    const [hovItem, setHovItem] = useState<string | null>(null);
  return (
    <>
      {Person.length > 0 ? (
        <Box>
            <Grid container spacing={2}>
                <Grid size={4}>
                    <Avatar
                        alt="Person Image"
                        sx={{ width: 150, height: 150, cursor:'pointer' }}
                        src={`data:image/jpeg;base64,${Person[0].face_b64}`}
                        onClick={(event) => {
                            setAvatarAnchorEl(event.currentTarget);
                        }}
                    />
                    <Popover
                        open={Boolean(avatarAnchorEl)}
                        anchorEl={avatarAnchorEl}
                        onClose={() => {setAvatarAnchorEl(null)}
                        }
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                    > 
                    <Paper sx={{maxWidth:650, maxHeight: 400}} elevation={7}>
                        <Grid container spacing={1}>
                            {Visits.map((visit) => (
                                <Grid
                                    sx={{position:'relative', boxSizing:'border-box'}}
                                    size={2}
                                    key={visit._id||''}
                                    onMouseEnter={() => setHovItem(visit._id || '')}
                                    onMouseLeave={() => setHovItem(null)}
                                >
                                {hovItem === visit._id && (
                                    
                                    <Box sx={{ position: 'absolute', top: 0, left: 0, width:'100px', overflow:'hidden', right: 0, bottom: 0, bgcolor: 'rgba(255, 255, 255, 0.8)', zIndex: 1 }}>
                                        <ButtonGroup>
                                            <Button color='secondary' variant='contained' onClick={() =>{
                                                Meteor.call('setSummaryPhoto', Person[0]._id, visit.face_b64)
                                                setAvatarAnchorEl(null);
                                            }}><StarPurple500Icon /></Button>
                                            <Button color='error' variant='contained' onClick={()=>{
                                                Meteor.call('removeVisitItems', [visit._id]);
                                                // setAvatarAnchorEl(null);
                                            }}><DeleteIcon /> </Button>
                                        </ButtonGroup>
                                    </Box>
                                )}
                                
                                <Avatar
                                    alt="Person Image"
                                    sx={{ 
                                        width: 100,
                                        height: 100,
                                        borderRadius:1,
                                        boxShadow: '0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)',
                                        cursor: 'pointer',
                                    }}
                                    
                                    src={`data:image/jpeg;base64,${visit.face_b64}`}
                                />
                                </Grid>
                            ))}
                            
                        </Grid>
                    </Paper>
                    </Popover>
                </Grid>
                <Grid size={4}>
                    <Stack spacing={2}>
                        <TextField
                            label="First Name"
                            variant="standard"
                            fullWidth
                            value={idInfo.firstName}
                            onChange={(e) => {setIdInfo({...idInfo, firstName: e.target.value})}}
                        />
                        <TextField
                            label="Last Name"
                            variant="standard"
                            fullWidth
                            value={idInfo.lastName}
                            onChange={(e) => {setIdInfo({...idInfo, lastName: e.target.value})}}
                        />
                    </Stack>
                </Grid>
                <Grid size={4}>
                    <TextField
                        label="Additional Information"
                        variant="standard"
                        fullWidth
                        multiline
                        minRows={4}
                        value={idInfo.comment}
                        onChange={(e) => {setIdInfo({...idInfo, comment: e.target.value})}}
                    />
                </Grid>
            </Grid>
            <Divider sx={{p:1}} />
            <Paper elevation={3} sx={{mt:1}}>
            <Stack direction='row' spacing={2}>
                <FormControl fullWidth>
                    <InputLabel id="demo-simple-select-label">Alert List</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={idInfo.alertList}
                        label="Alert List"
                        onChange={(e)=>{setIdInfo({...idInfo, alertList: e.target.value as string})}}
                    >
                        <MenuItem value=''>None</MenuItem>
                        {AlertListsItems.map((list:AlertList) => (
                            <MenuItem key={list._id} value={list._id}>
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Avatar sx={{width:20, height:20, backgroundColor:list.color, mr:1}} />
                                    <Typography variant='body1'>{list.name}</Typography>
                                </Stack>
                            </MenuItem>
                        ))}
                        
                    </Select>
                </FormControl>
                {idInfo.alertList !== '' &&(
                    <>
                    <FormControl fullWidth>
                        <InputLabel id="demo-simple-select-label">Identification threshold</InputLabel>
                        <Slider
                            aria-label="Always visible"
                            defaultValue={idInfo.alertThreshold}
                            getAriaValueText={(value:number) => `${value}%`}
                            step={1}
                            min={60}
                            max={100}
                            onChange={(_e, value) => {
                                setIdInfo({...idInfo, alertThreshold: value as number});
                            }}
                            valueLabelDisplay="on"
                        />

                    </FormControl>
                    <TextField
                        label ='Alerts Pause'
                        variant="standard"
                        type='number'
                        fullWidth
                        value={idInfo.alertpause}
                        onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value)) {
                                setIdInfo({...idInfo, alertpause: value});
                            }
                        }}
                        helperText='Pase in minutes between alerts'
                    />
                </>
                )}
            </Stack>
            </Paper>
            <Divider sx={{p:1}} />
            <Paper elevation={3} sx={{mt:1}}>
                <FormGroup sx={{pl:2}}>
                    <FormControlLabel control={<Switch checked={idInfo.cA} onChange={(_e, v)=>{setIdInfo(prev=>({...prev, cA:v}))}} />} label="Access Control Member" />
                </FormGroup>
                {idInfo.cA && (
                <>
                    <Stack direction='row' spacing={2} sx={{p:2}}>
                        <Button 
                            sx={{width:'100%'}}
                            variant="outlined"
                            color="secondary"
                            onClick={(event)=>{
                                setAnchorEl(event.currentTarget)
                            }}
                        >
                            {idInfo.divission !== ''? `Selected Divission: ${Divissions.find(z=>z._id===idInfo.divission)?.name}` : 'Select Divission'}
                            <ArrowDropDownIcon />
                        </Button>
                        <Popover
                            open={Boolean(anchorEl)}
                            anchorEl={anchorEl}
                            onClose={()=>{setAnchorEl(null)}}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'left',
                            }}
                            >
                                <List dense sx={{borderLeft: '1px solid #cfcfcf'}}>
                                {Divissions.filter(zone=>zone.parent === 'root').map((divission)=>(
                                    <DivissionItemSelector
                                        divission={divission}
                                        selectedDivissionId={idInfo.divission}
                                        setSelectedDivissionId={(id:string | null)=>{setIdInfo(prev=>({...prev, divission:id ||''})); setAnchorEl(null)}}
                                        key={divission._id}
                                        divissions={Divissions}
                                    />
                            ))}
                            </List>
                        </Popover>
                        <Autocomplete
                            multiple
                            freeSolo
                            options={[]}
                            value={idInfo.accessCard}
                            onChange={(_event, value) => {
                                setIdInfo({...idInfo, accessCard: value});
                            }}
                            slotProps={{
                                paper: {
                                    sx: { maxHeight: '200px', width:'100%' }
                                }
                            }}
                            sx={{width:'100%'}}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Access Control Card Numbers"
                                    variant="standard"
                                    fullWidth
                                    placeholder="Add card number"
                                />
                            )}
                        />
                        {showApacs && (
                            <>
                            <TextField
                                label="APACS Cardholder ID"
                                variant="standard"
                                fullWidth
                                value={idInfo.syncId}
                                onChange={(event)=>{setIdInfo({...idInfo, syncId: event.target.value})}}
                            />
                            <FormControlLabel sx={{width:'100%'}} control={<Checkbox checked={idInfo.bypassFace} onChange={(_e, v)=>{setIdInfo(prev=>({...prev, bypassFace:v}))}} />} label="Bypass Face Recognition" />
                            </>
                        )}
                    </Stack>
                    <Stack direction={'row'} spacing={2}>
                        <Card sx={{width:'100%'}}>
                             <Accordion defaultExpanded sx={{boxShadow: '0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)', mb: 1}}>
                                <Stack direction='row'>
                                        <AccordionSummary   expandIcon={<ExpandMoreIcon />} sx={{backgroundColor:'#f5f5f5'}}>
                                            Denied gates 
                                        </AccordionSummary>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            sx={{minWidth: '120px'}}
                                            onClick={()=>{setIdInfo(prev=>({...prev, allowedGates:Gates.map(g=>g._id||'')}))}}
                                            aria-label="Allow All"
                                        >
                                           Allow All ≫
                                        </Button>
                                </Stack>
                                <AccordionDetails>
                                    {Zones.filter(z=>z.parent === 'root').map((zone) => (
                                        <ZoneItem
                                            allowedGates={idInfo.allowedGates}
                                            setAllowedGates={
                                                (param:string[])=>{
                                                    setIdInfo(prev=>({...prev, allowedGates:param}));
                                                }
                                            }
                                            action='add'
                                            key={zone._id}
                                            zone={zone}
                                            Gates={Gates}
                                            Zones={Zones}
                                        />
                                    ))}
                                </AccordionDetails>
                            </Accordion>
                        </Card>
                        <Card sx={{width:'100%'}}>
                            <Accordion defaultExpanded sx={{boxShadow: '0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)', mb: 1}}>
                                <Stack direction='row'>
                                    <Button
                                            sx={{minWidth: '120px'}}
                                            variant="outlined"
                                            size="small"
                                            onClick={()=>{setIdInfo(prev=>({...prev, allowedGates:[]}))}}
                                            aria-label="Deny all"
                                    >
                                        {`≪ Deny All`}
                                    </Button>
                                    <AccordionSummary   expandIcon={<ExpandMoreIcon />} sx={{backgroundColor:'#f5f5f5'}}>
                                        Allowed gates 
                                    </AccordionSummary>
                                </Stack>
                                <AccordionDetails>
                                {Zones.filter(z=>z.parent === 'root').map((zone) => (
                                    <ZoneItem
                                        allowedGates={idInfo.allowedGates}
                                        setAllowedGates={
                                            (param:string[])=>{
                                                setIdInfo(prev=>({...prev, allowedGates:param}));
                                            }
                                        }
                                        action='remove'
                                        key={zone._id}
                                        zone={zone}
                                        Gates={Gates}
                                        Zones={Zones}
                                    />
                                ))}
                                </AccordionDetails>
                            </Accordion>
                        </Card>
                    </Stack>
                </>
                )}
            </Paper>
        </Box>
      ) : null}
    </>
  );
})

export default IdentifyEdit;