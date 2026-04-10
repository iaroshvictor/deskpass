import * as React from 'react';
import { AppType } from "../..";
import Icon from './icon';

const HeatMapsApp: AppType = {
    appName: 'Heat Maps',
    appIcon: <Icon  />,
    render: function HeatMaps() {
        return <div>Heat Maps (to be implemented)</div>;
    },
    module: 'personCount',
};

export default HeatMapsApp;
