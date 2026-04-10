import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Paper,
    Box,
    Button,
    Tabs,
    Tab,
    Snackbar,
    Stack,
    Card,
    Grid,
    Badge,
    Table,
    Chip,
    TableBody,
    TableRow,
    TableCell,
    TextField
} from '@mui/material';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { OnvifDeviceCollection, OnvifDevice } from '/imports/api/onvifClient';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import { ZonesCollection} from '/imports/api/zones';
import OnvifIcon from './onvificon.jsx';
import CamForm from './camForm';
function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}
const NewCamAppRender = () => {
        useSubscribe('onvifDevices');
        useSubscribe('zones');
        const Zones = useFind(() => ZonesCollection.find());
        const [activeTab, setActiveTab] = useState(0);
        const onvifDevicesData = useFind(() => OnvifDeviceCollection.find());
        const[selectedDevice, setSelectedDevice] = useState<OnvifDevice | null>(null);
        const [onvifusername, setOnvifUsername] = useState('');
        const [loading, setLoading] = useState(false);
        const [onvifpassword, setOnvifPassword] = useState('');
        const [rtspLink, setRtspLink] = useState<string >('');
        const [imageData, setImageData] = useState<string | null>(null);
        const [errorMessage, setErrorMessage] = useState<string | null>(null);
        const [camName, setCamName] = useState<string>('');
        const resetAddForm = () => {
            setSelectedDevice(null);
            setOnvifUsername('');
            setOnvifPassword('');
            setRtspLink('');
            setImageData(null);
            setActiveTab(0);
            setErrorMessage(null);
            setOnvifUsername('');
            setRtspLink('');
            setCamName('')
            setSelectedDevice(null);
            if (onvifDevicesData.length > 0 )
                setActiveTab(0);
        }
        
    return <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
        { onvifDevicesData.length > 0 ? (
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(_ev, e)=>{setActiveTab(e)}} aria-label="basic tabs example">
                    <Tab label="Onvif" {...a11yProps(0)} />
                    <Tab label="RTSP" {...a11yProps(1)} />
                </Tabs>
            </Box>
        ):(
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(_ev, e)=>{setActiveTab(e)}} aria-label="basic tabs example">
                    <Tab label="RTSP" {...a11yProps(1)} />
                </Tabs>
            </Box>
        )
        }
        {activeTab===0 &&(
            (onvifDevicesData.length > 0 && selectedDevice === null) ? (
                <Grid sx={{mt:2}} spacing={2} container>
                {onvifDevicesData.map((device)=>(
                    <Grid key={device._id} size={6}>
                        <Card onClick={()=>{setSelectedDevice(device)}} sx={{cursor:'pointer', display: 'flex', width:'100%' }} key={device._id}>
                            <Stack direction="row" spacing={2}>
                                <Box sx={{ p: 1 }}>
                                    <Table size="small" aria-label="onvif device details">
                                        <TableBody>
                                            <TableRow>
                                                <TableCell>{device.name}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>{device.hardware}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>{device.xaddrs[0]?.match(/:\/\/([\d.]+)\//)?.[1] || device.xaddrs[0]}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </Box>
                                <Box
                                    sx={{
                                    minWidth: '25%',
                                    backgroundColor:'#455a64',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 0,
                                    p:2
                                    }}
                                >
                                    <Badge
                                    sx={{maxWidth: '100%'}}
                                    color='success'
                                    overlap="circular"
                                    badgeContent=" "
                                    >
                                        <OnvifIcon style={{maxWidth:'100%'}}/>
                                    </Badge>
                                </Box>
                            </Stack>
                        </Card>
                    </Grid>
                ))}
                </Grid>
            )
            :(
                <>
                <Stack direction='row' spacing={2} sx= {{mt:2}}>
                    {onvifDevicesData.map((device)=>(
                        <Chip
                            onClick={()=>{setSelectedDevice(device)}}
                            key={device._id}
                            label={`${device.name} (${device.xaddrs[0]?.match(/:\/\/([\d.]+)\//)?.[1] || device.xaddrs[0]})`}
                            variant={ selectedDevice?._id === device._id ? 'filled' : 'outlined'}
                        />
                    ))}
                </Stack>
                <Stack direction='row' spacing={2} sx={{mt:2}}>
                    <TextField
                        sx={{width:'100%'}}
                        label = "Username"
                        variant="outlined"
                        size="small"
                        value={onvifusername}
                        onChange={(e)=>{setOnvifUsername(e.target.value)}}
                    />
                    <TextField
                        sx={{width:'100%'}}
                        label = "Password"
                        variant="outlined"
                        size="small"
                        type="password"
                        value={onvifpassword}
                        onChange={(e)=>{setOnvifPassword(e.target.value)}}
                    />
                    {loading ? (
                        <Button
                            sx={{width:'100%'}}
                            loading
                            variant="contained"
                            loadingPosition="end"
                            startIcon={<SyncProblemIcon />}
                            >
                            Loading
                        </Button>
                    ):(
                        <Button
                            sx={{width:'100%'}}
                            variant="contained"
                            onClick={async()=>{
                                if(selectedDevice){
                                    try{
                                        setLoading(true);
                                        const data = await Meteor.callAsync('validateOnvifDevice', selectedDevice, onvifusername, onvifpassword);
                                        //add user and password to stream link format rtsp://username:password@ip~~~~
                                        const newstrp = data.replace('rtsp://', `rtsp://${onvifusername}:${onvifpassword}@`);
                                        setRtspLink(newstrp);
                                        const serverImageData = await Meteor.callAsync('validateRtspLink', newstrp);
                                        if(serverImageData){
                                            setImageData(serverImageData);
                                        }
                                        setCamName(`${selectedDevice?.name} (${selectedDevice?.xaddrs[0]?.match(/:\/\/([\d.]+)\//)?.[1] || selectedDevice?.xaddrs[0]})`);
                                        setLoading(false);
                                        setActiveTab(1);
                                    }catch (error:any) {
                                        setLoading(false);
                                        setErrorMessage(error.reason)                                    
                                    }
                                }
                                
                            }}
                        >
                            Validate
                        </Button>
                    )}
                </Stack>
            </>
            )
        )}
        {activeTab===1 && (
            <CamForm
                imageData={imageData}
                setImageData={setImageData}
                camName={camName}
                setCamName={setCamName}
                setErrorMessage={setErrorMessage}
                Zones={Zones}
                rtspLink={rtspLink}
                setRtspLink={setRtspLink}
                resetAddForm={resetAddForm}
            />
        )}
        <Snackbar
            open={!!errorMessage}
            autoHideDuration={6000}
            onClose={()=>{setErrorMessage(null)}}
            message={errorMessage || ''}
        />
    </Paper>
}
export default NewCamAppRender;