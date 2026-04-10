import * as React from 'react'
import { Cam } from '../api/cams'
export type ExtraConfig = {
    cam?:Cam,
    [key:string]:any
}
export type AppProps={
    launchApp?:(appName:string, extraConfigs?:ExtraConfig)=>void
    killApp?:(appId:number)=>void
    extraConfigs?:{
        cam?:Cam,
        [key:string]:any
    }
}
export type AppType={
    appName:string,
    appIcon:React.JSX.Element,
    render:(prop:AppProps)=>React.JSX.Element
    hideShortcut?:boolean,
    module?:string
}

import CommonApps from './common';
import PersonAlertApps from './personAlert';
import PersonCountApps from './personCount';
import AccessControlApps from './accessControl';
import MetrixApps from './metrix';
export default {...CommonApps, ...PersonAlertApps, ...PersonCountApps, ...AccessControlApps, ...MetrixApps};