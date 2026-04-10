import * as React from 'react';
import { AppType } from "../..";
import Icon from './icon'

const ScheduleControlApp: AppType = {
    appName: 'Schedule Control',
    appIcon: <Icon />,
    render: () => <div>Schedule Control (to be implemented)</div>,
    module: 'accessControl',
};

export default ScheduleControlApp;
