import { AppType } from "../..";
import React from "react";
import { Meteor } from "meteor/meteor";
import { ChromePicker } from 'react-color';
import {
    Paper,
    Fab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Popover,
    Stack,
    Accordion,
    AccordionSummary,
    Typography,
    Snackbar,
    IconButton,
    Menu,
    MenuItem,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Avatar,
    Slide
} from "@mui/material";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Icon from './icon';
import { AlertLists, AlertList } from "/imports/api/alertLists";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { VisitsSummaryCollection, VisitSummary } from '/imports/api/visitSummary';
import { useRef, useState } from 'react';
import { TransitionProps } from '@mui/material/transitions';
import IdentifyEdit from '/imports/applications/common/personsDatabase/indetifyEditForm';
import EditIcon from '@mui/icons-material/Edit';
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});
type AddEditProps = {
    setOpen:(open:boolean)=>void,
    list:AlertList,
    inform:(message:string)=>void,
   
}
const ListPersonsTable =(props:{list:AlertList, setMessage:(message:string)=>void})=>{
    const list = props.list;
    const setMessage = props.setMessage;
    useSubscribe ('visitssummary', {'idInfo.alertList': list._id});
    const[menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
    const [selectedPerson, setSelectedPerson] = React.useState<null | string>(null);
    const [selectedItemDialog, setSelectedItemDialog] = useState<VisitSummary | null>(null);
    const [idForm, setIdForm] = useState<boolean>(false)
    const handleEditClick = () => {
        if (selectedPerson) {
            // Handle edit action for the selected person
            setMenuAnchorEl(null);
            setSelectedPerson(null);
            
            setIdForm(true);
        }
    };
    const identifyEditRef = useRef<{ save: () => boolean, deleteSummary: () => boolean }>(null);
    const handleSave = () => {
        if (identifyEditRef.current) {
            const result = identifyEditRef.current.save();
            if(result){
                setMessage('Person information saved');
            }else{
                setMessage('Error saving information');
            }
            setIdForm(false)
            // handle result
        }
    };
      const handleRemove = () => {
        if (identifyEditRef.current) {
            const result = identifyEditRef.current.deleteSummary();
            if(result){
                setMessage('Person information deleted');
            }else{
                setMessage('Error removing information');
            }
            setIdForm(false);
            // handle result
        }
    }

    const visits = useFind(() => VisitsSummaryCollection.find({'idInfo.alertList': list._id}));

    return visits.length >0 
    ?<>
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Comment</TableCell>
                    <TableCell></TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {visits.map((visit) => (
                    <TableRow key={visit._id}>
                        <TableCell>
                            <Avatar
                                sx={{ width: 56, height: 56, backgroundColor: list.color, borderRadius:2 }}
                                src={`data:image/jpeg;base64,${visit.face_b64}`}
                            />
                        </TableCell>
                        <TableCell>
                            {visit.idInfo?.firstName} {visit.idInfo?.lastName}
                        </TableCell>
                        <TableCell>
                            {visit.idInfo?.comment}
                        </TableCell>
                        <TableCell><IconButton onClick={(e)=>{
                            setMenuAnchorEl(e.target as HTMLElement);
                            setSelectedPerson(visit._id||'');
                            setSelectedItemDialog(visit);

                        }}><MoreVertIcon/></IconButton></TableCell>
                    </TableRow>
                ))}
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
                        </Menu>
                )}
            </TableBody>
        </Table>
        {idForm && <Dialog
                open={true} 
                maxWidth='xl'
                fullWidth
                slots={{
                transition: Transition,
                }}
                keepMounted
                onClose={() => setSelectedItemDialog(null)}
                aria-describedby="alert-dialog-slide-description"
            >
                <DialogTitle>{selectedItemDialog?.idInfo?.firstName? <><EditIcon />{`${selectedItemDialog?.idInfo.firstName} ${selectedItemDialog?.idInfo.lastName}`}</> :"Identify Person"}</DialogTitle>
                <DialogContent>
                    <IdentifyEdit ref={identifyEditRef} tracking_id={selectedItemDialog?._id || ''} visits={[]} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleSave}>Save</Button>
                    <Button color='error' onClick={handleRemove}>Delete</Button>
                    <Button onClick={() =>{ setSelectedItemDialog(null); setIdForm(false)}}>Close</Button>
                </DialogActions>
            </Dialog>}
    </> :<>
        No persons in this list
    </>
}
const AddEditDialog = (props:AddEditProps)=>{
    
    const { list={name:'', color:'#ba000d'}, inform, setOpen } = props;
    const [listState, setListState] = React.useState<AlertList>(list);
    const handleSubmit= (e: { preventDefault: () => void; })=>{
        e.preventDefault();
        if(list._id){
            try{
                Meteor.callAsync('editAlertList', listState)
                inform('List updated');
                setOpen(false);
            }catch(e : any){
                inform(e.reason as string);
            }
        }else{
            try{
                Meteor.call('addAlertList', listState, (error:any)=>{
                    if(error){
                        inform(error.reason);
                    }else{
                        inform('List added');
                    }
                });
                setOpen(false);
            }catch(e : any){
                inform(e.reason as string);
            }
        }
    }
    const handleClose = () => {
        setOpen(false);
    };
    const [pickerAnchorEl, setpickerAnchorEl] = React.useState<HTMLElement | null>(null);
    return (
    <>
        <Dialog open={true} onClose={handleClose}>
            <DialogTitle>{list._id ? 'Edit' : 'Add new list'}</DialogTitle>
            <DialogContent sx={{ paddingBottom: 0 }}>
            <form onSubmit={handleSubmit}>
                <TextField
                    autoFocus
                    required
                    margin="dense"
                    id="name"
                    name="name"
                    label="List Name"
                    type="text"
                    fullWidth
                    value={listState.name}
                    onChange={(e) => setListState({ ...listState, name: e.target.value })}
                    variant="standard"
                />
                <Stack direction='row' >
                <TextField
                    autoFocus
                    required
                    margin="dense"
                    id="name"
                    name="name"
                    label="Alert Color"
                    type="text"
                    fullWidth
                    value={listState.color}
                    variant="standard"
                />
                <Button variant="outlined" size="small" sx={{borderColor:listState.color}} onClick={(e)=>{setpickerAnchorEl(e.target as HTMLElement)}} >
                    <ColorLensIcon />
                </Button>
                <Popover
                    open={Boolean(pickerAnchorEl)}
                    anchorEl={pickerAnchorEl}
                    onClose={() => setpickerAnchorEl(null)}
                >
                    <ChromePicker
                        color={listState.color}
                        onChange={(color) => setListState({ ...listState, color: color.hex })}
                    />

                </Popover>
                </Stack>
                <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button type="submit">Save</Button>
                </DialogActions>
            </form>
            </DialogContent>
        </Dialog>
    </>)
}
const PersonListsRenderer = () => {
    useSubscribe('alertLists');
    const alertLists = useFind(() => AlertLists.find({}));
    const [open, setOpen] = React.useState(false);
    const [list , setList]= React.useState<AlertList>({name:'', color:'#ba000d'});
    const handleOpen = (val:boolean)=>{
        setOpen(val);
        if(!val){setList({name:'', color:'#ba000d'});}
    }
    const [message, setMessage] = React.useState<string | null>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [selectedList, setSelectedList] = React.useState<AlertList | null>(null);
    const openMenu = Boolean(anchorEl);
    const handleEditClick = () => {
        if (selectedList) {
            setList(selectedList);
            setOpen(true);
            setAnchorEl(null);
        }
    };
    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }} >
            <Fab color="primary" aria-label="add" onClick={()=>{setOpen(true);}} sx={{position: 'absolute', bottom: 16, right: 16 }}>
                <AddIcon />
            </Fab>
            {open && (
                <AddEditDialog setOpen={handleOpen} list={list} inform={(message:string)=>{setMessage(message)}} />
            )}
            {alertLists.map((list) => (
                <Accordion key={list._id} sx={{ mb: 1 }}>
                    <Stack direction='row' spacing={2}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}  sx={{width:'100%'}}>
                            <Typography variant='subtitle2'>{list.name}</Typography>
                        </AccordionSummary>
                        <IconButton
                            onClick={(event)=>{
                                setAnchorEl(event.currentTarget);
                                setSelectedList(list);
                            }}
                            aria-label="more"
                            id="long-button"
                            aria-controls={openMenu ? 'long-menu' : undefined}
                            aria-expanded={openMenu ? 'true' : undefined}
                            aria-haspopup="true"
                        >
                            <MoreVertIcon />
                        </IconButton>
                        <Menu
                            id="long-menu"
                            anchorEl={anchorEl}
                            open={openMenu}
                            onClose={()=>{
                                setAnchorEl(null);
                                setSelectedList(null);
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
                                setAnchorEl(null);
                                setSelectedList(null);
                            }}>Delete</MenuItem>
                        </Menu>
                    </Stack>
                    <AccordionDetails>
                        <ListPersonsTable list={list} setMessage={(message:string)=>setMessage(message)} />
                    </AccordionDetails>
                </Accordion>
            ))}
            <Snackbar
                open={!!message}
                autoHideDuration={6000}
                onClose={()=>{setMessage(null)}}
                message={message || ''}
            />
        </Paper>
    );
}

const PersonLists: AppType = {
    appName: 'Person lists',
    appIcon: <Icon />,
    render: PersonListsRenderer,
    module: 'personAlert',
};
export default PersonLists