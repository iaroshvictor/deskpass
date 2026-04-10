import * as React from 'react';
import { AppProps, AppType } from "../..";
import { Meteor } from 'meteor/meteor';
import Icon from './icon'
import { useState } from 'react';
import {
    Paper,
    Box,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Button,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    Popover,
    MenuList,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Snackbar,
    Slide,
    Alert,
    Divider,
    TextField,
    ButtonGroup,
    Stepper,
    Step,
    StepLabel,
    Stack,
    List,
    ListItem,
    ListItemButton,
    Radio,
    Card,
    CardContent,
    CardMedia,
    FormControlLabel,
    FormControl,
    Select,
    Switch,
    Autocomplete,
    InputLabel,
    SxProps,
    Theme,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import {Gate, GatesCollection, Interface} from '/imports/api/gates';
import { ZonesCollection, Zone } from '/imports/api/zones';
import { TransitionProps } from '@mui/material/transitions';
import { CamsCollection, Cam } from '/imports/api/cams';
import { ControllersCollection, Controller } from '/imports/api/controllers';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});
type zoneItemProps={
    selectedZoneId:string | null,
    setSelectedZoneId:(zoneId:string | null)=>void,
    zone:Zone,
    zones:Zone[]
}
const ZoneItemSelector = (props:zoneItemProps)=>{
    const {selectedZoneId, setSelectedZoneId, zone, zones} = props;
    return (
        <>
        <ListItem
            disableGutters
            key={zone._id}
            sx={{p:0, }}
            
          >
            <ListItemButton  role={undefined} onClick={()=>{setSelectedZoneId(zone._id||'')}} dense>
              <ListItemIcon>
                <Radio
                    sx={{p:0}}
                    checked={selectedZoneId === zone._id}
                    onChange={setSelectedZoneId.bind(null, zone._id||'')}
                    value="b"
                    name="zone"
                />
              </ListItemIcon>
              <ListItemText id={zone._id} primary={zone.name} />
            </ListItemButton>
          </ListItem>
       
        {zones.filter(z=>z.parent === zone._id).length > 0 && (
            <List dense sx={{borderTop:'1px solid #8080801f', borderBottom:'1px solid #8080801f', ml:3, borderLeft:'1px solid #cfcfcf'}}>
            {zones.filter(z=>z.parent === zone._id).map((childZone)=>(
                <ZoneItemSelector
                    key={childZone._id}
                    zone={childZone}
                    selectedZoneId={selectedZoneId}
                    setSelectedZoneId={setSelectedZoneId}
                    zones={zones}
                />
            ))}
            </List>
        )}
        </>
    );
}
export const CamImage = ({streamurl, sx}:{streamurl:string, sx?:SxProps<Theme>})=>{
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<boolean>(false);
    React.useEffect(() => {
        if (streamurl) {
            (async() => {
                try{
                    const poster = await Meteor.callAsync('validateRtspLink', streamurl)
                    setImageSrc(`data:image/jpeg;base64,${poster}`);
                } catch(error: any) {
                    console.error('Error validating RTSP link:', error);
                    setImageSrc(null);
                }
                setLoaded(true);
            })();
        }
    }, [streamurl]);

    return loaded ? (
            <CardMedia 
                component="img"
                image={imageSrc || '/images/no-image.png'}
                alt="Cam Stream"
                sx={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 1, ...sx }}
            />
        ):(
            <Box sx={{width:'100%' , height: 150, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: 1, ...sx}}>
                <CircularProgress />
            </Box>
        )}

