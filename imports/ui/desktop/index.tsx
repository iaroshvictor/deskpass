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
import { ScenarioEventsV2Collection } from '/imports/api/scenarioModel';
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
import ThemeToggle from '../components/ThemeToggle';
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
    // The shadow colour follows the surface so labels stay readable on both
    // the light and the dark wallpaper.
    '--black-0': (theme.vars ?? theme).palette.surface.sunken,
    '--scale':'1rem',
    '--border-radius-1':'.375rem',
    '--svg-drop-shadow-color': (theme.vars ?? theme).palette.surface.sunken,
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
    color: (theme.vars ?? theme).palette.text.primary,
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
    backgroundColor: (theme.vars ?? theme).palette.background.default,
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
    zIndex: 1100,
    // Was a fixed translucent grey, which sat wrong on a light desktop.
    background: (theme.vars ?? theme).palette.background.paper,
    borderTop: `1px solid ${(theme.vars ?? theme).palette.divider}`,
    backdropFilter: 'blur(8px)',
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
        <Box  sx={{backgroundColor: 'rgba(from var(--mui-palette-background-paper) r g b / 0.82)', borderRadius: 2, p: 1, mb: 1, position:'relative' }} key={alertItem._id}>
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
/**
 * The taskbar clock.
 *
 * Its own component with its own state on purpose: the tick used to live in
 * Desktop, which renders every open application window, so the second hand
 * re-rendered the whole desktop once a second. Measured on the event archive,
 * that was about 250ms of work per tick with nothing on screen changing.
 */
