import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import { AppType, AppProps } from "../..";
import Icon from './icon';
import {
    Paper,
    Box,
    Typography,
    IconButton,
    Chip,
    Stack,
    ImageList,
    ImageListItem,
    ImageListItemBar,
    Checkbox,
    Button,
    Snackbar,
    Divider,
    Pagination,
    TextField,
    ToggleButtonGroup,
    ToggleButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import PhotoIcon from '@mui/icons-material/Photo';
import EditIcon from '@mui/icons-material/Edit';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { VisitsCollection } from '/imports/api/visits';
import { VisitSummaryMetaCollection, SummaryMeta } from '/imports/api/visitSummary';
import IdentifyEdit from '/imports/applications/common/personsDatabase/indetifyEditForm';

const PERSONS_PER_PAGE = 50;

function ModelsManagementRenderer(_props: AppProps) {
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'az' | 'za' | 'photos'>('az');
    const [editPerson, setEditPerson] = useState<SummaryMeta | null>(null);
    const editFormRef = useRef<{ save: () => boolean; deleteSummary: () => boolean }>(null);

    useSubscribe('visitSummaryMeta');
    const personMeta = useFind(() => VisitSummaryMetaCollection.find({}), []);
    useSubscribe('visits', { reference:true }, 100000, 0, { tracking_id:1});
    const visits = useFind(() =>
        VisitsCollection.find(
            { reference:true },
            { sort: { tracking_id:1 } }
        ), []
    );

    const photoCountById = useMemo(() => {
        const map: Record<string, number> = {};
        visits.forEach(v => {
            const id = v.tracking_id || '';
            map[id] = (map[id] || 0) + 1;
        });
        return map;
    }, [visits]);

    const filteredPersons = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = q
            ? personMeta.filter(p => {
                const name = `${p?.idInfo?.firstName ?? ''} ${p?.idInfo?.lastName ?? ''}`.toLowerCase();
                return name.includes(q);
            })
            : [...personMeta];

        if (sortBy === 'az' || sortBy === 'za') {
            const dir = sortBy === 'az' ? 1 : -1;
            list.sort((a, b) => {
                const nameA = `${a?.idInfo?.firstName ?? ''} ${a?.idInfo?.lastName ?? ''}`.toLowerCase();
                const nameB = `${b?.idInfo?.firstName ?? ''} ${b?.idInfo?.lastName ?? ''}`.toLowerCase();
                return dir * nameA.localeCompare(nameB);
            });
        } else {
            list.sort((a, b) => (photoCountById[b._id] || 0) - (photoCountById[a._id] || 0));
        }
        return list;
    }, [personMeta, search, sortBy, photoCountById]);

    const toggleSelect = (visitId: string) => {
        setSelectedItems(prev =>
            prev.includes(visitId)
                ? prev.filter(id => id !== visitId)
                : [...prev, visitId]
        );
    };

    const selectAllInGroup = (modelId: string) => {
        const groupVisitIds = visits.filter(v => v.tracking_id === modelId).map(v => v._id || '');
        const allSelected = groupVisitIds.every(id => selectedItems.includes(id));
        if (allSelected) {
            setSelectedItems(prev => prev.filter(id => !groupVisitIds.includes(id)));
        } else {
            setSelectedItems(prev => [...new Set([...prev, ...groupVisitIds])]);
        }
    };

    const deleteSelected = async () => {
        if (selectedItems.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} photo(s)?`)) return;
        try {
            await Meteor.callAsync('removeVisitItems', selectedItems);
            setMessage(`Successfully deleted ${selectedItems.length} photo(s)`);
            setSelectedItems([]);
        } catch (e: any) {
            console.error('Error deleting photos:', e);
            setMessage('Error deleting photos: ' + e.message);
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleSort = (_e: React.MouseEvent, value: 'az' | 'photos' | null) => {
        if (value === null && sortBy !== 'photos') {
            setSortBy(prev => prev === 'az' ? 'za' : 'az');
            setPage(1);
        } else if (value === 'az') {
            setSortBy('az');
            setPage(1);
        } else if (value === 'photos') {
            setSortBy('photos');
            setPage(1);
        }
    };

    const openEditPerson = (person: SummaryMeta) => {
        setEditPerson(person);
    };

    const pagePersons = filteredPersons.slice((page - 1) * PERSONS_PER_PAGE, page * PERSONS_PER_PAGE);

    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box', overflow: 'auto' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Models Management</Typography>
                <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                        position:'fixed',
                        zIndex:5,
                        p:'6px',
                        backgroundColor:'#ffffff87',
                        right:'22px',
                        borderRadius:'4px'
                    }}
                >
                    <Chip label={`${visits.length} photos`} color="primary" size="small" />
                    <Chip label={`${personMeta.length} models`} color="secondary" size="small" />
                    {selectedItems.length > 0 && (
                        <Button
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={deleteSelected}
                        >
                            Delete ({selectedItems.length})
                        </Button>
                    )}
                </Stack>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <TextField
                    size="small"
                    placeholder="Search by name..."
                    value={search}
                    onChange={handleSearch}
                    sx={{ width: 220 }}
                />
                <ToggleButtonGroup
                    value={sortBy === 'photos' ? 'photos' : 'az'}
                    exclusive
                    onChange={handleSort}
                    size="small"
                >
                    <ToggleButton value="az" title={sortBy === 'az' ? 'Click for Z-A' : sortBy === 'za' ? 'Click for A-Z' : 'Sort A-Z'}>
                        <SortByAlphaIcon fontSize="small" sx={{ mr: 0.5 }} />
                        <Typography variant="caption" sx={{ fontWeight: 'bold', lineHeight: 1 }}>
                            {sortBy === 'za' ? 'Z-A' : 'A-Z'}
                        </Typography>
                    </ToggleButton>
                    <ToggleButton value="photos" title="Sort by photos">
                        <PhotoIcon fontSize="small" />
                    </ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {filteredPersons.length > PERSONS_PER_PAGE && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Pagination
                        count={Math.ceil(filteredPersons.length / PERSONS_PER_PAGE)}
                        page={page}
                        onChange={(_e, value) => { setPage(value); }}
                        color="primary"
                    />
                </Box>
            )}

            {filteredPersons.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="textSecondary">
                        {search ? 'No persons match your search' : 'No enrolled face photos found'}
                    </Typography>
                </Box>
            ) : (
                pagePersons.map(person => (
                    <Box key={person._id} sx={{ mb: 3 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            <Checkbox
                                checked={visits.filter(v=>v.tracking_id === person._id)?.every(v => selectedItems.includes(v._id || ''))}
                                indeterminate={
                                    visits.filter(v=>v.tracking_id === person._id)?.some(v => selectedItems.includes(v._id || '')) &&
                                    !visits.filter(v=>v.tracking_id === person._id)?.every(v => selectedItems.includes(v._id || ''))
                                }
                                onChange={() => selectAllInGroup(person._id)}
                            />
                            <Typography variant="subtitle1" fontWeight="bold">
                                Person: { person?.idInfo?.firstName + ' ' + person?.idInfo?.lastName }
                            </Typography>
                            <Chip label={`${photoCountById[person._id] || 0} photos`} size="small" />
                            <IconButton
                                size="small"
                                title="Edit person"
                                onClick={() => openEditPerson(person)}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                        <ImageList cols={6} rowHeight={140} gap={8}>
                            {visits.filter(v=>v.tracking_id === person._id)?.map(visit => (
                                <ImageListItem
                                    key={visit._id}
                                    sx={{
                                        cursor: 'pointer',
                                        border: selectedItems.includes(visit._id || '') ? '3px solid #1976d2' : '3px solid transparent',
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        background: '#f0f0f0',
                                    }}
                                    onClick={() => toggleSelect(visit._id || '')}
                                >
                                    <img
                                        src={`data:image/jpeg;base64,${visit.face_b64}`}
                                        alt="Face"
                                        loading="lazy"
                                        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                                    />
                                    <ImageListItemBar
                                        subtitle={visit.timestamp?.toLocaleString()}
                                        actionIcon={
                                            <IconButton
                                                sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelect(visit._id || '');
                                                }}
                                            >
                                                <Checkbox
                                                    checked={selectedItems.includes(visit._id || '')}
                                                    sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
                                                />
                                            </IconButton>
                                        }
                                    />
                                </ImageListItem>
                            ))}
                        </ImageList>
                        <Divider sx={{ mt: 2 }} />
                    </Box>
                ))
            )}
            {filteredPersons.length > PERSONS_PER_PAGE && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                        count={Math.ceil(filteredPersons.length / PERSONS_PER_PAGE)}
                        page={page}
                        onChange={(_e, value) => { setPage(value); }}
                        color="primary"
                    />
                </Box>
            )}

            {editPerson && (
                <Dialog open maxWidth="xl" fullWidth onClose={() => setEditPerson(null)}>
                    <DialogTitle>
                        <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        {editPerson.idInfo?.firstName
                            ? `${editPerson.idInfo.firstName} ${editPerson.idInfo.lastName}`
                            : 'Edit Person'}
                    </DialogTitle>
                    <DialogContent>
                        <IdentifyEdit ref={editFormRef} tracking_id={editPerson._id} visits={[]} />
                    </DialogContent>
                    <DialogActions>
                        <Button variant="contained" onClick={() => {
                            editFormRef.current?.save();
                            setMessage('Person saved successfully');
                            setEditPerson(null);
                        }}>Save</Button>
                        <Button onClick={() => setEditPerson(null)}>Close</Button>
                    </DialogActions>
                </Dialog>
            )}

            <Snackbar
                open={!!message}
                autoHideDuration={4000}
                onClose={() => setMessage(null)}
                message={message || ''}
            />
        </Paper>
    );
}

const ModelsManagementApp: AppType = {
    appName: 'Models Management',
    appIcon: <Icon />,
    render: ModelsManagementRenderer,
};

export default ModelsManagementApp;
