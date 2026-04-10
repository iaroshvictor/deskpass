import * as React from 'react';
import { AppType, AppProps } from "../..";
import Icon from './icon';
import {
    Paper,
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { WorkspacesCollection, App } from '/imports/api/workspace';

function TaskManagerRenderer(props: AppProps) {
    useSubscribe('workspace');
    const myWorkspace = useFind(() => WorkspacesCollection.find());

    const apps = myWorkspace?.[0]?.apps || [];

    const handleKillApp = (appId: number) => {
        if (props.killApp) {
            props.killApp(appId);
        }
    };

    const killAllApps = () => {
        apps.forEach((app: App) => {
            if (props.killApp) {
                props.killApp(app.appId);
            }
        });
    };

    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Running Applications</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip 
                        label={`${apps.length} running`} 
                        color="primary" 
                        size="small" 
                    />
                    {apps.length > 0 && (
                        <IconButton 
                            size="small" 
                            color="error" 
                            onClick={killAllApps}
                            title="Kill all apps"
                        >
                            <CloseIcon />
                        </IconButton>
                    )}
                </Stack>
            </Stack>
            
            {apps.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="textSecondary">No applications running</Typography>
                </Box>
            ) : (
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>App Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Position</TableCell>
                            <TableCell>Size</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {apps.map((app: App) => (
                            <TableRow key={app.appId}>
                                <TableCell>
                                    <Typography variant="body2">{app.appName}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip 
                                        label={app.minimized ? 'Minimized' : app.fullScreen ? 'Full Screen' : 'Normal'} 
                                        size="small"
                                        color={app.minimized ? 'default' : app.fullScreen ? 'success' : 'primary'}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" color="textSecondary">
                                        x: {app.bBox.x}, y: {app.bBox.y}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" color="textSecondary">
                                        {app.bBox.width} × {app.bBox.height}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleKillApp(app.appId)}
                                        title="Kill this app"
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Paper>
    );
}

const TaskManagerApp: AppType = {
    appName: 'Task Manager',
    appIcon: <Icon />,
    render: TaskManagerRenderer,
};

export default TaskManagerApp;