const Clock = ({ format: pattern }: { format: string }) => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);
    return <>{format(now, pattern)}</>;
};

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
    useSubscribe('scenario_events_v2_unseen');
    const UnseenScenarioEvents = useFind(() => ScenarioEventsV2Collection.find({ seen: false }, { sort: { triggeredAt: -1 }, limit: 10 }));
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
    // start menu: focus the search box and scroll the app list down on open, so
    // the user can type straight away without clicking into the field.
    const startSearchRef = React.useRef<HTMLInputElement>(null);
    const startListRef = React.useRef<HTMLDivElement>(null);
    const { width, height} = windowDimensions()
    const [lastActive, setLastActive] =useState<number | null>(null)

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
            {(UnseenPersonAlerts.length>0 || UnseenIntruders.length>0 || UnseenScenarioEvents.length>0) &&(

                <Box sx={{
                    position: 'absolute', top: 10, right: 10,
                    width: showAlerts ? '280px' : 'auto', zIndex: 1000,
                    // stop above the taskbar (52px) and scroll instead of
                    // spilling off the screen
                    maxHeight: 'calc(100vh - 72px)', overflowY: 'auto', overflowX: 'hidden',
                }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <IconButton
                            size="small"
                            onClick={() => setShowAlerts(!showAlerts)}
                            sx={{
                                backgroundColor: 'rgba(from var(--mui-palette-background-paper) r g b / 0.82)',
                                color: 'warning.main',
                                '&:hover': { backgroundColor: 'rgba(from var(--mui-palette-background-paper) r g b / 0.96)' }
                            }}
                        >
                            {showAlerts ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                        {showAlerts && (
                            <Button
                                onClick={()=>{Meteor.callAsync('seenAllIntruders'); Meteor.callAsync('setAllAlertsSeen'); Meteor.callAsync('markScenarioEventsV2Seen')}}
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
                            {UnseenScenarioEvents.map((ev) => (
                                <Box key={ev._id} sx={{ backgroundColor: 'rgba(from var(--mui-palette-background-paper) r g b / 0.9)', borderLeft: 4,
                                    borderColor: `${ev.severity === 'critical' ? 'error' : ev.severity === 'info' ? 'info' : 'warning'}.main`,
                                    borderRadius: 2, p: 1, mb: 1, position: 'relative' }}>
                                    <Fab size="small" color="secondary" sx={{ position: 'absolute', top: -5, right: -5 }}
                                        onClick={() => Meteor.callAsync('markScenarioEventsV2Seen', [ev._id])}>
                                        <DisabledVisibleIcon />
                                    </Fab>
                                    <Typography variant="body2" sx={{ color: 'text.primary', pr: 3 }}>{ev.message}</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        {Cams.find(c => c._id === ev.camId)?.name || ev.camId} · {new Date(ev.triggeredAt).toLocaleTimeString()}
                                    </Typography>
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
                                <Box sx={{backgroundColor: 'rgba(from var(--mui-palette-background-paper) r g b / 0.82)', borderRadius: 2, p: 1, mb: 1, position:'relative' }} key={intruder._id || index}>
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
                <Box sx={{ display: 'flex', position:'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', zIndex:9999, backgroundColor:'rgba(0, 0, 0, 0.55)' }}>
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
        <Stack direction='row' spacing={{ xs: 1, sm: 2 }} alignItems='center' sx={{ width: '100%', minWidth: 0 }}>
            <Button
                sx={{ width: '48px', flexShrink: 0, background: 'primary.main', '&:hover': { background: 'primary.dark' } }}
                onClick={(e)=>{
                    setStartAnchorEl(e.currentTarget);
                }}
            >
                <SitemarkIcon width={32} height={32} color='currentColor' />
            </Button>
            <Popover
                open={Boolean(startAnchorEl)}
                anchorReference="anchorPosition"
                anchorPosition={{ top: window.innerHeight - 56, left: 8 }}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                onClose={()=>{ setStartAnchorEl(null); setSearchApp(''); }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                // after the menu animates in: scroll the app list to the bottom and
                // put the caret in the search box so typing filters immediately.
                TransitionProps={{
                    onEntered: () => {
                        if (startListRef.current) {
                            startListRef.current.scrollTop = startListRef.current.scrollHeight;
                        }
                        startSearchRef.current?.focus();
                    },
                }}
                slotProps={{
                    paper: {
                        sx: {
                            // viewport-relative so the menu can never run off the top of
                            // the screen (56px taskbar + 16px breathing room).
                            maxHeight: 'calc(100vh - 72px)',
                            width: 288,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            background: 'rgba(from var(--mui-palette-background-paper) r g b / 0.94)',
                            backdropFilter: 'blur(14px)',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            boxShadow: '0 16px 48px rgba(0,0,0,.65)',
                            p: 0,
                        },
                    },
                }}
            >
                <Box sx={{ flexShrink:0, px:2, pt:1.75, pb:1.25 }}>
                    <Typography variant='caption' sx={{ color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1 }}>Account</Typography>
                    <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mt:0.5 }}>
                        <Stack direction='row' alignItems='center' spacing={1}>
                            <Avatar sx={{ width:28, height:28, bgcolor:'primary.main', color:'primary.contrastText', fontSize:13 }}>
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
                <Divider sx={{ borderColor: 'divider' }}/>
                {/* the only scrolling region — flex:1 + minHeight:0 lets it shrink
                    inside the vh-capped paper so the search stays pinned below */}
                <Box ref={startListRef} sx={{
                    flex:1, minHeight:0, overflowY:'auto',
                    '&::-webkit-scrollbar':{ width:6 },
                    '&::-webkit-scrollbar-thumb':{ background:'rgba(255,255,255,0.18)', borderRadius:3 },
                    '&::-webkit-scrollbar-thumb:hover':{ background:'rgba(255,255,255,0.3)' },
                }}>
                    <MenuList autoFocusItem={false} sx={{width:'100%', py:0.5}}>
                        {visibleIcons.filter(icon => icon.appName.toLowerCase().includes(searchApp.toLowerCase())).map((icon, index)=>(
                            <MenuItem sx={{
                                borderRadius:1, mx:0.5, px:1, py:0.75, minHeight:0,
                                '&:hover':{ background:'rgba(255,255,255,0.09)' },
                            }} key={index} onClick={()=>{
                                launchApp(icon.appName)
                                setStartAnchorEl(null)
                                setSearchApp('')
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
                <Divider sx={{ borderColor: 'divider' }}/>
                {/* pinned below the scroll area — always reachable, never clipped */}
                <Box sx={{ flexShrink:0, p:1.25 }}>
                    <TextField
                        inputRef={startSearchRef}
                        autoFocus
                        placeholder='Search app'
                        variant='standard'
                        fullWidth
                        value={searchApp}
                        onChange={(e)=>setSearchApp(e.target.value)}
                        InputProps={{ disableUnderline:true }}
                        sx={{
                            px:1.25, py:0.5,
                            background:'rgba(255,255,255,0.07)',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius:1.5,
                            input:{ color:'#fff', fontSize:14, padding:0 },
                            '& input::placeholder':{ color:'rgba(255,255,255,0.45)', opacity:1 },
                            '&:focus-within':{ borderColor:'rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.1)' },
                        }}
                    />
                </Box>
            </Popover>
            <Divider orientation="vertical" flexItem sx={{ flexShrink: 0 }} />
            <Stack
                direction='row'
                spacing={{ xs: 1, sm: 2 }}
                sx={{
                    flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden',
                    // a scrollbar inside a 52px bar would eat the buttons
                    scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                }}
            >
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
                        } sx={{
                            width: '48px', minWidth: '48px', flexShrink: 0,
                            backgroundColor: task.minimized ? 'action.hover'
                                : lastActive === task.appId ? 'action.selected'
                                : 'action.disabledBackground',
                            // the active window is marked by the underline, which
                            // reads on either scheme
                            borderBottom: '2px solid',
                            borderBottomColor: lastActive === task.appId ? 'primary.main' : 'transparent',
                        }}>
                        {task.appIcon}
                    </Button>
                ))}
               
            </Stack>
            <Divider orientation="vertical" flexItem sx={{ flexShrink: 0 }} />
            <Tooltip title={apolloStatus?.message || 'Apollo API Status'}>
                <Chip
                    size="small"
                    icon={
                        apolloStatus?.status === 'connected' ? <CloudIcon sx={{ color: 'text.primary' }} /> :
                        apolloStatus?.status === 'connecting' ? <SyncIcon sx={{ color: 'text.primary', animation: 'spin 1s linear infinite' }} /> :
                        apolloStatus?.status === 'auth_error' ? <ErrorIcon sx={{ color: 'text.primary' }} /> :
                        <CloudOffIcon sx={{ color: 'text.primary' }} />
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
                        flexShrink: 0,
                        '& .MuiChip-label': { display: { xs: 'none', sm: 'block' } },
                        backgroundColor:
                            apolloStatus?.status === 'connected' ? 'success.main' :
                            apolloStatus?.status === 'connecting' ? 'warning.main' :
                            apolloStatus?.status === 'auth_error' ? 'error.main' :
                            'text.secondary',
                        color: 'background.default',
                        '& .MuiChip-icon': { color: 'background.default', mx: { xs: 0.5, sm: undefined } },
                        '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' }
                        }
                    }}
                />
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ flexShrink: 0 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <ThemeToggle />
            </Box>
            <Divider orientation="vertical" flexItem sx={{ flexShrink: 0 }} />
            <Box sx={{ pr: { xs: 0.5, sm: 2 }, textAlign: 'center', flexShrink: 0 }}>
                <Typography color='text.primary' variant='subtitle2' noWrap>
                    <Clock format='HH:mm:ss' />
                </Typography>
                {/* the date is the first thing to go when the bar runs out of room */}
                <Typography color='text.primary' variant='subtitle2' noWrap
                    sx={{ display: { xs: 'none', sm: 'block' } }}>
                     <Clock format='dd MMMM' />
                </Typography>
            </Box>
        </Stack>
        </AppBar>
    </OsBox>
    )
}