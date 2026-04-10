import * as React from 'react';
import { useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import { Stack, Typography, Divider,  Box, Popover, TextField, MenuList, MenuItem, ListItemIcon, CircularProgress, Avatar, Chip, Tooltip } from '@mui/material';
import Button from '@mui/material/Button'
import { SitemarkIcon } from '../signin/CustomIcons';
import Badge from '@mui/material/Badge';
import { format } from "date-fns";
import AppWindow from '../components/appwindow'
import apps, { AppProps, AppType } from '../../applications'
import { WorkspacesCollection } from '/imports/api/workspace';
import { useSubscribe, useFind, useTracker } from 'meteor/react-meteor-data';
import {AlertsArchiveCollection, AlertItem} from '/imports/api/alertsArchive'
import { AlertLists, AlertList } from '/imports/api/alertLists';
import {SummaryMeta, VisitSummaryMetaCollection} from '/imports/api/visitSummary'
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import IconButton from '@mui/material/IconButton';
import { ApolloStatusCollection } from '/imports/api/apolloStatus';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import ErrorIcon from '@mui/icons-material/Error';
const DesktopBox = styled(Box)(({ theme }) => ({
    display:'flex',
    flexDirection:'column',
    flexWrap:'wrap',
    alignContent:'flex-start',
    justifyContent:'flex-start',
    p:0.5,
    pb:'52px',
  ...theme.applyStyles('dark', {
    
  }),
}));
const DesktopShortcut = styled(Box)(({ theme }) => ({
    '--black-0':'#29343F',
    '--scale':'1rem',
    '--border-radius-1':'.375rem',
    '--svg-drop-shadow-color':'#29343F',
    '--svg-drop-shadow-0':'drop-shadow(.1rem .1rem .2rem color-mix(in srgb, var(--svg-drop-shadow-color) 50%, transparent))',
    gap:0.25,
    display:'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'calc(var(--scale) * 7.5)',
    height: 'calc(var(--scale) * 7.5)',
    p: '.5rem',
    background: 'none',
    border: 'none',
    borderRadius: 'var(--border-radius-1)',
    outline: 'none',
    cursor: 'pointer',
    color:'#E5F2FF',
    transition: 'background-color var(--transition-duration-0) var(--ease-in-out-default)',
    textShadow:'.1rem .1rem .2rem color-mix(in srgb,var(--black-0) 75%,transparent)',
    svg:{
        width:'56px',
        height:'56px',
        filter: 'var(--svg-drop-shadow-0)',
    },
    ':hover':{
        backgroundColor:'color-mix(in srgb, var(--black-0) 20%, transparent)',
    },
    ...theme.applyStyles('dark', {
    
    }),
}));
const OsBox = styled(Box)(({ theme }) => ({
    width:'100vw',
    height:'100vh',
    paddingBottom:'48px',
    display: 'flex',
    boxSizing:'border-box',
    backgroundImage:'url(desktop.png)',
    backgroundSize:'cover',
  ...theme.applyStyles('dark', {
    
  }),
}));
const AppBar = styled(Box)(({ theme }) => ({
    width:'100%',
    height:'52px',
    padding:'4px',
    position:'fixed',
    boxSizing:'border-box',
    bottom:0,
    left:0,
    background:'rgba(75, 75, 75, 0.5)',
  ...theme.applyStyles('dark', {
    
  }),
}));
type Task ={
    appId:number,
    appIcon:React.JSX.Element,
    appName: string,
    render:(props:AppProps)=>React.JSX.Element,
    minimized:boolean,
    zIndex:number,
    fullScreen:boolean,
    bBox:{
        x:number,
        y:number,
        width:number,
        height:number
    },
    prevbBox:{
        x:number,
        y:number,
        width:number,
        height:number
    }
}
type personBoxProps = {
    alertItem:AlertItem
    cam:Cam | undefined
    alertList : AlertList | undefined
    personMeta :  SummaryMeta | undefined
    setItemModal :()=>void
}
const PersonAlertBox = ({alertItem, cam, alertList, personMeta, setItemModal}:personBoxProps)=>{

    return (
        <Box  sx={{backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 2, p: 1, mb: 1, position:'relative' }} key={alertItem._id}>
        <Fab size="small" color="secondary" aria-label="add" sx={{ position: 'absolute', top: -5, right: -5 }}
            onClick={()=>{
                Meteor.callAsync('setSeenAlert', alertItem._id) 
            }}
        >
            <DisabledVisibleIcon />
        </Fab>
        <Stack direction='row' sx={{cursor:'pointer'}} spacing={1} onClick={()=>{
            setItemModal()
        }}>
            <Avatar
                alt="Person Image"
                sx={{ width: 50, height: 50, borderRadius:2, border:`3px solid ${alertList?.color || '#fff'}`}}
                src={`data:image/jpeg;base64,${alertItem.face_b64}`}
            />
            <Box>
                <Typography color='warning' variant="body2">{cam?.name}</Typography>
                <Typography color='warning' variant="body2">{`${alertList?.name}: ${personMeta?.idInfo?.firstName || ''} ${personMeta?.idInfo?.lastName || ''} `}</Typography>
                <Typography variant="caption" color="secondary">{new Date(alertItem.timestamp).toLocaleString()}</Typography>
            </Box>
        </Stack>
    </Box>
    )
}
import windowDimensions from '../../hooks/windowSize'
import { Meteor } from 'meteor/meteor';
import {Cam} from '../../api/cams'
import {IntruderAlertsCollection} from '/imports/api/intruderAlerts';
import DisabledVisibleIcon from '@mui/icons-material/DisabledVisible';
import Fab from '@mui/material/Fab';
import {CamsCollection} from '/imports/api/cams';
import IntruderItemModal from '../../applications/accessControl/intruderAlerts/intruderItemModal';
import AlertItemModal from '../../applications/personAlert/alertsArchive/itemModal'
import { CountAlertsCollection } from '/imports/api/countAlerts';
export default function Desktop() {
    useSubscribe('unseenIntruders');
    useSubscribe('cams');
    useSubscribe('unseenAlertsArchive')
    useSubscribe('alertLists');
    useSubscribe('unseenCountAlertsNewestPerSource');
    useSubscribe('apolloStatus');
    const apolloStatus = useTracker(() => ApolloStatusCollection.findOne('apollo-status'), []);
    const PersonFilter = useFind(() => VisitSummaryMetaCollection.find({}));
    useSubscribe('visitSummaryMeta');
    const alertLists = useFind(() => AlertLists.find({}));
    const [intruderModal, setInruderModal] = useState<null | string>(null);
    const [alertModal, setAlertModal] =useState<null | string>(null);
    const [showAlerts, setShowAlerts] = useState<boolean>(true);
    const onCloseModal = () => {
        setInruderModal(null);
        setAlertModal(null);
    }
    const Cams = useFind(() => CamsCollection.find());
    const UnseenIntruders = useFind(() => IntruderAlertsCollection.find({ seen: false }, { sort: { timestamp: -1 }, limit: 10 }));
    const UnseenPersonAlerts = useFind(()=> AlertsArchiveCollection.find({seen:false}, { sort: { timestamp: -1 }, limit: 10 }));
    const UnseenCountAlerts = useFind(()=> CountAlertsCollection.find({seen:false}, { sort: { timestamp: -1 }, limit: 10 }));
    const loading = useSubscribe('workspace')
    const [prepared, setPrepared] = useState(false);
    const Icons:AppType[] = Object.values(apps)
    const myWorkspace = useFind(() => Meteor.user() ? WorkspacesCollection.find({ user: Meteor.userId() as string }):null);
    const [taskManager, setTaskManager] = useState<Task[]>([])
    useEffect(() => {
        if(!prepared && !loading()){
            const myApps = myWorkspace?.[0]?.apps || [];
            const initialTasks: Task[] = myApps.map((app) => {
                const icon = Icons.find(i => i.appName === app.appName);
                if (icon) {
                    return {
                        ...app,
                        appIcon: icon.appIcon,
                        render: (props)=>icon.render({ ...props, extraConfigs:app.extraConfigs, launchApp, killApp: toClose }),
                    } as Task;
                }
            }).filter((task): task is Task => task !== undefined);
            setTaskManager(initialTasks);
            setPrepared(true);
        }
    }, [loading, prepared]);
    const [startAnchorEl, setStartAnchorEl] = useState<null | HTMLElement>(null);
    const[searchApp, setSearchApp] = useState<string>('');
    const { width, height} = windowDimensions()
    const [lastActive, setLastActive] =useState<number | null>(null)
    const [time, setTime] = useState(new Date());
    
    
    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);
    const toMinimize = (appId:number)=>{
        if(!myWorkspace || myWorkspace.length === 0) return;
        const myWorkspaceApps = myWorkspace[0].apps || [];
        Meteor.callAsync('updateWorkspace', myWorkspaceApps.map(task => {
            if (task.appId === appId) {
                return { ...task, minimized: !task.minimized };
            }
            return task;
        }))
        setTaskManager(prev=>
            prev.map(task=>{
                if(task.appId === appId)
                    return{...task, minimized:!task.minimized}
                return{...task}
            })
        )
    }
    const getBadgeColor=(module:string | undefined)=>{
        if(!module) return 'secondary';
        switch(module){
            case 'personAlert':
                return 'primary';
            case 'personCount':
                return 'warning';
            case 'accessControl':
                return 'success';
            default:
                return 'primary';
        }
    }
    const toClose=(appId:number)=>{
        if(!myWorkspace || myWorkspace.length === 0) return;
        const myWorkspaceApps = myWorkspace[0].apps || [];
        console.log('toClose', appId, myWorkspaceApps, myWorkspaceApps.filter(task => task.appId !== appId));
        Meteor.callAsync('updateWorkspace', myWorkspaceApps.filter(task => task.appId !== appId))
        setTaskManager(prev=>prev.filter(task=>task.appId !== appId))
    }
    const bringToTop=(appId:number)=>{
        setLastActive(appId)
        const maxIndex=Math.max(...taskManager.map(el=>el.zIndex))+1;
        setTaskManager(prev=>
            prev.map(task=>{
                if(task.appId === appId)
                    return{...task, zIndex:maxIndex}
                return{...task}
            })
        )
    }

    const triggerFullScreen=(appId:number)=>{
        const maxIndex=Math.max(...taskManager.map(el=>el.zIndex))+1;
        if(!myWorkspace || myWorkspace.length === 0) return;
        const myWorkspaceApps = myWorkspace[0].apps || [];
        setTaskManager(prev=>
            prev.map(task=>{
                if(task.appId === appId){
                    const prevApp = myWorkspaceApps.find(t => t.appId === appId);
                    Meteor.callAsync('updateWorkspace', [...myWorkspaceApps.filter(t=>t.appId !== appId), {
                       ...prevApp,
                        fullScreen: !task.fullScreen,
                        bBox: task.fullScreen
                            ? { ...task.prevbBox }
                            : { x: 0, y: 0, width: width - 4, height: height - 55 },
                    }])
                    return task.fullScreen
                    ?{...task,
                        bBox:{...task.prevbBox},
                        fullScreen:!task.fullScreen,
                        zIndex:maxIndex
                    }
                    :{...task,
                        fullScreen:!task.fullScreen,
                        zIndex:maxIndex,
                        prevbBox:{...task.bBox},
                        bBox:{x:0,y:0,width:width-4,height:height-55}
                    }
                }
                    
                return{...task}
            })
        )
    }
    const updateSize=(appId:number, width:number, height:number)=>{
        if(!myWorkspace || myWorkspace.length === 0) return;
        const myWorkspaceApps = myWorkspace[0].apps || [];
        Meteor.callAsync('updateWorkspace', myWorkspaceApps.map(task =>  (task.appId === appId) ?{...task, bBox:{...task.bBox, width,height}}:task))
        setTaskManager(prev=>
            prev.map(task=>{
                if(task.appId === appId)
                    return{...task, bBox:{...task.bBox, width, height}}
                return{...task}
            })
        )
    }
    const updatePossition=(appId:number, x:number, y:number)=>{
        x = x || 0;
        y = y || 0;
        if(!myWorkspace || myWorkspace.length === 0) return;
        const myWorkspaceApps = myWorkspace[0].apps || [];
        Meteor.callAsync('updateWorkspace', myWorkspaceApps.map(task =>  (task.appId === appId) ?{...task, bBox:{...task.bBox, x, y}}:task))
        
        setTaskManager(prev=>
            prev.map(task=>{
                if(task.appId === appId)
                    return{...task, bBox:{...task.bBox, x, y}}
                return{...task}
            })
        )
    }
    type ExtraConfig = {
        cam?:Cam,
        [k:string]:any
    }
    const launchApp = (appName:string, extraConfigs?:ExtraConfig)=>{
        const icon = Icons.find(i=>i.appName === appName)
        if(icon){
            const appId = (new Date()).getTime()
            if(myWorkspace !== null){
                const currentApps = myWorkspace[0]?.apps || [];
                const maxDBZindex = (currentApps.length > 0 ? Math.max(...currentApps.map(task => task.zIndex)) : 1) + 1;
                Meteor.callAsync('updateWorkspace', [...currentApps, {
                    appId: appId,
                    appName: appName,
                    minimized:false,
                    zIndex:maxDBZindex,
                    fullScreen:false,
                    bBox:{ x : Math.floor(width/4), y : Math.floor(height/4), width : Math.floor(width/2), height : Math.floor(height/2) },
                    extraConfigs
                }])
            
            }
            setTaskManager(prev => {
                const maxZindex = (prev.length > 0 ? Math.max(...prev.map(task => task.zIndex)) : 1) + 1;
                const newTask :Task = {
                    appId: appId,
                    appIcon:icon.appIcon,
                    appName: icon.appName,
                    render: (props) => icon.render({ ...props, extraConfigs, launchApp, killApp: toClose }),
                    minimized:false,
                    zIndex:maxZindex,
                    fullScreen:false,
                    bBox:{ x : Math.floor(width/4), y : Math.floor(height/4), width : Math.floor(width/2), height : Math.floor(height/2) },
                    prevbBox:{ x : Math.floor(width/4), y : Math.floor(height/4), width : Math.floor(width/2), height : Math.floor(height/2) }
                }
                return [...prev, newTask];
            });
        }
    }
    return (
        <OsBox>
            {intruderModal && (
                <IntruderItemModal
                    alertId={intruderModal || '' }
                    onCloseModal={onCloseModal}
                />
            )}
            {alertModal &&(
                <AlertItemModal
                     alertId={alertModal || ''}
                     onCloseModal={onCloseModal}
                />
            )}
            {(UnseenPersonAlerts.length>0 || UnseenIntruders.length>0 || UnseenCountAlerts.length>0) &&(

                <Box sx={{ position: 'absolute', top: 10, right: 10, width:'280px', zIndex: 1000 }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <IconButton
                            size="small"
                            onClick={() => setShowAlerts(!showAlerts)}
                            sx={{
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'warning.main',
                                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.85)' }
                            }}
                        >
                            {showAlerts ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                        {showAlerts && (
                            <Button
                                onClick={()=>{Meteor.callAsync('seenAllIntruders'); Meteor.callAsync('setAllAlertsSeen');Meteor.callAsync('setCountAllSeen')}}
                                variant='contained'
                                color='warning'
                                sx={{ flexGrow: 1 }}
                                size='small'
                            >
                                Mark seen All
                            </Button>
                        )}
                    </Stack>
                    {showAlerts && (
                        <>
                            {UnseenCountAlerts.map((countAlert)=>(
                                <Box sx={{backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 2, p: 1, mb: 1, position:'relative' }} key={countAlert._id || ''}>
                                    <Fab size="small" color="secondary" aria-label="add" sx={{ position: 'absolute', top: -5, right: -5 }}
                                        onClick={()=>{
                                            Meteor.callAsync('setCountSeen', countAlert._id ||'')
                                        }}
                                    >
                                        <DisabledVisibleIcon />
                                    </Fab>
                                    <Stack direction='row' sx={{cursor:'pointer'}} spacing={1}>
                                        <Avatar
                                            alt="Alert icon"
                                            sx={{ width: 50, height: 50, borderRadius:2, backgroundColor:`${countAlert.level ==='warning'?'#fdd835':'#e64a19'}`}}
                                        >
                                            {countAlert.level==='warning'?<>
                                                <WarningAmberIcon/>
                                            </>:<>
                                            <ReportGmailerrorredIcon/>
                                            </>}
                                        </Avatar>
                                        <Box>
                                            <Typography color='warning' variant="body2">{Cams.find(cam=>cam._id === countAlert.source)?.name}</Typography>
                                            <Typography color='warning' variant="body2">Crowd Alert: {`${countAlert.count} / ${countAlert.allowed}`}</Typography>
                                            <Typography variant="caption" color="secondary">{new Date(countAlert.timestamp).toLocaleString()}</Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            ))}
                            {UnseenPersonAlerts.map((alertItem) => (
                                <PersonAlertBox
                                    key={alertItem._id}
                                    cam={Cams.find(cam=>cam._id === alertItem.source)}
                                    alertItem={alertItem}
                                    alertList={alertLists.find(list=> list._id === alertItem.listId)}
                                    personMeta={PersonFilter.find(p=>String(p._id) === String(alertItem.idInfo))}
                                    setItemModal={()=>{setAlertModal(alertItem._id||'')}}
                                />
                            ))

                            }
                            {UnseenIntruders.map((intruder, index) => (
                                <Box sx={{backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 2, p: 1, mb: 1, position:'relative' }} key={intruder._id || index}>
                                    <Fab size="small" color="secondary" aria-label="add" sx={{ position: 'absolute', top: -5, right: -5 }}
                                        onClick={()=>{
                                            Meteor.callAsync('setSeenIntruder', intruder._id)
                                        }}
                                    >
                                        <DisabledVisibleIcon />
                                    </Fab>
                                    <Stack direction='row' sx={{cursor:'pointer'}} spacing={1} onClick={()=>{
                                        setInruderModal(intruder._id || '');
                                    }}>
                                        <Avatar
                                            alt="Person Image"
                                            sx={{ width: 50, height: 50, borderRadius:2}}
                                            src={`data:image/jpeg;base64,${intruder.face_b64}`}
                                        />
                                        <Box>
                                            <Typography color='warning' variant="body2">{Cams.find(cam=>cam._id === intruder.source)?.name}</Typography>
                                            <Typography color='warning' variant="body2">Intruder Detected</Typography>
                                            <Typography variant="caption" color="secondary">{new Date(intruder.timestamp).toLocaleString()}</Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            ))}
                        </>
                    )}
                </Box>
            )}
            {loading() && (
                <Box sx={{ display: 'flex', position:'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', zIndex:9999, backgroundColor:'rgba(0, 0, 0, 0.8)' }}>
                    <CircularProgress />
                    </Box>
            )}
            {taskManager.map(task=>(
                <AppWindow
                    key={task.appId}
                    appTitle={task.appName}
                    appIcon={task.appIcon}
                    appId={task.appId}
                    minimize={toMinimize}
                    killTask={toClose}
                    minimized={task.minimized}
                    zIndex={task.zIndex}
                    fullScreen={task.fullScreen}
                    bBox={task.bBox} 
                    triggerFullScreen={triggerFullScreen}
                    updateSize={updateSize}
                    updatePossition={updatePossition}
                    bringToTop={bringToTop}
                >
                    {<task.render launchApp={launchApp} />}
                </AppWindow>
            ))}
            <DesktopBox
                >
                {Icons.filter(icon => !icon.hideShortcut).map((icon, index)=>(
                
                <DesktopShortcut
                    key={index}
                    onDoubleClick={()=>{launchApp(icon.appName)}}
                >
                    <Badge   
                        anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                        color={getBadgeColor(icon.module)}
                        badgeContent=" "
                        variant='dot'
                    >
                        {icon.appIcon}
                    </Badge>
                    <Typography sx={{mt:0.5, textAlign:'center'}} variant='subtitle2'>{icon.appName}</Typography>
                </DesktopShortcut>
            ))}
        </DesktopBox>
    <AppBar>
        <Stack direction='row' spacing={2}>
            <Button
                sx={{width:'48px', background:'#1a237e'}}
                onClick={(e)=>{
                    setStartAnchorEl(e.currentTarget);
                }}
            >
                <SitemarkIcon width={32} height={32} color='#ffffff' />
            </Button>
            <Popover
                open={Boolean(startAnchorEl)}
                anchorReference="anchorPosition"
                anchorPosition={{ top: window.innerHeight - 56, left: 8 }}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                onClose={()=>setStartAnchorEl(null)}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                slotProps={{
                    paper: {
                        sx: { background: 'rgba(0, 0, 0, 0.8)', p:3 }
                    }
                }}
            >
                <Box sx={{ minWidth:'200px',maxHeight:'400px', overflowY:'auto', display:'flex',alignItems:'flex-end' }}>
                    <MenuList sx={{width:'100%'}}>
                        {Icons.filter(icon => (icon.appName.toLowerCase().includes(searchApp.toLowerCase()) && !icon.hideShortcut )).map((icon, index)=>(
                            <MenuItem sx={{width:'100%'}} key={index} onClick={()=>{
                                launchApp(icon.appName)
                                setStartAnchorEl(null)
                            }}>
                                <ListItemIcon>
                                    <Badge   
                                        anchorOrigin={{
                                            vertical: 'top',
                                            horizontal: 'left',
                                        }}
                                        color={getBadgeColor(icon.module)}
                                        badgeContent=" "
                                        variant='dot'
                                    >
                                        {icon.appIcon}
                                    </Badge>
                                    
                                </ListItemIcon>
                                <Typography sx={{color:'#fff'}}>{icon.appName}</Typography>
                            </MenuItem>
                        ))}
                    </MenuList>
                </Box>
                <Divider/>
                <TextField
                    placeholder='Search app'
                    variant='standard'
                    value={searchApp}
                    onChange={(e)=>setSearchApp(e.target.value)}
                    sx={{
                        width:'200px',
                        m:1,
                        color:'white',
                        input:{color:'white'},
                        label:{color:'white'},
                        '& .MuiInput-underline:before':{
                            borderBottomColor:'rgba(255, 255, 255, 0.5)'
                        },
                        '& .MuiInput-underline:hover:not(.Mui-disabled):before':{
                            borderBottomColor:'rgba(255, 255, 255, 0.7)'
                        }}
                    }
                />
            </Popover>
            <Divider orientation="vertical" flexItem />
            <Stack sx={{width:'100%'}} direction='row' spacing={2}>
                {taskManager.map(task=>(
                    <Button key={task.appId} onClick={()=>{
                            if(lastActive === task.appId){
                                toMinimize(task.appId);
                            }else{
                                if(task.minimized){
                                    toMinimize(task.appId)
                                }
                                bringToTop(task.appId)
                            }
                        }
                        } sx={{width:'48px', background:task.minimized?'rgba(255, 255, 255, 0.1)' : lastActive === task.appId ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.2)',borderBottom:'1px solid white'}}>
                        {task.appIcon}
                    </Button>
                ))}
               
            </Stack>
            <Divider orientation="vertical" flexItem />
            <Tooltip title={apolloStatus?.message || 'Apollo API Status'}>
                <Chip
                    size="small"
                    icon={
                        apolloStatus?.status === 'connected' ? <CloudIcon sx={{ color: '#fff !important' }} /> :
                        apolloStatus?.status === 'connecting' ? <SyncIcon sx={{ color: '#fff !important', animation: 'spin 1s linear infinite' }} /> :
                        apolloStatus?.status === 'auth_error' ? <ErrorIcon sx={{ color: '#fff !important' }} /> :
                        <CloudOffIcon sx={{ color: '#fff !important' }} />
                    }
                    label={
                        apolloStatus?.status === 'connected' ? 'Apollo online' :
                        apolloStatus?.status === 'connecting' ? 'Apollo Connecting...' :
                        apolloStatus?.status === 'auth_error' ? 'Apollo Auth Error' :
                        apolloStatus?.status === 'not_configured' ? 'Apollo Not Configured' :
                        'Apollo Offline'
                    }
                    sx={{
                        mx: 1,
                        backgroundColor:
                            apolloStatus?.status === 'connected' ? '#4caf50' :
                            apolloStatus?.status === 'connecting' ? '#ff9800' :
                            apolloStatus?.status === 'auth_error' ? '#f44336' :
                            '#757575',
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white' },
                        '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' }
                        }
                    }}
                />
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Box sx={{pr:2, textAlign:'center'}}>
                <Typography color='white' variant='subtitle2'>
                    {format(time, 'HH:mm:ss')}
                </Typography>
                <Typography color='white' variant='subtitle2'>
                     {format(time, 'dd MMMM')}
                </Typography>
            </Box>
        </Stack>
        </AppBar>
    </OsBox>
    )
}