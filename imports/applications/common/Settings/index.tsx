import * as React from 'react'
import { Meteor } from 'meteor/meteor';
import { useState, useEffect } from 'react';
import {QRCodeSVG} from 'qrcode.react';
import { useFind, useSubscribe } from 'meteor/react-meteor-data'
import { SettingsCollection, APIConfig, DVRConfig, DVR_DEFAULTS } from '/imports/api/settings'
import {TgSessions} from '/imports/api/tgSessions'
// import { RolesCollection } from '/imports/api/roles';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Stack,
    Link,
    TextField,
    Button,
    TableContainer,
    Snackbar,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    CardHeader,
    Tabs,
    Tab,
    Switch,
    FormControlLabel,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Divider
} from '@mui/material'
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import { AppType } from '../..';
import Icon from './icon'
import {  } from '/imports/api/settings';
const SettingsApp = () => { 
        useSubscribe('settings')
    const tgSettings = useFind(()=>SettingsCollection.find({type:"telegram"}))
    const apacsSettings = useFind(()=>SettingsCollection.find({type:"apacs"}))
    const [tgBot, setTgBot] = useState <string>('')
    const [config, setConfig] = useState <APIConfig>({url:'', username:'', password:''})
    const [botLink, setBotLink] = useState <string>('')
    const [message, setMessage] = useState <string | null>(null)
    const [tab, setTab] = useState(0)
    const dvrSettings = useFind(()=>SettingsCollection.find({type:"dvr"}))
    const [dvr, setDvr] = useState<DVRConfig>(DVR_DEFAULTS)

    useSubscribe('users')
    useSubscribe('tgSessions')
    useEffect(()=>{
        if(tgSettings.length > 0){
            setTgBot(tgSettings[0].config as string)  
        }

    },[tgSettings])
     useEffect(()=>{
        if(apacsSettings.length > 0){
            setConfig(apacsSettings[0].config as APIConfig)
        }

    },[apacsSettings])
    useEffect(()=>{
        if(dvrSettings.length > 0){
            setDvr(dvrSettings[0].config as DVRConfig)
        }
    },[dvrSettings])
    useEffect(()=>{
        Meteor.callAsync('getBotLink').then(r=>setBotLink(r))
    })
    const onSubmit = ()=>{
        Meteor.callAsync('setTgBot', tgBot).then((_r)=>{setMessage('Bot token updated')}).catch((error:any)=>{
            setMessage(error.reason)
        })
    }
    const onSubmitApacs = ()=>{
        Meteor.callAsync('setApacsConfig', config).then((_r)=>{setMessage('APACS configuration updated')}).catch((error:any)=>{
            setMessage(error.reason)
        })
    }
    const onSubmitDvr = ()=>{
        Meteor.callAsync('setDvrConfig', dvr).then(()=>{setMessage('DVR configuration updated')}).catch((error:any)=>{
            setMessage(error.reason || error.message || 'Failed to save DVR configuration')
        })
    }
    const onClyckApolloSync = ()=>{
        Meteor.callAsync('doApolloSync').then((_r)=>{setMessage('APACS sync started')}).catch((error:any)=>{
            setMessage(error.reason)
        })
    }
    const users=useFind(()=>Meteor.users.find())
    // const roles = useFind(()=>RolesCollection.find())
    const sessions = useFind(()=>TgSessions.find())
    return (
    <Paper sx={{minHeight:'100%',p:2,boxSizing:'border-box'}}>
        <Snackbar
            open={!!message}
            autoHideDuration={6000}
            onClose={()=>{setMessage(null)}}
            message={message || ''}
        />
        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                    Settings
                </Typography>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
                        <Tab label="Telegram" />
                        <Tab label="APACS" />
                        <Tab label="DVR" />
                    </Tabs>
                </Box>

                {tab === 0 && (
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                Telegram configuration
                            </Typography>
                            <Stack spacing={2} direction='column' sx={{ justifyContent: 'space-between' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    to create a new bot talk to <Link target='_blank' href='https://t.me/BotFather'>Botfather</Link>
                                </Typography>
                                <Stack
                                    component={Paper}
                                    sx={{mt:2, p:2}}
                                    direction="row"
                                    spacing={2}
                                >
                                    <TextField sx={{width:'100%'}} label="token" value={tgBot} onChange={(e)=>setTgBot(e.target.value)} />
                                    <Button variant='contained' onClick={onSubmit}>Save</Button>
                                </Stack>

                                {tgSettings &&(
                                    <Stack direction = 'row' spacing={2} sx={{alignItems:'center'}}>
                                        {botLink && (
                                            <Box component={Paper} sx={{p:2}}>
                                                 <QRCodeSVG value ={`https://t.me/${botLink}`} />
                                            </Box>

                                        )}
                                    <TableContainer sx={{mt:2}} component={Paper}>
                                        <Table sx={{ minWidth: 650 }} aria-label="simple table">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Username</TableCell>
                                                    <TableCell align="right">Subscribed</TableCell>
                                                    <TableCell align="right">Role</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {users.map((user) => (
                                                    <TableRow
                                                    key={user._id}
                                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                                    >
                                                        <TableCell component="th" scope="row">
                                                            {user.username}
                                                        </TableCell>
                                                        <TableCell align="right">{sessions.filter(session=>session.userId === user._id).length>0?<CheckBoxIcon />:<IndeterminateCheckBoxIcon />}</TableCell>
                                                        <TableCell align="right">Administrator</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Stack>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                )}

                {tab === 1 && (
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardHeader
                            title="APACS configuration"
                            avatar={<Icon />}
                            subheader='Make a full sync with APACS'
                            action={<Button variant='contained' onClick={onClyckApolloSync}>Make full sync</Button>}
                        />
                        <CardContent>
                            <Stack
                                component={Paper}
                                sx={{mt:2, p:2}}
                                direction="row"
                                spacing={2}
                            >
                                <TextField
                                    sx={{width:'100%'}}
                                    label="APACS server address"
                                    placeholder='http://xxx.xxx.xxx:8080'
                                    variant="outlined" size="small"
                                    value={config.url}
                                    onChange={(e)=>setConfig(prev=>({...prev, url:e.target.value}))}
                                />
                                <TextField
                                    sx={{width:'100%'}}
                                    label="APACS username"
                                    variant="outlined"
                                    size="small"
                                    value={config.username}
                                    onChange={(e)=>setConfig(prev=>({...prev, username:e.target.value}))}
                                />
                                <TextField
                                    sx={{width:'100%'}}
                                    label="APACS password"
                                    variant="outlined"
                                    type='passord'
                                    size="small"
                                    value={config.password}
                                    onChange={(e)=>setConfig(prev=>({...prev, password:e.target.value}))}
                                />
                                <Button variant='contained' onClick={onSubmitApacs}>Save</Button>
                            </Stack>
                        </CardContent>
                    </Card>
                )}

                {tab === 2 && (
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardHeader
                            title="DVR configuration"
                            subheader="Configure stream recording and storage"
                            action={
                                <FormControlLabel
                                    control={<Switch checked={dvr.enabled} onChange={(e)=>setDvr(prev=>({...prev, enabled:e.target.checked}))} />}
                                    label="Enable recording"
                                    labelPlacement="start"
                                />
                            }
                        />
                        <CardContent>
                            <Stack spacing={3}>
                                <Stack component={Paper} sx={{p:2}} spacing={2}>
                                    <Typography variant="subtitle2">Storage</Typography>
                                    <Stack direction="row" spacing={2}>
                                        <TextField
                                            sx={{flex:2}}
                                            label="Storage path"
                                            placeholder="/var/recordings"
                                            size="small"
                                            value={dvr.storagePath}
                                            onChange={(e)=>setDvr(prev=>({...prev, storagePath:e.target.value}))}
                                        />
                                        <TextField
                                            sx={{flex:1}}
                                            label="Retention (days)"
                                            type="number"
                                            size="small"
                                            inputProps={{min:1}}
                                            value={dvr.retentionDays}
                                            onChange={(e)=>setDvr(prev=>({...prev, retentionDays:Number(e.target.value)}))}
                                        />
                                        <TextField
                                            sx={{flex:1}}
                                            label="Max storage (GB)"
                                            type="number"
                                            size="small"
                                            inputProps={{min:1}}
                                            value={dvr.maxStorageGB}
                                            onChange={(e)=>setDvr(prev=>({...prev, maxStorageGB:Number(e.target.value)}))}
                                        />
                                    </Stack>
                                    <Typography variant="caption" sx={{color:'text.secondary'}}>
                                        Recordings are deleted when either the retention period or the storage cap is reached — whichever comes first.
                                    </Typography>
                                </Stack>

                                <Stack component={Paper} sx={{p:2}} spacing={2}>
                                    <Typography variant="subtitle2">Stream</Typography>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <FormControl size="small" sx={{minWidth:180}}>
                                            <InputLabel>Stream to record</InputLabel>
                                            <Select
                                                label="Stream to record"
                                                value={dvr.streamSource}
                                                onChange={(e)=>setDvr(prev=>({...prev, streamSource:e.target.value as DVRConfig['streamSource']}))}
                                            >
                                                <MenuItem value="original">Original</MenuItem>
                                                <MenuItem value="ai">AI (annotated)</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <Divider orientation="vertical" flexItem />
                                        <FormControlLabel
                                            control={<Switch checked={dvr.camFallback} onChange={(e)=>setDvr(prev=>({...prev, camFallback:e.target.checked}))} />}
                                            label="Camera stream fallback"
                                        />
                                    </Stack>
                                    <Typography variant="caption" sx={{color:'text.secondary'}}>
                                        Fallback switches to the raw camera stream if the selected source becomes unavailable.
                                    </Typography>
                                </Stack>

                                <Box sx={{display:'flex', justifyContent:'flex-end'}}>
                                    <Button variant="contained" onClick={onSubmitDvr}>Save</Button>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                )}
    </Paper>
    )
}
const settingsApp:AppType ={
    appName: 'Settings',
    render: SettingsApp,
    appIcon: <Icon />
}
export default settingsApp;