const GateAddEdit = ({gate,Zones, Cams, Controllers, setErrorMessage, resetEditting}:{gate?:Gate, Zones:Zone[], Cams:Cam[], Controllers:Controller[],resetEditting:()=>void, setErrorMessage:(message:string)=>void})=>{
    const [myGate, setMyGate] = useState<Gate>(gate? {...gate} : {name:'', zone:'', interfaces:[]});
    const [expanded, setExpanded] = useState(false);
    React.useEffect(() => {
        if (gate) {
            setMyGate({...gate});
            setExpanded(true)
        } else {
            setMyGate({name:'', zone:'', interfaces:[]});
        }
    }, [gate]);
    
    const [step, setStep] = useState(0);
    const steps = ['General Settings', 'Interfaces', 'Review & Save'];
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const handleClose = () => {
            setAnchorEl(null);
        };
    const open = Boolean(anchorEl);
    const id = open ? 'simple-popover' : undefined;
    const [newIf, setNewIf] = useState<Interface | null>(null);
    return (
    <Accordion expanded={expanded} onChange={(_e, v)=>setExpanded(v)} sx={{boxShadow: '0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)', mb: 1}}  >
        <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1-content"
            id="panel1-header"
        >
            <Typography variant="subtitle2">{gate?`Edit gate ${gate.name}`:'Add New Gate'}</Typography>
        </AccordionSummary>
        <AccordionDetails>
            <Stepper activeStep={step} alternativeLabel>
                {steps.map((label) => (
                <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                </Step>
                ))}
            </Stepper>
            <Divider/>
            {step === 0 && (
                <Stack spacing={2} sx={{mt:2}}>
                    <Divider/>
                    <Box>
                        <TextField fullWidth value={myGate.name} onChange={(e)=>{setMyGate(prev=>({...prev, name:e.target.value}))}} id="standard-basic" label="Gate Name" variant="standard" color='secondary' />
                    </Box>
                    <Box>
                        <TextField fullWidth value={myGate.apacsId || ''} onChange={(e)=>{setMyGate(prev=>({...prev, apacsId:e.target.value}))}} id="apacs-id" label="APACS Reader ID" variant="standard" color='secondary' helperText="Required for remote unlock functionality" />
                    </Box>
                    <Button
                        sx={{width:'100%'}}
                        variant="outlined"
                        color="secondary"
                        onClick={(event)=>{
                            setAnchorEl(event.currentTarget)
                        }}
                    >
                        {myGate.zone? `Selected Zone: ${Zones.find(z=>z._id===myGate.zone)?.name}` : 'Select Zone'}
                        <ArrowDropDownIcon />
                    </Button>
                    <Popover
                        id={id}
                        open={open}
                        anchorEl={anchorEl}
                        onClose={handleClose}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        >
                            <List dense sx={{borderLeft: '1px solid #cfcfcf'}}>
                            {Zones.filter(zone=>zone.parent === 'root').map((zone)=>(
                                <ZoneItemSelector
                                    zone={zone}
                                    selectedZoneId={myGate.zone}
                                    setSelectedZoneId={(id:string | null)=>{if(id){setMyGate(prev=>({...prev, zone:id}));handleClose()}}}
                                    key={zone._id}
                                    zones={Zones}
                                />
                        ))}
                        </List>
                    </Popover>
                    <Stack direction='row' spacing={2} sx={{mt:2, flexDirection:'row-reverse'}}>
                       <ButtonGroup>
                            <Button disabled={myGate.name === '' || myGate.zone===''} variant="contained" onClick={() => setStep(1)}>Next</Button>
                            <Button variant="outlined" onClick={()=>{setExpanded(false);setMyGate({name:'', zone:'', interfaces:[]})}}>Cancel</Button>
                        </ButtonGroup>
                    </Stack>
                </Stack>
            )}
            {step === 1 && (
                <>
                    <Stack spacing={2} sx={{mt:2}}>
                        {newIf !== null ?(
                            <Stack direction='row' spacing={2} sx={{flexWrap:'wrap'}}>
                                {Cams.filter(cam=> cam.zone === myGate.zone).map(cam=>(
                                    <React.Fragment key={cam._id}>
                                    {(newIf.cam === '' || newIf.cam === cam._id) &&(
                                        <Card 
                                            onClick={()=>{
                                                if(newIf?.cam === '')
                                                    setNewIf(prev=>({...prev, cam:cam._id} as Interface))
                                            }}
                                            key={cam._id}
                                            raised
                                            sx={{width:'25%', cursor:'pointer', position:'relative'}}
                                        >
                                            <Typography sx={{pl:1, width:'100%', position:'absolute', background:'rgba(255, 255, 255, 0.6)'}} variant="subtitle2">{cam.name}</Typography>
                                            <CamImage streamurl={cam.streamurl} />
                                            {newIf.cam === cam._id && (
                                                <Box sx={{p:1}}>
                                                <FormControl fullWidth>
                                                <InputLabel id="demo-simple-select-label">Action</InputLabel>
                                                <Select
                                                    labelId="demo-simple-select-label"
                                                    id="demo-simple-select"
                                                    value={newIf.action || 'entrance'}
                                                    label="Action"
                                                    onChange={(e) => {
                                                        setNewIf(prev => {
                                                            if (!prev) return prev;
                                                            return {
                                                                ...prev,
                                                                action: e.target.value as 'entrance' | 'exit',
                                                            };
                                                        });
                                                    }}
                                                >
                                                    <MenuItem value={'entrance'}>Entrance</MenuItem>
                                                    <MenuItem value={'exit'}>Exit</MenuItem>
                                                </Select>
                                                </FormControl>
                                                <Stack direction='row' spacing={2} sx={{mt:1}}>
                                                    <Button size='small' color='secondary' variant='contained' sx={{width:'100%'}} onClick={()=>{
                                                        setMyGate(prev=>({...prev, interfaces: [...prev.interfaces, newIf as Interface]}));
                                                        setNewIf(null);
                                                        
                                                    }}>Add Interface</Button>
                                                    <Button size='small' color='primary' variant='contained' sx={{width:'100%'}} onClick={()=>{
                                                        setNewIf(null);
                                                    }}>Cancel</Button>
                                                </Stack>
                                                </Box>
                                            )}
                                            
                                        </Card>
                                    )}
                                    </React.Fragment>
                                ))}
                                {newIf.cam !== '' &&(
                                    <Stack direction='row' spacing={2} sx={{width:'calc(75% - 16px)'}}>
                                        <Card raised sx={{width:'100%', p:1, boxSizing:'border-box'}}>
                                            <FormControlLabel sx={{width:'100%'}} control={
                                                <Switch
                                                    checked = {(newIf.cmpsaction || []).includes('unlock')}
                                                    onChange={(_e, v)=>{
                                                        setNewIf(prev => {
                                                            if (!prev) return prev;
                                                            return {
                                                                ...prev,
                                                                cmpsaction: v
                                                                    ? [...prev.cmpsaction, 'unlock']
                                                                    : prev.cmpsaction.filter(action => action !== 'unlock')
                                                            };
                                                        })
                                                    }}
                                                />}
                                                label="Unlock gate" 
                                            />
                                            {(newIf.cmpsaction || []).includes('unlock') && (
                                                <>
                                                    <Autocomplete
                                                        options={Controllers}
                                                        getOptionLabel={(option) => option.name}
                                                        sx={{ width: 300 }}
                                                        getOptionKey={(option => option._id||'')}
                                                        value={Controllers.find(ct=>ct._id === newIf.lockSettings?.controller) || null}
                                                        onChange={(_event, newValue) => {
                                                            setNewIf(prev => {
                                                                if (!prev) return prev;
                                                                return {
                                                                    ...prev,
                                                                    lockSettings: {
                                                                        ...(prev.lockSettings || {}),
                                                                        controller: newValue?._id || ''
                                                                    }
                                                                } as Interface;
                                                            });
                                                        }}
                                                        renderInput={(params) => <TextField {...params} fullWidth color='secondary' variant='standard' label="Controller" />}
                                                    />
                                                    {Controllers.find(ct=>ct._id === newIf.lockSettings?.controller) && (
                                                        <>
                                                            {Controllers.find(ct=>ct._id === newIf.lockSettings?.controller)?.manufacturer === 'Apollo security' &&(
                                                                <>
                                                                    <TextField
                                                                        fullWidth
                                                                        value={newIf.lockSettings?.reader_node || ''}
                                                                        type='number'
                                                                        onChange={(e) => {
                                                                            setNewIf(prev => {
                                                                                if (!prev) return prev;
                                                                                return {
                                                                                    ...prev,
                                                                                    lockSettings: {
                                                                                        ...(prev.lockSettings || {}),
                                                                                        reader_node: Number(e.target.value)
                                                                                    }
                                                                                } as Interface;
                                                                            });
                                                                        }}
                                                                        id="standard-basic"
                                                                        label="Reader Node"
                                                                        variant="standard"
                                                                        color='secondary'
                                                                    />
                                                                    <TextField
                                                                        fullWidth
                                                                        value={newIf.lockSettings?.reader_lda || ''}
                                                                        type='number'
                                                                        onChange={(e) => {
                                                                            setNewIf(prev => {
                                                                                if (!prev) return prev;
                                                                                return {
                                                                                    ...prev,
                                                                                    lockSettings: {
                                                                                        ...(prev.lockSettings || {}),
                                                                                        reader_lda: Number(e.target.value)
                                                                                    }
                                                                                } as Interface;
                                                                            });
                                                                        }}
                                                                        id="standard-basic"
                                                                        label="Reader LDA"
                                                                        variant="standard"
                                                                        color='secondary'
                                                                    />
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                    <FormControlLabel sx={{width:'100%'}} control={
                                                        <Switch
                                                            checked = {newIf.lockSettings?.tfa || false}
                                                            onChange={(_e, v)=>{
                                                                setNewIf(prev => {
                                                                    if (!prev) return prev;
                                                                    return {
                                                                        ...prev,
                                                                        lockSettings: {
                                                                            ...(prev.lockSettings || {}),
                                                                            tfa: v
                                                                        }
                                                                    } as Interface;
                                                                })
                                                            }}
                                                        />}
                                                        label="Require 2FA" 
                                                    />
                                                    <FormControlLabel sx={{width:'100%'}} control={
                                                        <Switch
                                                            checked = {newIf.lockSettings?.singlePerson || false}
                                                            onChange={(_e, v)=>{
                                                                setNewIf(prev => {
                                                                    if (!prev) return prev;
                                                                    return {
                                                                        ...prev,
                                                                        lockSettings: {
                                                                            ...(prev.lockSettings || {}),
                                                                            singlePerson: v
                                                                        }
                                                                    } as Interface;
                                                                })
                                                            }}
                                                        />}
                                                        label="Solo Presence Required"
                                                    />
                                                    <FormControlLabel sx={{width:'100%'}} control={
                                                        <Switch
                                                            checked = {newIf.lockSettings?.unknownPerson || false}
                                                            onChange={(_e, v)=>{
                                                                setNewIf(prev => {
                                                                    if (!prev) return prev;
                                                                    return {
                                                                        ...prev,
                                                                        lockSettings: {
                                                                            ...(prev.lockSettings || {}),
                                                                            unknownPerson: v
                                                                        }
                                                                    } as Interface;
                                                                })
                                                            }}
                                                        />}
                                                        label="All-Person Identity Check"
                                                    />
                                                </>
                                            )}
                                        </Card>
                                        <Card raised sx={{width:'100%', p:1, boxSizing:'border-box'}}>
                                            <FormControlLabel sx={{width:'100%'}} control={
                                                <Switch
                                                    checked = {(newIf.cmpsaction || []).includes('report')}
                                                    onChange={(_e, v)=>{
                                                        setNewIf(prev => {
                                                            if (!prev) return prev;
                                                            return {
                                                                ...prev,
                                                                cmpsaction: v
                                                                    ? [...prev.cmpsaction, 'report']
                                                                    : prev.cmpsaction.filter(action => action !== 'report')
                                                            };
                                                        })
                                                    }}
                                                />}
                                                label="Write Report" 
                                            />
                                            {(newIf.cmpsaction || []).includes('report') && (
                                                <>
                                                    <FormControlLabel sx={{width:'100%'}} control={
                                                        <Switch
                                                            checked = {newIf.reportingSettings?.intruderAlert || false}
                                                            onChange={(_e, v)=>{
                                                                setNewIf(prev => {
                                                                    if (!prev) return prev;
                                                                    return {
                                                                        ...prev,
                                                                        reportingSettings: {
                                                                            ...(prev.reportingSettings || {}),
                                                                            intruderAlert: v,
                                                                            intruderLine: v ? prev.reportingSettings?.intruderLine : undefined,
                                                                            intruderSide: v ? prev.reportingSettings?.intruderSide : undefined,
                                                                        }
                                                                    } as Interface;
                                                                })
                                                            }}
                                                        />}
                                                        label="Intruder Alert"
                                                    />
                                                    {newIf.reportingSettings?.intruderAlert && (() => {
                                                        const camLines = Cams.find(c => c._id === newIf.cam)?.lines ?? [];
                                                        const selectedLine = camLines.find(l => l.lineId === newIf.reportingSettings?.intruderLine);
                                                        const sideOptions = selectedLine?.orientation === 'v'
                                                            ? ['left', 'right']
                                                            : ['above', 'below'];
                                                        return (
                                                            <Stack spacing={1} sx={{pl:2, borderLeft:'2px solid', borderColor:'warning.main'}}>
                                                                {camLines.length === 0 ? (
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        No lines configured for this camera. Add lines in camera overlay settings.
                                                                    </Typography>
                                                                ) : (
                                                                    <>
                                                                        <FormControl fullWidth size="small">
                                                                            <InputLabel>Trigger line</InputLabel>
                                                                            <Select
                                                                                value={newIf.reportingSettings?.intruderLine || ''}
                                                                                label="Trigger line"
                                                                                onChange={(e) => {
                                                                                    setNewIf(prev => {
                                                                                        if (!prev) return prev;
                                                                                        return {
                                                                                            ...prev,
                                                                                            reportingSettings: {
                                                                                                ...(prev.reportingSettings || {}),
                                                                                                intruderLine: e.target.value,
                                                                                                intruderSide: undefined,
                                                                                            }
                                                                                        } as Interface;
                                                                                    });
                                                                                }}
                                                                            >
                                                                                {camLines.map(l => (
                                                                                    <MenuItem key={l.lineId} value={l.lineId}>{l.label}</MenuItem>
                                                                                ))}
                                                                            </Select>
                                                                        </FormControl>
                                                                        {selectedLine && (
                                                                            <FormControl fullWidth size="small">
                                                                                <InputLabel>Alert side</InputLabel>
                                                                                <Select
                                                                                    value={newIf.reportingSettings?.intruderSide || ''}
                                                                                    label="Alert side"
                                                                                    onChange={(e) => {
                                                                                        setNewIf(prev => {
                                                                                            if (!prev) return prev;
                                                                                            return {
                                                                                                ...prev,
                                                                                                reportingSettings: {
                                                                                                    ...(prev.reportingSettings || {}),
                                                                                                    intruderSide: e.target.value,
                                                                                                }
                                                                                            } as Interface;
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    {sideOptions.map(s => (
                                                                                        <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
                                                                                    ))}
                                                                                </Select>
                                                                            </FormControl>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </Stack>
                                                        );
                                                    })()}
                                                    
                                                    <FormControlLabel sx={{width:'100%'}} control={
                                                        <Switch
                                                            checked = {newIf.reportingSettings?.spoofAlert || false}
                                                            onChange={(_e, v)=>{
                                                                setNewIf(prev => {
                                                                    if (!prev) return prev;
                                                                    return {
                                                                        ...prev,
                                                                        reportingSettings: {
                                                                            ...(prev.reportingSettings || {}),
                                                                            spoofAlert: v
                                                                        }
                                                                    } as Interface;
                                                                })
                                                            }}
                                                        />}
                                                        label="Spoof Alert"
                                                    />
                                                    
                                                    {newIf.lockSettings?.controller && Controllers.find(ct=>ct._id === newIf.lockSettings?.controller)?.manufacturer === 'Apollo security' &&(
                                                        <TextField
                                                        fullWidth
                                                        value={newIf.reportingSettings?.alertCallBack || ''}
                                                        type='number'
                                                        onChange={(e) => {
                                                            setNewIf(prev => {
                                                                if (!prev) return prev;
                                                                return {
                                                                    ...prev,
                                                                    reportingSettings: {
                                                                        ...(prev.reportingSettings || {}),
                                                                        alertCallBack: Number(e.target.value)
                                                                    }
                                                                } as Interface;
                                                            });
                                                        }}
                                                        id="standard-basic"
                                                        label="Alert Call Back Relay"
                                                        variant="standard"
                                                        color='secondary'
                                                    />
                                                    )}
                                                    
                                                </>
                                            )}
                                        </Card>
                                    </Stack>
                                )}
                            </Stack>
                        )
                        :(
                            <>
                            <Stack direction ='row' spacing={2} sx={{flexWrap:'wrap'}}>
                                <Card
                                    key='add-new-interface'
                                    raised
                                    sx={{width:'25%', cursor:'pointer', background:'rgba(0,0,0, .3)'}}
                                    onClick={()=>{setNewIf({
                                        cam:'',
                                        cmpsaction:['report', 'unlock'],
                                        action:'entrance',
                                    })}}
                                >
                                    <CardContent>
                                        <Typography sx={{textAlign:'center'}} variant="subtitle2">Add New Interface</Typography>
                                    </CardContent>
                                </Card>
                                {myGate.interfaces.map((iface, index) => (
                                    <Card
                                        key={index}
                                        raised
                                        sx={{
                                            p:1,
                                            minWidth: 200,
                                            position:'relative',
                                            
                                        }}
                                    >
                                        {iface.cam && iface.cam !== '' && (
                                            <>
                                            <CamImage sx={{position:'absolute',height:'100%', top:0, left:0 }} streamurl={Cams.find(cam=>cam._id === iface.cam)?.streamurl || ''} />
                                            <Box sx={{
                                                position:'absolute',
                                                top:0,
                                                left:0,
                                                width:'100%',
                                                height:'100%',
                                                backgroundColor:'rgba(255, 255, 255, 0.6)',
                                                zIndex:1
                                            }}></Box>
                                            </>
                                        )}
                                        
                                        <CardContent sx={{position:'relative', zIndex:2}}>
                                            <Typography variant="subtitle2">{Cams.find(cam=>cam._id === iface.cam)?.name}</Typography>
                                            <Typography variant="subtitle2">{iface.action}</Typography>
                                            <Typography variant="subtitle2">{Controllers.find(ct=>ct._id === iface.lockSettings?.controller)?.name}</Typography>
                                            <Divider/>
                                            <Typography variant="subtitle2">
                                                {iface.cmpsaction.includes('report') ? <><CheckBoxIcon /> Reporting Enabled </>: <><IndeterminateCheckBoxIcon /> Reporting Disabled </>}

                                            </Typography>
                                            <Typography variant="subtitle2">
                                                {iface.cmpsaction.includes('unlock') ? <><CheckBoxIcon /> Unlock Enabled </>: <><IndeterminateCheckBoxIcon /> Unlock Disabled </>}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                onClick={() => {
                                                    setMyGate(prev => ({
                                                        ...prev,
                                                        interfaces: prev.interfaces.filter((_, i) => i !== index)
                                                    }));
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                            <Stack direction='row' spacing={2} sx={{mt:2, flexDirection:'row-reverse'}}>
                                <ButtonGroup>
                                    <Button disabled = {myGate.interfaces.length===0} variant="contained" onClick={() => setStep(2)}>Next</Button>
                                    <Button variant="outlined" onClick={()=>{setStep(0)}}>Back</Button>
                                </ButtonGroup>
                            </Stack>
                            </>
                        )}
                        
                    </Stack>
                </>
            )}
            {step === 2 && (
                <Stack direction ='column' spacing={2}>
                    <Table sx={{width:'100%', mt:1}}>
                        <TableBody>
                            <TableRow sx={{backgroundColor:'#e1e1e1'}}>
                                <TableCell>
                                    <Typography variant="subtitle2">Gate Name:</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body1">{myGate.name}</Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <Typography variant="subtitle2">Zone:</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body1">{Zones.find(z=>z._id === myGate.zone)?.name || 'Not Selected'}</Typography>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    <Stack direction ='row' spacing={2} sx={{flexWrap:'wrap'}}>
                        {myGate.interfaces.map((iface, index) => (
                            <Card
                                key={index}
                                raised
                                sx={{
                                    p:1,
                                    minWidth: 200,
                                    position:'relative',
                                    width:'25%'
                                }}
                            >
                                {iface.cam && iface.cam !== '' && (
                                    <>
                                    <CamImage sx={{position:'absolute',height:'100%', top:0, left:0 }} streamurl={Cams.find(cam=>cam._id === iface.cam)?.streamurl || ''} />
                                    <Box sx={{
                                        position:'absolute',
                                        top:0,
                                        left:0,
                                        width:'100%',
                                        height:'100%',
                                        backgroundColor:'rgba(255, 255, 255, 0.6)',
                                        zIndex:1
                                    }}></Box>
                                    </>
                                )}
                                <CardContent sx={{position:'relative', zIndex:2}}>
                                    <Typography variant="subtitle2">{Cams.find(cam=>cam._id === iface.cam)?.name}</Typography>
                                    <Typography variant="subtitle2">{iface.action}</Typography>
                                    <Typography variant="subtitle2">{Controllers.find(ct=>ct._id === iface.lockSettings?.controller)?.name}</Typography>
                                    <Typography variant="subtitle2">
                                        {iface.cmpsaction.includes('report') ? <><CheckBoxIcon /> Reporting Enabled </>: <><IndeterminateCheckBoxIcon /> Reporting Disabled </>}

                                    </Typography>
                                    <Typography variant="subtitle2">
                                        {iface.cmpsaction.includes('unlock') ? <><CheckBoxIcon /> Unlock Enabled </>: <><IndeterminateCheckBoxIcon /> Unlock Disabled </>}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                    <Stack direction='row' spacing={2} sx={{mt:2, flexDirection:'row-reverse'}}>
                        <ButtonGroup>
                            <Button variant="contained" onClick={async () => {
                                try {
                                    if(gate){
                                        await Meteor.callAsync('updateGate', gate._id, myGate);
                                        setMyGate({
                                            name: '',
                                            zone: '',
                                            interfaces: []
                                        });
                                        setStep(0);
                                        resetEditting()
                                        setErrorMessage('Gate Updated Successfully');
                                    }else{
                                    await Meteor.callAsync('insertGate', myGate);
                                    setMyGate({
                                        name: '',
                                        zone: '',
                                        interfaces: []
                                    });
                                    setStep(0);
                                    setErrorMessage('Gate Added Successfully');
                                    }
                                    
                                } catch (error:any) {
                                    setErrorMessage(`Error adding gate: ${error.message}`);
                                }
                            }}>{gate === undefined ? 'Create Gate':'Save Changes'}</Button>
                            <Button variant="outlined" onClick={()=>{setStep(1)}}>Back</Button>
                        </ButtonGroup>
                        </Stack>
                </Stack>
            )}
        </AccordionDetails>
    </Accordion>
    )
}

const ZoneItem = ({zone, Gates, Zones, setEditingGate}:{zone:Zone, Gates:Gate[],setEditingGate:(gate:Gate | undefined)=>void, Zones:Zone[]})=>{
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [todeleteGate, setTodeleteGate] = useState<null | Gate>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [camActions, setCamActions] = useState<null | Gate>(null);
    return(
        <>
        <Accordion sx={{boxShadow: '0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)', mb: 1}}  key={zone._id}>
                    <AccordionSummary   expandIcon={<ExpandMoreIcon />} sx={{backgroundColor:'#f5f5f5'}}>
                        {`${zone.name} (${Gates.filter(gate => gate.zone === zone._id).length})`} 
                    </AccordionSummary>
                    <AccordionDetails sx={{pr:0}}>
                        {Gates.filter(gate => gate.zone === zone._id).length>0 &&(
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Gates.filter(gate => gate.zone === zone._id).map(myGate=>{
                                            return (
                                                <TableRow key={myGate._id}>
                                                    <TableCell>
                                                        {myGate.name}
                                                    </TableCell>
                                                    
                                                    <TableCell>
                                                        <IconButton
                                                            onClick={(e) => {
                                                                setCamActions(myGate);
                                                                setMenuAnchorEl(e.currentTarget)
                                                            }}
                                                            size="small"
                                                            color="primary"
                                                        >
                                                            <MoreVertIcon />
                                                        </IconButton>
                                                        {(menuAnchorEl && camActions && camActions._id === myGate._id )&& (
                                                        <Popover
                                                            open
                                                            anchorEl={menuAnchorEl}
                                                            onClose={() => {setMenuAnchorEl(null); setCamActions(null)}}
                                                            anchorOrigin={{
                                                                vertical: 'bottom',
                                                                horizontal: 'left',
                                                            }}
                                                        >
                                                            <MenuList>
                                                                <MenuItem 
                                                                    onClick={()=>{
                                                                        setMenuAnchorEl(null);
                                                                        setEditingGate(myGate);
                                                                    }}
                                                                >
                                                                <ListItemIcon>
                                                                    <EditIcon fontSize="small" />
                                                                </ListItemIcon>
                                                                <ListItemText>Edit</ListItemText>
                                                                </MenuItem>
                                                                <MenuItem 
                                                                    onClick={()=>{
                                                                        setMenuAnchorEl(null);
                                                                        setTodeleteGate(camActions);
                                                                    }}
                                                                >
                                                                <ListItemIcon>
                                                                    <DeleteIcon fontSize="small" />
                                                                </ListItemIcon>
                                                                <ListItemText>Delete</ListItemText>
                                                                </MenuItem>
                                                            </MenuList>
                                                        </Popover>
                                                        )}
                                                        
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                        {Zones.filter(z => z.parent === zone._id).length > 0 && (
                            Zones.filter(z => z.parent === zone._id).map((subZone) => (
                                <ZoneItem key={subZone._id} zone={subZone} Gates={Gates} Zones={Zones} setEditingGate={setEditingGate} />
                            ))
                        )}
                    </AccordionDetails>
        </Accordion>
        <Dialog
            open={!!todeleteGate}
            slots={{
            transition: Transition,
            }}
            keepMounted
            onClose={()=>{setTodeleteGate(null)}}
            aria-describedby="alert-dialog-slide-description"
        >
        <DialogTitle>{`Are you sure you want to delete ${todeleteGate?.name}?`}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-slide-description">
            {`This action can not be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={()=>{setTodeleteGate(null)}}>Disagree</Button>
            <Button 
                onClick={async()=>{
                    try{
                        await Meteor.callAsync('removeGate', todeleteGate?._id);
                    }
                    catch (error:any) {
                        setErrorMessage(`Error deleting camera: ${error.message}`);
                    }
                    setErrorMessage('Gate removed successfully');
                    setTodeleteGate(null)
                }}
            >
                Agree
            </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
            open={!!errorMessage}
            autoHideDuration={6000}
            onClose={()=>{setErrorMessage(null)}}
            message={errorMessage || ''}
        />
    </>
    )
}

const GatesAppRenderer =({launchApp}:AppProps) =>{
    const mySubs = [useSubscribe('gates'), useSubscribe('zones'), useSubscribe('cams'), useSubscribe('controllers')];
    const Controllers = useFind(() => ControllersCollection.find({}));
    const Gates = useFind(() => GatesCollection.find({}));
    const Zones = useFind(() => ZonesCollection.find({}));
    const Cams = useFind(() => CamsCollection.find({}));
    const loading = () => mySubs.every((sub) => sub());
    const [edittingGate, setEditingGate] = useState<undefined | Gate>(undefined);
    const displayServerMessage = (message: string) => {
        setErrorMessage(message);
    }
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    return(<Paper sx={{minHeight:'100%', p:2, boxSizing:'border-box', maxWidth:'100%', overflowX:'auto'}}>
    {loading() && (
            <Box sx={{position:'absolute', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
            </Box>
        )
    }
    <GateAddEdit Zones={Zones} Cams={Cams} Controllers={Controllers} gate={edittingGate} resetEditting={()=>{setEditingGate(undefined)}} setErrorMessage ={displayServerMessage} />
    <Divider />
    {(!loading() && Zones.length === 0) ? (
        <>
            <Alert variant="filled" severity="info">
                No zones are defined. Please create the zones hierarchy first.
            </Alert>
            {typeof launchApp === 'function' && (
                <Button onClick={() => launchApp('Zones')}>Open Zones Config</Button>
            )}
        </>
    ) :(
        // display a list of GATES in hierarchical view by zones that are attached to it
        <>
        {Zones.filter(z=>z.parent === 'root').map((zone) => (
            <ZoneItem key={zone._id} zone={zone} Gates={Gates} Zones={Zones} setEditingGate={(gate:Gate | undefined)=>{setEditingGate(gate)}} />
        ))}
        </>
    )}
    
    <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={()=>{setErrorMessage(null)}}
        message={errorMessage || ''}
    />
    </Paper>);
}

const GatesApp: AppType = {
    appName: 'Gates',
    appIcon: <Icon/>,
    render: GatesAppRenderer,
    module: 'accessControl',
};

export default GatesApp;
