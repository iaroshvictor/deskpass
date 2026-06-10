import { AppType } from '../..';
import React from 'react';
import { Paper } from '@mui/material';
import Icon from './icon';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import TextField from '@mui/material/TextField';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import { RolesCollection, RoleDefinitionsCollection } from '/imports/api/roles';

const OperatorsRender = () => {
    useSubscribe('allUsers');
    useSubscribe('allRoles');
    useSubscribe('roleDefinitions');

    const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [selectedPerson, setSelectedPerson] = React.useState<string | null>(null);
    const [selectedItemDialog, setSelectedItemDialog] = React.useState<Meteor.User | null>(null);
    const [openEdit, setOpenEdit] = React.useState(false);
    const [openAdd, setOpenAdd] = React.useState(false);
    const [editRoleId, setEditRoleId] = React.useState<string>('admin');
    const [addRoleId, setAddRoleId] = React.useState<string>('admin');

    const operators = useFind(() => Meteor.users.find());
    const allRoles = useFind(() => RolesCollection.find());
    const roleDefinitions = useFind(() => RoleDefinitionsCollection.find());

    const getRoleName = (userId: string) => {
        const entry = allRoles.find(r => r.userId === userId);
        if (!entry) return 'No Role';
        if (entry.role === 'admin') return 'Admin';
        if (entry.roleId) {
            const def = roleDefinitions.find(d => d._id === entry.roleId);
            return def?.name ?? 'Unknown Role';
        }
        return entry.role;
    };

    const handleEditClick = () => {
        const entry = allRoles.find(r => r.userId === selectedItemDialog?._id);
        setEditRoleId(entry?.role === 'admin' ? 'admin' : (entry?.roleId ?? 'admin'));
        setOpenEdit(true);
    };

    const handleCloseEdit = () => setOpenEdit(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;
        if (selectedItemDialog) {
            Meteor.call('operators.update', selectedItemDialog._id, { username, password, roleId: editRoleId }, (error: any) => {
                if (error) console.error('Error updating user:', error);
            });
        }
        setOpenEdit(false);
    };

    const deleteOperator = () => {
        if (selectedPerson) {
            if (window.confirm('Are you sure you want to delete this operator?')) {
                Meteor.call('operators.remove', selectedPerson, (error: any) => {
                    if (error) console.error('Error deleting user:', error);
                });
            }
        }
    };

    const handleSubmitAdd = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;
        Meteor.call('operators.insert', { username, password, roleId: addRoleId }, (error: any) => {
            if (error) console.error('Error adding user:', error);
        });
        setOpenAdd(false);
        setAddRoleId('admin');
    };

    const roleOptions = [
        { value: 'admin', label: 'Admin' },
        ...roleDefinitions.map(rd => ({ value: rd._id!, label: rd.name })),
    ];

    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Username</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {operators.map((user) => (
                            <TableRow key={user._id}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{getRoleName(user._id || '')}</TableCell>
                                <TableCell>
                                    <IconButton onClick={(e) => {
                                        setMenuAnchorEl(e.target as HTMLElement);
                                        setSelectedPerson(user._id || '');
                                        setSelectedItemDialog(user);
                                    }}>
                                        <MoreVertIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {menuAnchorEl && (
                <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={() => { setMenuAnchorEl(null); setSelectedPerson(null); }}
                    slotProps={{
                        paper: { style: { maxHeight: 48 * 4.5, width: '20ch' } },
                        list: { 'aria-labelledby': 'long-button' },
                    }}
                >
                    <MenuItem onClick={handleEditClick}>Edit</MenuItem>
                    <MenuItem onClick={() => { deleteOperator(); setMenuAnchorEl(null); setSelectedPerson(null); }}>
                        Delete
                    </MenuItem>
                </Menu>
            )}

            {/* Edit dialog */}
            <Dialog open={openEdit} onClose={handleCloseEdit}>
                <DialogTitle>Edit operator {selectedItemDialog?.username}</DialogTitle>
                <DialogContent sx={{ paddingBottom: 0 }}>
                    <DialogContentText>Update username, password, or role.</DialogContentText>
                    <form onSubmit={handleSubmit}>
                        <TextField
                            autoFocus
                            required
                            margin="dense"
                            name="username"
                            label="Username"
                            type="text"
                            defaultValue={selectedItemDialog?.username || ''}
                            fullWidth
                            variant="standard"
                        />
                        <TextField
                            margin="dense"
                            name="password"
                            label="Password (leave blank to keep current)"
                            type="password"
                            fullWidth
                            variant="standard"
                        />
                        <FormControl fullWidth variant="standard" margin="dense">
                            <InputLabel>Role</InputLabel>
                            <Select
                                native
                                value={editRoleId}
                                onChange={e => setEditRoleId(e.target.value as string)}
                                label="Role"
                            >
                                {roleOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </Select>
                        </FormControl>
                        <DialogActions>
                            <Button onClick={handleCloseEdit}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </DialogActions>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Add dialog */}
            <Dialog open={openAdd} onClose={() => setOpenAdd(false)}>
                <DialogTitle>Add new Operator</DialogTitle>
                <DialogContent sx={{ paddingBottom: 0 }}>
                    <DialogContentText>Enter credentials and assign a role.</DialogContentText>
                    <form onSubmit={handleSubmitAdd}>
                        <TextField
                            autoFocus
                            required
                            margin="dense"
                            name="username"
                            label="Username"
                            type="text"
                            fullWidth
                            variant="standard"
                        />
                        <TextField
                            required
                            margin="dense"
                            name="password"
                            label="Password"
                            type="password"
                            fullWidth
                            variant="standard"
                        />
                        <FormControl fullWidth variant="standard" margin="dense">
                            <InputLabel>Role</InputLabel>
                            <Select
                                native
                                value={addRoleId}
                                onChange={e => setAddRoleId(e.target.value as string)}
                                label="Role"
                            >
                                {roleOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </Select>
                        </FormControl>
                        <DialogActions>
                            <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </DialogActions>
                    </form>
                </DialogContent>
            </Dialog>

            <Fab color="primary" aria-label="add" onClick={() => setOpenAdd(true)} sx={{ position: 'absolute', bottom: 16, right: 16 }}>
                <AddIcon />
            </Fab>
        </Paper>
    );
};

const Operators: AppType = {
    appName: 'Operators',
    appIcon: <Icon />,
    render: OperatorsRender,
    module: 'personAlert',
};
export default Operators;
