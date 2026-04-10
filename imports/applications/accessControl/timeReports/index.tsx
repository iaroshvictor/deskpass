import * as React from 'react';
import { AppType } from "../..";
import Icon from './icon';

const TimeReportsApp: AppType = {
    appName: 'Time Reports',
    appIcon: <Icon />,
    render: () => <div>Time Reports (to be implemented)</div>,
    module: 'accessControl',
};

export default TimeReportsApp;
