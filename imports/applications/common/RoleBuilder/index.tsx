import { AppType } from '../..';
import * as React from 'react';
import {
    Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button,
    TextField, Fab, FormGroup, FormControlLabel, Checkbox, Typography, Box, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { RoleDefinitionsCollection, RoleDefinition } from '/imports/api/roles';
import Icon from './icon';

const APP_GROUPS: { label: string; apps: string[] }[] = [
    {
        label: 'Common',
        apps: ['Zones', 'Cam Config', 'Live Stream', 'Faces Stream', 'Persons Database', 'Enroll New Person', 'Models Management', 'Task Manager', 'DVR'],
    },
    {
        label: 'Access Control',
        apps: ['Controllers', 'Gates', 'Gates Control', 'Access permissions', 'Divisions Management', 'Attendance Archive', 'Time Reports', 'Schedule Control', 'Temporary Cards', 'Intruder Alerts'],
    },
    {
        label: 'Person Alert',
        apps: ['Person lists', 'Alerts Archive'],
    },
    {
        label: 'Analytics',
        apps: ['Heatmaps', 'Traffic Timeline', 'Counting Charts', 'Heat Maps'],
    },
];

const ALL_APPS = APP_GROUPS.flatMap(g => g.apps);

const emptyForm = { name: '', permissions: [] as string[] };

const RoleBuilderRender = () => {
    useSubscribe('roleDefinitions');
    const roles = useFind(() => RoleDefinitionsCollection.find());

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<RoleDefinition | null>(null);
    const [form, setForm] = React.useState(emptyForm);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (role: RoleDefinition) => {
        setEditing(role);
        setForm({ name: role.name, permissions: [...role.permissions] });
        setDialogOpen(true);
    };

    const handleClose = () => setDialogOpen(false);

    const togglePermission = (appName: string) => {
        setForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(appName)
                ? prev.permissions.filter(p => p !== appName)
                : [...prev.permissions, appName],
        }));
    };

    const selectAll = (apps: string[]) => {
        setForm(prev => {
            const toAdd = apps.filter(a => !prev.permissions.includes(a));
            return { ...prev, permissions: [...prev.permissions, ...toAdd] };
        });
    };

    const deselectAll = (apps: string[]) => {
        setForm(prev => ({
            ...prev,
            permissions: prev.permissions.filter(p => !apps.includes(p)),
        }));
    };

    const handleSave = () => {
        if (!form.name.trim()) return;
        if (editing) {
            Meteor.call('roleDefinitions.update', editing._id, { name: form.name.trim(), permissions: form.permissions }, (err: any) => {
                if (err) console.error(err);
            });
        } else {
            Meteor.call('roleDefinitions.insert', { name: form.name.trim(), permissions: form.permissions }, (err: any) => {
                if (err) console.error(err);
            });
        }
        setDialogOpen(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Delete this role? Operators assigned to it will lose their permissions.')) {
            Meteor.call('roleDefinitions.remove', id, (err: any) => {
                if (err) console.error(err);
            });
        }
    };

    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Role Name</TableCell>
                            <TableCell>Allowed Apps</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {roles.map(role => (
                            <TableRow key={role._id}>
                                <TableCell>{role.name}</TableCell>
                                <TableCell>{role.permissions.length} / {ALL_APPS.length}</TableCell>
                                <TableCell>
                                    <IconButton size="small" onClick={() => openEdit(role)}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(role._id!)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>{editing ? `Edit Role: ${editing.name}` : 'Create New Role'}</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        autoFocus
                        required
                        label="Role Name"
                        fullWidth
                        variant="standard"
                        value={form.name}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        sx={{ mb: 2 }}
                    />
                    <Typography variant="subtitle2" gutterBottom>Permissions</Typography>
                    {APP_GROUPS.map(group => (
                        <Box key={group.label} sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                    {group.label}
                                </Typography>
                                <Button size="small" onClick={() => selectAll(group.apps)} sx={{ minWidth: 0, px: 0.5, fontSize: '0.65rem' }}>All</Button>
                                <Button size="small" onClick={() => deselectAll(group.apps)} sx={{ minWidth: 0, px: 0.5, fontSize: '0.65rem' }}>None</Button>
                            </Box>
                            <FormGroup row>
                                {group.apps.map(app => (
                                    <FormControlLabel
                                        key={app}
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={form.permissions.includes(app)}
                                                onChange={() => togglePermission(app)}
                                            />
                                        }
                                        label={<Typography variant="body2">{app}</Typography>}
                                        sx={{ width: '48%' }}
                                    />
                                ))}
                            </FormGroup>
                            <Divider sx={{ mt: 0.5 }} />
                        </Box>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
                </DialogActions>
            </Dialog>

            <Fab color="primary" aria-label="add" onClick={openCreate} sx={{ position: 'absolute', bottom: 16, right: 16 }}>
                <AddIcon />
            </Fab>
        </Paper>
    );
};

const RoleBuilderApp: AppType = {
    appName: 'Role Builder',
    appIcon: <Icon />,
    render: RoleBuilderRender,
    module: 'common',
};

export default RoleBuilderApp;
