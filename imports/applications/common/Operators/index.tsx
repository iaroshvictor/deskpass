
import { AppType } from "../..";
import React from "react";
import { Paper } from "@mui/material";
import Icon from './icon';
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
const OperatorsRender = () => {
    useSubscribe('allUsers');
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [selectedPerson, setSelectedPerson] = React.useState<string | null>(null);
    const [selectedItemDialog, setSelectedItemDialog] = React.useState<Meteor.User | null>(null);
    const operators = useFind(() => Meteor.users.find());
    const handleEditClick = () => {
        setOpenEdit(true);
    }
    const [openEdit, setOpenEdit] = React.useState(false);
    const [openAdd, setOpenAdd] = React.useState(false);
    const handleCloseEdit = () => {
        setOpenEdit(false);
    }
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;

        if (selectedItemDialog) {
            Meteor.call('operators.update', selectedItemDialog._id, { username: username, password: password }, (error:any) => {
                if (error) {
                    console.error("Error updating user:", error);
                } else {
                    console.log("User updated successfully");
                }
            });
        }
        setOpenEdit(false);
    }
    const deleteOperator = () => {
        if (selectedPerson) {
            if(window.confirm("Are you sure you want to delete this operator?")) {
                Meteor.call('operators.remove', selectedPerson, (error:any) => {
                    if (error) {
                        console.error("Error deleting user:", error);
                    } else {
                        console.log("User deleted successfully");
                    }
                });
            }
        }
    }
    const handleSubmitAdd = (e: React.FormEvent<HTMLFormElement>)=>{
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;

        Meteor.call('operators.insert', { username, password }, (error:any) => {
            if (error) {
                console.error("Error adding user:", error);
            } else {
                console.log("User added successfully");
            }
        });
        setOpenAdd(false);
    }
    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Username</TableCell>
                            <TableCell>Roles</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {operators.map((user) => (
                            <TableRow key={user._id}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>admin</TableCell>
                                <TableCell><IconButton onClick={(e)=>{
                                    setMenuAnchorEl(e.target as HTMLElement);
                                    setSelectedPerson(user._id||'');
                                    setSelectedItemDialog(user);

                                }}><MoreVertIcon/></IconButton>
                                </TableCell>
                                    
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {menuAnchorEl &&(
                <Menu
                    id="long-menu"
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={()=>{
                        setMenuAnchorEl(null);
                        setSelectedPerson(null);
                    }}
                    slotProps={{
                    paper: {
                        style: {
                        maxHeight: 48 * 4.5,
                        width: '20ch',
                        },
                    },
                    list: {
                        'aria-labelledby': 'long-button',
                    },
                    }}
                >
                        
                    <MenuItem onClick={handleEditClick}>
                        Edit
                    </MenuItem>
                    <MenuItem onClick={()=>{
                        deleteOperator()
                        setMenuAnchorEl(null);
                        setSelectedPerson(null);
                    }}>
                        Delete
                    </MenuItem>
                </Menu>
            )}
            <Dialog open={openEdit} onClose={handleCloseEdit}>
                <DialogTitle>Edit operator {selectedItemDialog?.username}</DialogTitle>
                <DialogContent sx={{ paddingBottom: 0 }}>
                <DialogContentText>
                    To edit this operator, please enter the new username/password here.
                </DialogContentText>
                <form onSubmit={handleSubmit}>
                    <TextField
                        autoFocus
                        required
                        margin="dense"
                        id="username"
                        name="username"
                        label="Username"
                        type="text"
                        defaultValue={selectedItemDialog?.username || ''}
                        fullWidth
                        variant="standard"
                    />
                    <TextField
                        autoFocus
                        margin="dense"
                        id="password"
                        name="password"
                        label="Password"
                        type="password"
                        fullWidth
                        variant="standard"
                    />
                    <DialogActions>
                    <Button onClick={handleCloseEdit}>Cancel</Button>
                    <Button type="submit">Save</Button>
                    </DialogActions>
                </form>
                </DialogContent>
            </Dialog>
            <Dialog open={openAdd} onClose={()=>{setOpenAdd(false);}}>
                <DialogTitle>Add new Operator</DialogTitle>
                <DialogContent sx={{ paddingBottom: 0 }}>
                <DialogContentText>
                    To add a new operator, please enter the username/password here.
                </DialogContentText>
                <form onSubmit={handleSubmitAdd}>
                    <TextField
                        autoFocus
                        required
                        margin="dense"
                        id="username"
                        name="username"
                        label="Username"
                        type="text"
                        fullWidth
                        variant="standard"
                    />
                    <TextField
                        autoFocus
                        required
                        margin="dense"
                        id="password"
                        name="password"
                        label="Password"
                        type="password"
                        fullWidth
                        variant="standard"
                    />
                    <DialogActions>
                    <Button onClick={()=>{setOpenAdd(false);}}>Cancel</Button>
                    <Button type="submit">Save</Button>
                    </DialogActions>
                </form>
                </DialogContent>
            </Dialog>
            <Fab color="primary" aria-label="add" onClick={()=>{setOpenAdd(true);}} sx={{position: 'absolute', bottom: 16, right: 16 }}>
                <AddIcon />
            </Fab>
        </Paper>
    );
}

const Operators: AppType = {
    appName: 'Operators',
    appIcon: <Icon />,
    render: OperatorsRender,
    module: 'personAlert',
};
export default Operators;
