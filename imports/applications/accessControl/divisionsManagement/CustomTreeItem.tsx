import * as React from 'react';
import { useState } from 'react';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import { Meteor } from 'meteor/meteor';
import {
  useTreeItem,
  UseTreeItemParameters,
} from '@mui/x-tree-view/useTreeItem';
import {
  TreeItemContent,
  TreeItemIconContainer,
  TreeItemGroupTransition,
  TreeItemLabel,
  TreeItemRoot,
  TreeItemCheckbox,
} from '@mui/x-tree-view/TreeItem';

import Button from '@mui/material/Button';
import { TransitionProps } from '@mui/material/transitions';
import Slide from '@mui/material/Slide';
import { Stack } from '@mui/material';
import { Paper, Popover, List, ListItemButton, ListItemIcon, ListItemText, TextField, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar } from '@mui/material';

import { TreeItemIcon } from '@mui/x-tree-view/TreeItemIcon';
import { TreeItemProvider } from '@mui/x-tree-view/TreeItemProvider';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddBoxIcon from '@mui/icons-material/AddBox';
import EditIcon from '@mui/icons-material/Edit';
import RemoveIcon from '@mui/icons-material/Remove';
import SaveIcon from '@mui/icons-material/Save';


const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const CustomTreeItemContent = styled(TreeItemContent)(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between', // Distribute space between label and button
}));

interface CustomTreeItemProps
    extends Omit<UseTreeItemParameters, 'rootRef'>,
        Omit<React.HTMLAttributes<HTMLLIElement>, 'onFocus'> {
    
}

const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: CustomTreeItemProps,
  ref: React.Ref<HTMLLIElement>,
) {
  const { id, itemId, label, disabled, children, ...other } = props;
    
  const {
    getRootProps,
    getContentProps,
    getIconContainerProps,
    getCheckboxProps,
    getLabelProps,
    getGroupTransitionProps,
    status,
    getContextProviderProps,
  } = useTreeItem({ id, itemId, children, label, disabled, rootRef: ref });
    const [openMenu, setOpenMenu] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const [openAdd, setOpenAdd] = useState(false);
    const [openEdit, setOpenEdit] = useState(false);
    const [editName, setEditName] = useState<string>(label as string);
    const [newName, setNewName] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const displayServerMessage = (message: string) => {
        setErrorMessage(message);
    }
    const handleCloseDelete = () => {
        Meteor.callAsync('removeDivision', itemId)
        setOpenDialog(false);
    };
  return (
    <>
      <TreeItemProvider defaultExpanded {...getContextProviderProps()}>
        <TreeItemRoot
          sx={{ ml: 1, borderLeft: '1px solid #d7d7d7' }}
          {...getRootProps(other)}
        >
          <Stack direction="row">
            <CustomTreeItemContent {...getContentProps()}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <TreeItemIconContainer {...getIconContainerProps()}>
                    <TreeItemIcon status={status} />
                </TreeItemIconContainer>
                <TreeItemCheckbox {...getCheckboxProps()} />
                <TreeItemLabel {...getLabelProps()} />
            </Box>
        </CustomTreeItemContent>
        <IconButton
            sx={{width:48}}
            aria-describedby='addMenu'
            onClick={(e)=>{
                setAnchorEl(e.currentTarget);
                setOpenMenu(true);
            }}
        >
            <MoreVertIcon />
        </IconButton>
        </Stack>
        {children && <TreeItemGroupTransition {...getGroupTransitionProps()} />}
      </TreeItemRoot>
    </TreeItemProvider>
    <Popover
        id='addMenu'
        open={openMenu}
        anchorEl={anchorEl}
        onClose={() => {
            setOpenMenu(false)
        }}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
        }}
    >
        <List dense>
            <ListItemButton onClick={
                ()=>{
                    setOpenMenu(false)
                    setOpenAdd(true)
                }}
            >
                <ListItemIcon>
                    <AddBoxIcon />
                </ListItemIcon>
                <ListItemText
                    primary="Add subDivision"
                    secondary={ null}
                />
            </ListItemButton>
            {itemId !== 'root' &&(
                <>
                    <ListItemButton onClick={()=>{
                        setOpenMenu(false)
                        setOpenEdit(true)
                    }}>
                        <ListItemIcon>
                            <EditIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Edit"
                            secondary={ null}
                        />
                    </ListItemButton>
                    <ListItemButton onClick={()=>{
                        setOpenDialog(true);
                        setOpenMenu(false)
                    }}>
                        <ListItemIcon>
                            <RemoveIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Delete"
                            secondary={ null}
                        />
                    </ListItemButton>
                </>
            )}
        </List>
    </Popover>
    <Popover
        id='addContent'
        open={openAdd}
        anchorEl={anchorEl}
        onClose={() => {
            setOpenAdd(false)
        }}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
        }}
    >
        <Paper sx={{p:1}}>
            <Stack direction='row'>
                <TextField
                    placeholder='Name'
                    value={newName}
                    onChange={(e)=>{
                        setNewName(e.target.value)
                    }}
                    variant='standard' 
                />
                <Button size='small' onClick={()=>{
                    if(editName !==''){
                        (async()=>{
                            try {
                                await Meteor.callAsync('insertDivision', {name: newName, parent:  itemId})
                                setAnchorEl(null)
                                setOpenAdd(false)
                                displayServerMessage(`Division ${newName} added successfully!`);
                            } catch (error:any) {
                                displayServerMessage(`Error inserting division: ${error?.message}`);
                            }
                        })();
                    }
                }}>
                    <SaveIcon />
                </Button>
            </Stack>
        </Paper>
        </Popover>
        <Popover
            id='editContent'
            open={openEdit}
            anchorEl={anchorEl}
            onClose={() => {
                setOpenEdit(false)
            }}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            >
                <Paper sx={{p:1}}>
                    <Stack direction='row'>
                        <TextField
                            placeholder='Name'
                            value={editName}
                            onChange={(e)=>{
                                setEditName(e.target.value)
                            }}
                            variant='standard'
                        />
                        <Button size='small' onClick={()=>{
                            if(editName !==''){
                                (async()=>{
                                    try {
                                        await Meteor.callAsync('updateDivision', itemId, {name: editName})
                                        setAnchorEl(null)
                                        setOpenEdit(false)
                                        displayServerMessage(`Division ${editName} updated successfully!`);
                                    } catch (error:any) {
                                        displayServerMessage(`Error updating division: ${error?.message}`);
                                    }
                                })();
                            }
                        }}>
                            <SaveIcon />
                        </Button>
                    </Stack>

                </Paper>
        </Popover>
        <Dialog
            open={openDialog}
            slots={{
            transition: Transition,
            }}
            keepMounted
            onClose={handleCloseDelete}
            aria-describedby="alert-dialog-slide-description"
        >
            <DialogTitle>{`Are you sure you want to delete ${label}?`}</DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-slide-description">
                {` All it's Subdivisions and persons (if any) will be attached to their parent.`}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={()=>{setOpenDialog(false)}}>Disagree</Button>
                <Button onClick={handleCloseDelete}>Agree</Button>
            </DialogActions>
        </Dialog>
        <Snackbar
            open={!!errorMessage}
            autoHideDuration={6000}
            onClose={()=>{setErrorMessage(null)}}
            message={errorMessage || ''}
        />
    </>
  );
});

export default CustomTreeItem;