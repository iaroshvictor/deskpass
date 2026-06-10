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
import { WorkspacesCollection, App } from '/imports/api/workspace';
import { RolesCollection, RoleDefinitionsCollection } from '/imports/api/roles';
import { useSubscribe, useFind, useTracker } from 'meteor/react-meteor-data';
import {AlertsArchiveCollection, AlertItem} from '/imports/api/alertsArchive'
import { AlertLists, AlertList } from '/imports/api/alertLists';
import {SummaryMeta, VisitSummaryMetaCollection} from '/imports/api/visitSummary'
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
    },
    extraConfigs?: { [key: string]: any }
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
export default function Desktop() {
    useSubscribe('unseenIntruders');
    useSubscribe('cams');
    useSubscribe('unseenAlertsArchive')
    useSubscribe('alertLists');
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
    useSubscribe('userRole');
    const userRoleEntry = useTracker(() => RolesCollection.findOne({ userId: Meteor.userId() ?? '' }), []);
    const userRoleDef   = useTracker(() => {
        if (userRoleEntry?.roleId) return RoleDefinitionsCollection.findOne(userRoleEntry.roleId);
        return null;
    }, [userRoleEntry]);

    const loading = useSubscribe('workspace')
    const [prepared, setPrepared] = useState(false);
    const Icons: AppType[] = Object.values(apps);
    const isAdmin = userRoleEntry?.role === 'admin';
    const visibleIcons = Icons.filter(icon => {
        if (icon.hideShortcut) return false;
        if (isAdmin) return true;
        return userRoleDef?.permissions.includes(icon.appName) ?? false;
    });
    const myWorkspace = useFind(() => Meteor.user() ? WorkspacesCollection.find({ user: Meteor.userId() as string }):null);
    const [taskManager, setTaskManager] = useState<Task[]>([])
    const taskManagerRef = React.useRef<Task[]>([]);
    taskManagerRef.current = taskManager;

    const toCloseRef = React.useRef<(appId: number) => void>(() => {});
    const launchAppRef = React.useRef<(appName: string, extraConfigs?: ExtraConfig) => void>(() => {});

    const toDbApp = (t: Task): App => ({
        appId: t.appId,
        appName: t.appName,
        minimized: t.minimized,
        zIndex: t.zIndex,
        fullScreen: t.fullScreen,
        bBox: t.bBox,
        ...(t.extraConfigs ? { extraConfigs: t.extraConfigs } : {}),
    });

    useEffect(() => {
        if(!prepared && !loading()){
            const myApps = myWorkspace?.[0]?.apps || [];
            const initialTasks: Task[] = myApps.map((app) => {
                const icon = Icons.find(i => i.appName === app.appName);
                if (icon) {
                    return {
                        ...app,
                        appIcon: icon.appIcon,
                        render: (props)=>icon.render({ ...props, extraConfigs:app.extraConfigs, launchApp: (...a) => launchAppRef.current(...a), killApp: (id) => toCloseRef.current(id) }),
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
        setTaskManager(prev => {
            const next = prev.map(t => t.appId === appId ? { ...t, minimized: !t.minimized } : t);
            Meteor.callAsync('updateWorkspace', next.map(toDbApp));
            return next;
        });
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
        setTaskManager(prev => {
            const next = prev.filter(t => t.appId !== appId);
            Meteor.callAsync('updateWorkspace', next.map(toDbApp));
            return next;
        });
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
        const maxIndex = Math.max(0, ...taskManagerRef.current.map(el => el.zIndex)) + 1;
        setTaskManager(prev => {
            const next = prev.map(task => {
                if (task.appId !== appId) return task;
                if (task.fullScreen) {
                    return { ...task, bBox: { ...task.prevbBox }, fullScreen: false, zIndex: maxIndex };
                } else {
                    return { ...task, fullScreen: true, zIndex: maxIndex, prevbBox: { ...task.bBox }, bBox: { x: 0, y: 0, width: width - 4, height: height - 55 } };
                }
            });
            Meteor.callAsync('updateWorkspace', next.map(toDbApp));
            return next;
        });
    }
    const updateSize=(appId:number, w:number, h:number)=>{
        setTaskManager(prev => {
            const next = prev.map(t => t.appId === appId ? { ...t, bBox: { ...t.bBox, width: w, height: h } } : t);
            Meteor.callAsync('updateWorkspace', next.map(toDbApp));
            return next;
        });
    }
    const updatePossition=(appId:number, x:number, y:number)=>{
        x = x || 0;
        y = y || 0;
        setTaskManager(prev => {
            const next = prev.map(t => t.appId === appId ? { ...t, bBox: { ...t.bBox, x, y } } : t);
            Meteor.callAsync('updateWorkspace', next.map(toDbApp));
            return next;
        });
    }
    type ExtraConfig = {
        cam?:Cam,
        [k:string]:any
    }
    const launchApp = (appName:string, extraConfigs?:ExtraConfig)=>{
        const icon = Icons.find(i=>i.appName === appName)
        if(icon){
            const appId = (new Date()).getTime()
            setTaskManager(prev => {
                const maxZindex = (prev.length > 0 ? Math.max(...prev.map(task => task.zIndex)) : 1) + 1;
                const newTask: Task = {
                    appId,
                    appIcon: icon.appIcon,
                    appName: icon.appName,
                    render: (props) => icon.render({ ...props, extraConfigs, launchApp: (...a) => launchAppRef.current(...a), killApp: (id) => toCloseRef.current(id) }),
                    minimized: false,
                    zIndex: maxZindex,
                    fullScreen: false,
                    bBox: { x: Math.floor(width/4), y: Math.floor(height/4), width: Math.floor(width/2), height: Math.floor(height/2) },
                    prevbBox: { x: Math.floor(width/4), y: Math.floor(height/4), width: Math.floor(width/2), height: Math.floor(height/2) },
                    extraConfigs,
                };
                const next = [...prev, newTask];
                Meteor.callAsync('updateWorkspace', next.map(toDbApp));
                return next;
            });
        }
    }
    toCloseRef.current = toClose;
    launchAppRef.current = launchApp;
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
            {(UnseenPersonAlerts.length>0 || UnseenIntruders.length>0) &&(

                <Box sx={{ position: 'absolute', top: 10, right: 10, width: showAlerts ? '280px' : 'auto', zIndex: 1000 }}>
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
                                onClick={()=>{Meteor.callAsync('seenAllIntruders'); Meteor.callAsync('setAllAlertsSeen')}}
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
                {visibleIcons.map((icon, index)=>(
                
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
                <Box sx={{ minWidth:'200px', px:1, pb:1 }}>
                    <Typography variant='caption' sx={{ color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1 }}>Account</Typography>
                    <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mt:0.5 }}>
                        <Stack direction='row' alignItems='center' spacing={1}>
                            <Avatar sx={{ width:28, height:28, bgcolor:'#1a237e', fontSize:13 }}>
                                {(Meteor.user()?.username?.[0] ?? '?').toUpperCase()}
                            </Avatar>
                            <Typography sx={{ color:'#fff', fontWeight:500 }}>{Meteor.user()?.username ?? ''}</Typography>
                        </Stack>
                        <Button
                            size='small'
                            variant='outlined'
                            sx={{ color:'#fff', borderColor:'rgba(255,255,255,0.4)', ml:1, textTransform:'none', '&:hover':{ borderColor:'#fff', background:'rgba(255,255,255,0.08)' } }}
                            onClick={()=>{ setStartAnchorEl(null); Meteor.logout(); }}
                        >
                            Log out
                        </Button>
                    </Stack>
                </Box>
                <Divider sx={{ borderColor:'rgba(255,255,255,0.15)', mb:1 }}/>
                <Box sx={{ minWidth:'200px',maxHeight:'900px', overflowY:'auto', display:'flex',alignItems:'flex-end' }}>
                    <MenuList sx={{width:'100%'}}>
                        {visibleIcons.filter(icon => icon.appName.toLowerCase().includes(searchApp.toLowerCase())).map((icon, index)=>(
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