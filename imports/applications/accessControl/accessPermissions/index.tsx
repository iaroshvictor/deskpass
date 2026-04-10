import * as React from 'react';
import { useState } from 'react';
import { AppType } from "../..";
import Icon from './icon';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { ZonesCollection } from '/imports/api/zones';
import { GatesCollection } from '/imports/api/gates';
import { VisitsSummaryCollection, VisitSummaryMetaCollection, SummaryMeta, VisitSummary } from '/imports/api/visitSummary';
import { DivisionsCollection } from '/imports/api/divisions';
import { Meteor } from 'meteor/meteor';
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Grid,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Stack,
    TextField,
    Typography,
    CircularProgress,
    Alert,
    Button,
    Chip,
    Autocomplete,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import GateIcon from '@mui/icons-material/Apartment';
import ZoneIcon from '@mui/icons-material/LocationOn';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const AccessPermissionsComponent = () => {
    const [selectedGateId, setSelectedGateId] = useState<string>('');
    const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
    const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const limit = 10000;
    const skip = 0;

    // Subscribe to data
    useSubscribe('zones');
    useSubscribe('gates');
    useSubscribe('visitSummaryMeta');
    useSubscribe('divisions');

    // Memoize filter to prevent infinite re-renders
    const pageFilter = React.useMemo(() => ({ 'idInfo.cA': true }), []);
    useSubscribe('visitssummary', pageFilter, limit, skip, { timestamp: -1 });

    // Get data
    const zones = useFind(() => ZonesCollection.find({}), []);
    const gates = useFind(() => GatesCollection.find({}), []);
    const personMeta = useFind(() => VisitSummaryMetaCollection.find({}), []);
    const persons = useFind(() => VisitsSummaryCollection.find(pageFilter, { sort: { timestamp: -1 } }), [pageFilter]);
    const divisions = useFind(() => DivisionsCollection.find({}), []);

    // Get selected gate info
    const selectedGate = React.useMemo(() => {
        return gates.find(g => g._id === selectedGateId);
    }, [gates, selectedGateId]);

    // Get zone name for selected gate
    const selectedZone = React.useMemo(() => {
        if (!selectedGate) return null;
        return zones.find(z => z._id === selectedGate.zone);
    }, [selectedGate, zones]);

    // Get selected persons from meta
    const selectedPersons = React.useMemo(() => {
        return personMeta.filter(p => selectedPersonIds.includes(p._id || ''));
    }, [personMeta, selectedPersonIds]);

    // Separate persons into allowed and denied (filtered by selected persons and division if any)
    const { allowedPersons, deniedPersons } = React.useMemo(() => {
        if (!selectedGateId) return { allowedPersons: [], deniedPersons: [] };

        let personsToShow: (SummaryMeta | VisitSummary)[] = selectedPersonIds.length > 0 ? selectedPersons : persons;

        // Filter by division if selected
        if (selectedDivisionId) {
            personsToShow = personsToShow.filter(p => p.idInfo?.divission === selectedDivisionId);
        }

        const allowed = personsToShow.filter(p => p.idInfo?.allowedGates?.includes(selectedGateId));
        const denied = personsToShow.filter(p => !p.idInfo?.allowedGates?.includes(selectedGateId));

        return { allowedPersons: allowed, deniedPersons: denied };
    }, [persons, selectedGateId, selectedPersons, selectedPersonIds, selectedDivisionId]);

    // Handle moving persons from denied to allowed
    const handleMoveToAllowed = async (personIds: string[]) => {
        if (!selectedGateId) return;

        try {
            setLoading(true);
            for (const personId of personIds) {
                const person = persons.find(p => p._id === personId);
                if (person) {
                    const currentAllowed = person.idInfo?.allowedGates || [];
                    if (!currentAllowed.includes(selectedGateId)) {
                        const updated = [...currentAllowed, selectedGateId];
                        await Meteor.callAsync('updatePersonAllowedGates', personId, updated);
                    }
                }
            }
            setMessage('Persons moved to allowed list');
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error moving persons:', error);
            setMessage('Error moving persons');
        } finally {
            setLoading(false);
        }
    };

    // Handle moving persons from allowed to denied
    const handleMoveToDenied = async (personIds: string[]) => {
        if (!selectedGateId) return;

        try {
            setLoading(true);
            for (const personId of personIds) {
                const person = persons.find(p => p._id === personId);
                if (person) {
                    const currentAllowed = person.idInfo?.allowedGates || [];
                    const updated = currentAllowed.filter(gateId => gateId !== selectedGateId);
                    await Meteor.callAsync('updatePersonAllowedGates', personId, updated);
                }
            }
            setMessage('Persons moved to denied list');
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error moving persons:', error);
            setMessage('Error moving persons');
        } finally {
            setLoading(false);
        }
    };

    // Handle granting access to all denied persons
    const handleGrantAll = async () => {
        if (!selectedGateId) return;
        const personIds = deniedPersons.map(p => p._id || '');
        await handleMoveToAllowed(personIds);
    };

    // Handle denying access to all allowed persons
    const handleDenyAll = async () => {
        if (!selectedGateId) return;
        const personIds = allowedPersons.map(p => p._id || '');
        await handleMoveToDenied(personIds);
    };

    if (!zones || !gates || !persons) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Gate Selection */}
            <Card sx={{ mb: 3 }}>
                <CardHeader title="Select Gate" avatar={<GateIcon />} />
                <Divider />
                <CardContent>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Zone</Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                {zones.filter(z => z.parent === 'root').map(zone => (
                                    <Chip
                                        key={zone._id}
                                        label={zone.name}
                                        variant="outlined"
                                        icon={<ZoneIcon />}
                                    />
                                ))}
                            </Stack>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Gate</Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                {gates.map(gate => (
                                    <Chip
                                        key={gate._id}
                                        label={gate.name}
                                        onClick={() => setSelectedGateId(gate._id || '')}
                                        color={selectedGateId === gate._id ? 'primary' : 'default'}
                                        variant={selectedGateId === gate._id ? 'filled' : 'outlined'}
                                        icon={<GateIcon />}
                                    />
                                ))}
                            </Stack>
                        </Box>
                        {selectedGate && selectedZone && (
                            <Alert severity="info">
                                Selected: <strong>{selectedZone.name}</strong> → <strong>{selectedGate.name}</strong>
                            </Alert>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* Persons Card with Filters and Lists */}
            {selectedGateId && (
                <Card sx={{ mb: 3 }}>
                    <CardHeader title="Persons" avatar={<PersonIcon />} />
                    <Divider />
                    <CardContent>
                        {/* Division Filter */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Division</Typography>
                            <Autocomplete
                                sx={{ width: '100%' }}
                                options={divisions}
                                getOptionKey={(option) => option._id || ''}
                                getOptionLabel={(option) => option.name || ''}
                                renderInput={(params) => <TextField {...params} label="Select Division" variant="outlined" />}
                                value={divisions.find(d => d._id === selectedDivisionId) || null}
                                onChange={(_event, value) => {
                                    setSelectedDivisionId(value?._id || '');
                                }}
                            />
                        </Box>

                        {/* Person Filter */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Persons</Typography>
                            <Autocomplete
                                sx={{ width: '100%' }}
                                options={personMeta}
                                getOptionKey={(option) => `meta${option._id || ''}`}
                                getOptionLabel={(option) => `${option.idInfo?.firstName || ''} ${option.idInfo?.lastName || ''}`}
                                renderInput={(params) => <TextField {...params} label="Filter Persons" variant="outlined" />}
                                multiple
                                value={selectedPersons}
                                onChange={(_event, value) => {
                                    setSelectedPersonIds(value.map(v => v._id || ''));
                                }}
                            />
                        </Box>

                        {/* Allowed and Denied Lists */}
                        <Grid sx={{width:'100%'}} container spacing={2}>
                            {/* Allowed Persons */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Card>
                                    <CardHeader
                                        title={`Allowed (${allowedPersons.length})`}
                                        avatar={<PersonIcon />}
                                        action={
                                            <Button
                                                size="small"
                                                onClick={handleDenyAll}
                                                disabled={loading || allowedPersons.length === 0}
                                                variant="outlined"
                                                color="error"
                                            >
                                                Deny All
                                            </Button>
                                        }
                                        sx={{ backgroundColor: '#e8f5e9' }}
                                    />
                                    <Divider />
                                    <CardContent>
                                        <List sx={{ maxHeight: '500px', overflow: 'auto' }}>
                                            {allowedPersons.length === 0 ? (
                                                <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
                                                    No allowed persons
                                                </Typography>
                                            ) : (
                                                allowedPersons.map(person => (
                                                    <ListItem
                                                        key={person._id}
                                                        secondaryAction={
                                                            <Button
                                                                size="small"
                                                                onClick={() => handleMoveToDenied([person._id])}
                                                                disabled={loading}
                                                            >
                                                                <ArrowForwardIcon fontSize="small" />
                                                            </Button>
                                                        }
                                                    >
                                                        <ListItemIcon>
                                                            <PersonIcon />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={`${person.idInfo?.firstName} ${person.idInfo?.lastName}`}
                                                            secondary={person.idInfo?.comment}
                                                        />
                                                    </ListItem>
                                                ))
                                            )}
                                        </List>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Denied Persons */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Card>
                                    <CardHeader
                                        title={`Denied (${deniedPersons.length})`}
                                        avatar={<PersonIcon />}
                                        action={
                                            <Button
                                                size="small"
                                                onClick={handleGrantAll}
                                                disabled={loading || deniedPersons.length === 0}
                                                variant="outlined"
                                                color="success"
                                            >
                                                Grant All
                                            </Button>
                                        }
                                        sx={{ backgroundColor: '#ffebee' }}
                                    />
                                    <Divider />
                                    <CardContent>
                                        <List sx={{ maxHeight: '500px', overflow: 'auto' }}>
                                            {deniedPersons.length === 0 ? (
                                                <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
                                                    No denied persons
                                                </Typography>
                                            ) : (
                                                deniedPersons.map(person => (
                                                    <ListItem
                                                        key={person._id}
                                                        secondaryAction={
                                                            <Button
                                                                size="small"
                                                                onClick={() => handleMoveToAllowed([person._id])}
                                                                disabled={loading}
                                                            >
                                                                <ArrowBackIcon fontSize="small" />
                                                            </Button>
                                                        }
                                                    >
                                                        <ListItemIcon>
                                                            <PersonIcon />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={`${person.idInfo?.firstName} ${person.idInfo?.lastName}`}
                                                            secondary={person.idInfo?.comment}
                                                        />
                                                    </ListItem>
                                                ))
                                            )}
                                        </List>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Message */}
            {message && (
                <Alert severity="success" sx={{ mt: 2 }}>
                    {message}
                </Alert>
            )}
        </Box>
    );
};

const AccessPermissionsApp: AppType = {
    appName: 'Access permissions',
    appIcon: <Icon />,
    render: () => <AccessPermissionsComponent />,
    module: 'accessControl',
};

export default AccessPermissionsApp;
