import * as React from 'react';
import { AppType } from '../..';
import Icon from './icon';
import {
    Paper,
    Stack,
    Autocomplete,
    TextField,
    Button,
    CircularProgress,
    Alert,
    Box,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { CamsCollection, Cam } from '/imports/api/cams';
import DateRangePicker from 'rsuite/DateRangePicker';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { TrafficTimelineData, TimeInterval } from './serverMethods';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const { useState } = React;

function TrafficTimelineRenderer() {
    useSubscribe('cams');
    const cams = useFind(() => CamsCollection.find({}));

    const [selectedCam, setSelectedCam] = useState<Cam | null>(null);
    const [dateRange, setDateRange] = useState<[Date, Date] | null>(null);
    const [interval, setInterval] = useState<TimeInterval>('1hour');
    const [chartType, setChartType] = useState<'line' | 'bar'>('bar');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timelineData, setTimelineData] = useState<TrafficTimelineData | null>(null);

    const handleGenerate = async () => {
        if (!selectedCam?._id || !dateRange) {
            setError('Please select a camera and date range');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await Meteor.callAsync(
                'getTrafficTimeline',
                selectedCam._id,
                dateRange[0],
                dateRange[1],
                interval
            ) as TrafficTimelineData;
            setTimelineData(data);
        } catch (err: any) {
            setError(err.reason || err.message || 'Failed to get timeline data');
        } finally {
            setLoading(false);
        }
    };

    const formatLabel = (date: Date): string => {
        const d = new Date(date);
        if (interval === '1day') {
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        }
        return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const chartData = timelineData ? {
        labels: timelineData.dataPoints.map(dp => formatLabel(dp.timestamp)),
        datasets: [{
            label: 'Unique Visitors',
            data: timelineData.dataPoints.map(dp => dp.count),
            borderColor: '#1976d2',
            backgroundColor: chartType === 'line' ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.7)',
            fill: chartType === 'line',
            tension: 0.3
        }]
    } : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: false }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Unique Visitors' } },
            x: { title: { display: true, text: 'Time' } }
        }
    };

    return (
        <Paper sx={{ p: 2, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
            <Stack spacing={2} sx={{ height: '100%' }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Autocomplete
                        options={cams}
                        getOptionLabel={(cam) => cam.name}
                        value={selectedCam}
                        onChange={(_, newValue) => setSelectedCam(newValue)}
                        sx={{ minWidth: 200 }}
                        renderInput={(params) => (
                            <TextField {...params} label="Select Camera" size="small" />
                        )}
                    />
                    <DateRangePicker
                        placeholder="Select date/time range"
                        format="dd.MM.yy HH:mm"
                        caretAs={CalendarMonthIcon}
                        size="lg"
                        onChange={(value) => setDateRange(value as [Date, Date] | null)}
                        style={{ width: 260 }}
                    />
                    <ToggleButtonGroup
                        value={interval}
                        exclusive
                        onChange={(_, v) => v && setInterval(v)}
                        size="small"
                    >
                        <ToggleButton value="5min">5m</ToggleButton>
                        <ToggleButton value="15min">15m</ToggleButton>
                        <ToggleButton value="30min">30m</ToggleButton>
                        <ToggleButton value="1hour">1h</ToggleButton>
                        <ToggleButton value="1day">1d</ToggleButton>
                    </ToggleButtonGroup>
                    <ToggleButtonGroup value={chartType} exclusive onChange={(_, v) => v && setChartType(v)} size="small">
                        <ToggleButton value="bar">Bar</ToggleButton>
                        <ToggleButton value="line">Line</ToggleButton>
                    </ToggleButtonGroup>
                    <Button variant="contained" onClick={handleGenerate} disabled={loading || !selectedCam || !dateRange}>
                        {loading ? <CircularProgress size={24} /> : 'Generate'}
                    </Button>
                </Stack>
                {error && <Alert severity="error">{error}</Alert>}
                {timelineData && (
                    <Alert severity="info" sx={{ py: 0 }}>
                        Total unique visitors: <strong>{timelineData.totalUniqueVisitors}</strong> | Data points: {timelineData.dataPoints.length}
                    </Alert>
                )}
                {chartData && (
                    <Box sx={{ flexGrow: 1, minHeight: 300 }}>
                        {chartType === 'line' ? <Line data={chartData} options={chartOptions} /> : <Bar data={chartData} options={chartOptions} />}
                    </Box>
                )}
            </Stack>
        </Paper>
    );
}

const TrafficTimelineApp: AppType = {
    appName: 'Traffic Timeline',
    appIcon: <Icon />,
    render: TrafficTimelineRenderer,
    module: 'metrix'
};
export default TrafficTimelineApp;

