import * as React from 'react';
import { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { AppType } from '../..';
import Icon from './icon';
import {
    Paper,
    Box,
    Typography,
    TextField,
    Button,
    Autocomplete,
    Stack,
    Divider,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Snackbar,
    Pagination,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { VisitSummaryMetaCollection, SummaryMeta } from '/imports/api/visitSummary';
import { TemporaryCardsCollection, TemporaryCard } from '/imports/api/temporaryCards';
import { UsersMetaCollection } from '/imports/api/operatorsMeta';

const TemporaryCardsRenderer = () => {
    const [selectedPerson, setSelectedPerson] = useState<SummaryMeta | null>(null);
    const [cardNumber, setCardNumber] = useState<string>('');
    const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [personFilter, setPersonFilter] = useState<SummaryMeta[]>([]);
    const [skip, setSkip] = useState<number>(0);
    const [numPages, setNumPages] = useState<number>(0);
    const limit = 100;

    // Build filter for temporary cards - memoize to prevent infinite re-renders
    const personFilterIds = React.useMemo(() => personFilter.map(p => p._id), [personFilter]);
    const filter = React.useMemo(() => {
        const f: { [key: string]: any } = {};
        if (statusFilter !== 'all') {
            f.status = statusFilter;
        }
        if (personFilterIds.length > 0) {
            f.personId = { $in: personFilterIds };
        }
        return f;
    }, [statusFilter, personFilterIds]);

    useSubscribe('visitSummaryMeta');
    useSubscribe('temporaryCards', filter, limit, skip, { attachedAt: -1 });
    useSubscribe('usersMeta');

    // Get only persons with cA: true (Access Control members)
    const accessControlPersons = useFind(() =>
        VisitSummaryMetaCollection.find({ 'idInfo.cA': true }), []
    );
    const temporaryCards = useFind(() => TemporaryCardsCollection.find(filter), [filter]);
    const allPersonsMeta = useFind(() => VisitSummaryMetaCollection.find({}), []);
    const allUsers = useFind(() => UsersMetaCollection.find({}), []);

    // Count total for pagination
    React.useEffect(() => {
        Meteor.callAsync('countTemporaryCards', filter).then((count: number) => {
            setNumPages(Math.ceil(count / limit));
        });
    }, [filter]);

    const handleAttachCard = async () => {
        if (!selectedPerson || !cardNumber.trim()) {
            setMessage({ text: 'Please select a person and enter a card number.', severity: 'error' });
            return;
        }

        try {
            await Meteor.callAsync('attachTemporaryCard', selectedPerson._id, cardNumber.trim());
            setMessage({ text: 'Temporary card attached successfully!', severity: 'success' });
            setCardNumber('');
            setSelectedPerson(null);
        } catch (error: any) {
            setMessage({ text: error.reason || 'Failed to attach temporary card.', severity: 'error' });
        }
    };

    const handleRemoveCard = async (cardId: string) => {
        try {
            await Meteor.callAsync('removeTemporaryCard', cardId);
            setMessage({ text: 'Temporary card removed successfully!', severity: 'success' });
        } catch (error: any) {
            setMessage({ text: error.reason || 'Failed to remove temporary card.', severity: 'error' });
        }
    };

    const getPersonName = (personId: string) => {
        const person = allPersonsMeta.find(p => p._id === personId);
        if (!person) return 'Unknown';
        return `${person.idInfo?.firstName || ''} ${person.idInfo?.lastName || ''}`.trim() || 'Unknown';
    };

    const getAttachedByName = (userId: string) => {
        const user = allUsers.find(u => u._id === userId);
        return user?.username || 'Unknown';
    };

    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Temporary Cards Management</Typography>
            
            {/* Attach Card Form */}
            <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>Attach Temporary Card</Typography>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Autocomplete
                        sx={{ width: '50%' }}
                        options={accessControlPersons}
                        getOptionKey={(option) => option._id || ''}
                        getOptionLabel={(option) => 
                            `${option.idInfo?.firstName || ''} ${option.idInfo?.lastName || ''}`.trim()
                        }
                        renderInput={(params) => (
                            <TextField {...params} label="Select Person (Access Control Members)" variant="outlined" />
                        )}
                        value={selectedPerson}
                        onChange={(_event, value) => setSelectedPerson(value)}
                    />
                    <TextField
                        sx={{ width: '30%' }}
                        label="Card Number"
                        variant="outlined"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                    />
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleAttachCard}
                        sx={{ height: '56px' }}
                    >
                        Attach Card
                    </Button>
                </Stack>
                <Alert severity="info" sx={{ mt: 2 }}>
                    Temporary cards are valid for one day only. They will be automatically removed at the end of the day.
                </Alert>
            </Paper>

            <Divider sx={{ mb: 3 }} />

            {/* Filters */}
            <Typography variant="subtitle1" sx={{ mb: 2 }}>Temporary Cards List</Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <FormControl sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                        value={statusFilter}
                        label="Status"
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="attached">Attached</MenuItem>
                        <MenuItem value="removed">Removed</MenuItem>
                    </Select>
                </FormControl>
                <Autocomplete
                    sx={{ width: '50%' }}
                    multiple
                    options={allPersonsMeta}
                    getOptionKey={(option) => option._id || ''}
                    getOptionLabel={(option) =>
                        `${option.idInfo?.firstName || ''} ${option.idInfo?.lastName || ''}`.trim()
                    }
                    renderInput={(params) => (
                        <TextField {...params} label="Filter by Person" variant="outlined" />
                    )}
                    value={personFilter}
                    onChange={(_event, value) => setPersonFilter(value)}
                />
            </Stack>

            {/* Table */}
            <Paper elevation={3}>
                {temporaryCards.length > 0 ? (
                    <>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Person</TableCell>
                                    <TableCell>Card Number</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Attached At</TableCell>
                                    <TableCell>Attached By</TableCell>
                                    <TableCell>Removed At</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {temporaryCards.map((card: TemporaryCard) => (
                                    <TableRow key={card._id}>
                                        <TableCell>{getPersonName(card.personId)}</TableCell>
                                        <TableCell>{card.cardNumber}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={card.status}
                                                color={card.status === 'attached' ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{card.attachedAt?.toLocaleString()}</TableCell>
                                        <TableCell>{getAttachedByName(card.attachedBy)}</TableCell>
                                        <TableCell>
                                            {card.removedAt ? card.removedAt.toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {card.status === 'attached' && (
                                                <IconButton
                                                    color="error"
                                                    onClick={() => handleRemoveCard(card._id!)}
                                                    title="Remove card"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                            <Pagination
                                count={numPages}
                                color="primary"
                                page={(skip + limit) / limit}
                                onChange={(_e, v) => setSkip((v - 1) * limit)}
                            />
                        </Box>
                    </>
                ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="textSecondary">No temporary cards found.</Typography>
                    </Box>
                )}
            </Paper>

            <Snackbar
                open={!!message}
                autoHideDuration={6000}
                onClose={() => setMessage(null)}
            >
                <Alert
                    onClose={() => setMessage(null)}
                    severity={message?.severity || 'info'}
                    sx={{ width: '100%' }}
                >
                    {message?.text}
                </Alert>
            </Snackbar>
        </Paper>
    );
};

const TemporaryCardsApp: AppType = {
    appName: 'Temporary Cards',
    appIcon: <Icon />,
    render: () => <TemporaryCardsRenderer />,
    module: 'accessControl',
};

export default TemporaryCardsApp;

