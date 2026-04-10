import * as React from 'react';
import { AppType } from "../..";
import Icon from './icon';

const CountingChartsApp: AppType = {
    appName: 'Counting Charts',
    appIcon: <Icon />,
    render: function CountingCharts() {
        return <div>Counting Charts (to be implemented)</div>;
    },
    module: 'personCount',
};

export default CountingChartsApp;
