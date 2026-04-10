import * as React from 'react'
import { Meteor } from 'meteor/meteor';
import { useState, useEffect } from 'react';
import {QRCodeSVG} from 'qrcode.react';
import { useFind, useSubscribe } from 'meteor/react-meteor-data'
import { SettingsCollection, APIConfig} from '/imports/api/settings'
import {TgSessions} from '/imports/api/tgSessions'
// import { RolesCollection } from '/imports/api/roles';
import {
    Box,
    Grid,
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
    CardHeader
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
        <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb:2}}
            >
                <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                    Settings
                </Typography>
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
            </Grid>
    </Paper>
    )
}
const settingsApp:AppType ={
    appName: 'Settings',
    render: SettingsApp,
    appIcon: <Icon />
}
export default settingsApp;