import * as React from 'react';
import { useState } from 'react';
import { AppType } from "../..";
import Icon from './icon';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { GatesCollection } from '/imports/api/gates';
import { ZonesCollection } from '/imports/api/zones';
import { Meteor } from 'meteor/meteor';
import {
    Box,
    Card,
    CardContent,
    CardActions,
    Typography,
    Button,
    Grid,
    Alert,
    Snackbar,
    CircularProgress,
    Chip,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';

const GatesControlRenderer = () => {
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState<string | null>(null); // Store the gate ID being unlocked
    const [error, setError] = useState<string | null>(null);

    // Subscribe to data
    useSubscribe('gates');
    useSubscribe('zones');

    // Get data
    const gates = useFind(() => GatesCollection.find({}), []);
    const zones = useFind(() => ZonesCollection.find({}), []);

    const getZoneName = (zoneId: string): string => {
        const zone = zones.find(z => z._id === zoneId);
        return zone ? zone.name : 'Unknown Zone';
    };

    const handleUnlock = async (gateId: string) => {
        setLoading(gateId);
        setError(null);
        try {
            await Meteor.callAsync('unlockGate', gateId);
            setMessage('Gate unlocked successfully!');
        } catch (err: any) {
            setError(err.message || 'Failed to unlock gate');
        } finally {
            setLoading(null);
        }
    };

    const handleCloseMessage = () => {
        setMessage(null);
        setError(null);
    };

    return (
        <Box sx={{ p: 2 }}>
            {gates.length === 0 ? (
                <Alert severity="info">
                    No gates configured. Please configure gates first.
                </Alert>
            ) : (
                <Grid container spacing={2}>
                    {gates.map((gate) => (
                        <Grid size={{ xs: 12, md: 4, lg: 3 }} key={gate._id}>
                            <Card 
                                raised 
                                sx={{ 
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    opacity: !gate.apacsId ? 0.6 : 1
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6" gutterBottom>
                                        {gate.name}
                                    </Typography>
                                    <Chip 
                                        label={getZoneName(gate.zone)} 
                                        size="small" 
                                        sx={{ mb: 1 }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Interfaces: {gate.interfaces.length}
                                    </Typography>
                                    {gate.apacsId && (
                                        <Typography variant="caption" color="text.secondary">
                                            APACS ID: {gate.apacsId}
                                        </Typography>
                                    )}
                                    {!gate.apacsId && (
                                        <Typography variant="caption" color="error">
                                            No APACS ID configured
                                        </Typography>
                                    )}
                                </CardContent>
                                <CardActions>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="primary"
                                        startIcon={loading === gate._id ? <CircularProgress size={20} /> : <LockOpenIcon />}
                                        onClick={() => gate._id && handleUnlock(gate._id)}
                                        disabled={!gate.apacsId || loading === gate._id}
                                    >
                                        {loading === gate._id ? 'Unlocking...' : 'Unlock'}
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Snackbar
                open={!!message}
                autoHideDuration={3000}
                onClose={handleCloseMessage}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseMessage} severity="success" sx={{ width: '100%' }}>
                    {message}
                </Alert>
            </Snackbar>

            <Snackbar
                open={!!error}
                autoHideDuration={5000}
                onClose={handleCloseMessage}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseMessage} severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>
        </Box>
    );
};

const GatesControlApp: AppType = {
    appName: 'Gates Control',
    render: GatesControlRenderer,
    appIcon: <Icon />,
    module: 'accessControl'
};

export default GatesControlApp;

