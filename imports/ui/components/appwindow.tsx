import * as React from 'react'
import { useEffect, useState, useRef } from 'react';
import {Rnd} from 'react-rnd'
import {Box, Stack, Typography, ButtonGroup, IconButton} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';

type Props = {
    children: React.JSX.Element
    appTitle: string
    appIcon : React.JSX.Element
    minimized:boolean
    bBox :{
        x:number,
        y:number,
        width:number,
        height:number
    }
    fullScreen:boolean
    appId:number
    minimize:(appId:number)=>void
    killTask:(appId:number)=>void
    triggerFullScreen:(appId:number)=>void,
    updateSize:(appId:number, width:number,height:number)=>void
    updatePossition:(appId:number, x:number,y:number)=>void
    bringToTop:(appId:number)=>void
    zIndex:number
}
import windowDimensions from '../../hooks/windowSize'
export default function AppWindow({children, appTitle, appIcon, minimized,fullScreen, bBox, zIndex, minimize, killTask, triggerFullScreen,updatePossition, updateSize, bringToTop, appId}: Props) {
    const {width, height} = windowDimensions()
    const [isMounted, setIsMounted ] =useState(true);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const duration=200
    useEffect(() => {
        if (minimized) {
            timeoutRef.current = setTimeout(() => {
                setIsMounted(false);
            }, duration);
        } else {
            setIsMounted(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [minimized]);
    return(
        <Rnd
            style={{zIndex, display:isMounted?'block':'none'}}
            position={bBox}
            size={bBox}
            dragHandleClassName='appTopBar'
            onClick={()=>{
                bringToTop(appId)
            }}
            onResizeStart={()=>{
                bringToTop(appId)
                
                if(fullScreen){
                    triggerFullScreen(appId)
                    updatePossition(appId, 0, 0)
                    updateSize(appId, width-4, height-55)
                }
            }}
            onResize={(_e, _direction, ref, _delta, position)=>{
                updateSize(appId, ref.offsetWidth, ref.offsetHeight )
                updatePossition(appId, position.x, position.y)
            }}
            onDragStart={()=>{
                bringToTop(appId)
                if(fullScreen){
                    triggerFullScreen(appId)
                }
            }}
            onDragStop={(_e, d)=>{
                updatePossition(appId, d.x, d.y)
            }}
        >
            <Box className='window' sx={{
              opacity: !minimized ? 1 : 0,
              transition: `opacity ${duration}ms ease-in-out`,
            }}>
                <Box className="appTopBar" sx={{p:0.5, background:'black', cursor:'grab'}}>
                    <Stack sx={{width:'100%'}} direction='row' onDoubleClick={()=>{triggerFullScreen(appId)}}>
                        {appIcon}
                        <Typography sx={{ml:1, width:'100%'}} variant='subtitle2'>{appTitle}</Typography>
                        <ButtonGroup size="small" aria-label="Small button group">
                            <IconButton onClick={() => minimize(appId)} sx={{p:'0 8px'}}>
                                <MinimizeIcon color='primary' />
                            </IconButton>
                            <IconButton onClick={()=>{triggerFullScreen(appId)}} sx={{p:'0 8px'}}>
                                {fullScreen ? <CloseFullscreenIcon color='primary' />:<OpenInFullIcon color='primary' /> }
                            </IconButton>
                            <IconButton onClick={()=>{killTask(appId)}} sx={{p:'0 8px'}}>
                                <CloseIcon color='primary' />
                            </IconButton>
                        </ButtonGroup>
                    </Stack>
                </Box>
                <Box className="appContent" sx={{p:1, after:{content:'""',position:'absolute',bottom:0, right:0,width:'3px', height:'3px',background:'white'}}}> {children} </Box>
            </Box>
        </Rnd>
    )
}