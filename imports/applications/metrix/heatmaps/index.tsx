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
    Box
} from '@mui/material';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { CamsCollection, Cam } from '/imports/api/cams';
import DateRangePicker from 'rsuite/DateRangePicker';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { HeatmapData, HeatmapPoint } from './serverMethods';

const { useState, useRef, useEffect } = React;

interface HeatmapCanvasProps {
    data: HeatmapData;
}

const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !data.snapshot) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Load the snapshot image
        const img = new Image();
        img.onload = () => {
            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;

            // Calculate scale factors to map detection coordinates to snapshot coordinates
            // Detection pipeline uses detectionWidth x detectionHeight (e.g., 1920x1080)
            // Snapshot may have different dimensions
            const scaleX = img.width / data.detectionWidth;
            const scaleY = img.height / data.detectionHeight;

            // Draw the snapshot
            ctx.drawImage(img, 0, 0);

            // Draw heatmap overlay with scaled points
            drawHeatmap(ctx, data.points, img.width, img.height, scaleX, scaleY);
        };
        img.src = `data:image/jpeg;base64,${data.snapshot}`;
    }, [data]);

    const drawHeatmap = (
        ctx: CanvasRenderingContext2D,
        points: HeatmapPoint[],
        width: number,
        height: number,
        scaleX: number,
        scaleY: number
    ) => {
        if (points.length === 0) return;

        // Create a temporary canvas for the heatmap
        const heatmapCanvas = document.createElement('canvas');
        heatmapCanvas.width = width;
        heatmapCanvas.height = height;
        const heatCtx = heatmapCanvas.getContext('2d');
        if (!heatCtx) return;

        // Draw each point as a radial gradient
        const radius = Math.max(width, height) * 0.03; // 3% of image size

        points.forEach(point => {
            // Scale the point coordinates from detection frame to snapshot dimensions
            const scaledX = point.x * scaleX;
            const scaledY = point.y * scaleY;

            const gradient = heatCtx.createRadialGradient(
                scaledX, scaledY, 0,
                scaledX, scaledY, radius
            );
            gradient.addColorStop(0, `rgba(255, 0, 0, ${point.intensity * 0.8})`);
            gradient.addColorStop(0.5, `rgba(255, 165, 0, ${point.intensity * 0.5})`);
            gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');

            heatCtx.fillStyle = gradient;
            heatCtx.beginPath();
            heatCtx.arc(scaledX, scaledY, radius, 0, Math.PI * 2);
            heatCtx.fill();
        });

        // Apply the heatmap overlay with blending
        ctx.globalAlpha = 0.6;
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(heatmapCanvas, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    };

    return (
        <Box ref={containerRef} sx={{ width: '100%', overflow: 'auto' }}>
            <canvas
                ref={canvasRef}
                style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
            />
        </Box>
    );
};

function HeatmapsRenderer() {
    useSubscribe('cams');
    const cams = useFind(() => CamsCollection.find({}));

    const [selectedCam, setSelectedCam] = useState<Cam | null>(null);
    const [dateRange, setDateRange] = useState<[Date, Date] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
    const [visitCount, setVisitCount] = useState<number | null>(null);

    const handleGenerate = async () => {
        if (!selectedCam?._id || !dateRange) {
            setError('Please select a camera and date range');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await Meteor.callAsync(
                'getHeatmapData',
                selectedCam._id,
                dateRange[0],
                dateRange[1]
            ) as HeatmapData;
            setHeatmapData(data);
            setVisitCount(data.points.length);
        } catch (err: any) {
            setError(err.reason || err.message || 'Failed to generate heatmap');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{ p: 2, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
            <Stack spacing={2}>
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
                        format="dd.MM.yy HH:mm:ss"
                        caretAs={CalendarMonthIcon}
                        size="lg"
                        onChange={(value) => setDateRange(value as [Date, Date] | null)}
                        style={{ width: 280 }}
                    />
                    <Button variant="contained" onClick={handleGenerate} disabled={loading || !selectedCam || !dateRange}>
                        {loading ? <CircularProgress size={24} /> : 'Generate Heatmap'}
                    </Button>
                    {visitCount !== null && (<Alert severity="info" sx={{ py: 0 }}>{visitCount} data points</Alert>)}
                </Stack>
                {error && <Alert severity="error">{error}</Alert>}
                {heatmapData && <HeatmapCanvas data={heatmapData} />}
            </Stack>
        </Paper>
    );
}

const HeatmapsApp: AppType = {
    appName: 'Heatmaps',
    appIcon: <Icon />,
    render: HeatmapsRenderer,
    module: 'metrix'
};
export default HeatmapsApp;

