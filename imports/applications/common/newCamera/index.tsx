import * as React from 'react';
import { AppType } from "../..";
import { NewCamIcon } from './icon';
import NewCamAppRender from './newCam';
import EditCamAppRender from './editCam';
const NewCamApp:AppType ={
    appName: 'Add cctv',
    render: NewCamAppRender,
    appIcon: <NewCamIcon />
}
const EditCamApp:AppType ={
    appName: 'Edit cctv',
    render: EditCamAppRender,
    appIcon: <NewCamIcon />,
    hideShortcut: true

}
export { NewCamApp };
export { EditCamApp };
export default {NewCamApp, EditCamApp};