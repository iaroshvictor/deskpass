import { Mongo } from 'meteor/mongo';

export type App={
    appId:number,
    appName: string,
    minimized:boolean,
    zIndex:number,
    fullScreen:boolean,
    bBox:{
        x:number,
        y:number,
        width:number,
        height:number
    },
    extraConfigs?:{
        [key:string]:any
    }
}

export interface Workspace {
    _id?: string
    user: string
    apps: App[]
}
export const WorkspacesCollection = new Mongo.Collection<Workspace>('workspaces');