import * as React from 'react'
import { useState } from 'react';
import { Button, Paper, Stack, TextField } from '@mui/material'
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { Zone, ZonesCollection } from '/imports/api/zones';
import AddIcon from '@mui/icons-material/Add';
import {Typography} from '@mui/material'
import { Meteor } from 'meteor/meteor';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import AddBoxIcon from '@mui/icons-material/AddBox';
import RemoveIcon from '@mui/icons-material/Remove';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton'
import SaveIcon from '@mui/icons-material/Save';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import Icon from './icon'

import { AppProps, AppType } from '../..';
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});
type zoneItemProps = {
    zone:Zone
    zonesData :Zone[]
    addZoneItem:(parent:string)=>void
    setTextFields : React.Dispatch<React.SetStateAction<{
        [x: string]: string;
    }>>
    textFields : {[x:string]:string}
    expanded:{[x:string]:boolean}
    setExpanded : React.Dispatch<React.SetStateAction<{
        [x: string]: boolean;
    }>>
}
 const ZoneRenderItem =({zone, zonesData, addZoneItem, setTextFields, textFields, expanded, setExpanded} :zoneItemProps) => {
    const [] = useState<boolean>(zonesData.filter(el=>el.parent === zone._id).length>0)
    if(zone._id)
        if(expanded[zone._id] === undefined){
            const hasChilds = ()=>zonesData.filter(e=>e.parent===zone._id).length>0
            setExpanded(prev=>({...prev,[zone._id||'']:hasChilds()}))
        }
        const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
        const [openMenu, setOpenMenu] = useState<boolean>(false)
        const [openEdit, setOpenEdit] = useState<boolean>(false)
        const [editName, setEditName] =useState<string>(zone.name)
        const [openDialog, setOpenDialog] = React.useState(false);
        const handleClickOpenDelete = () => {
            setAnchorEl(null)
            setOpenMenu(false)
            setOpenDialog(true);
        };

        const handleCloseDelete = () => {
            Meteor.callAsync('deleteZone', zone._id)
            setOpenDialog(false);
        };
    return(
        <>
        <Dialog
            open={openDialog}
            slots={{
            transition: Transition,
            }}
            keepMounted
            onClose={handleCloseDelete}
            aria-describedby="alert-dialog-slide-description"
        >
        <DialogTitle>{`Are you sure you want to delete ${zone.name}?`}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-slide-description">
            {` All it's subzone (if any) will be attached to this parrent.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>{setOpenDialog(false)}}>Disagree</Button>
          <Button onClick={handleCloseDelete}>Agree</Button>
        </DialogActions>
      </Dialog>
        <Accordion
            disableGutters
            sx={{m:'0 !important'}}
            expanded={expanded[zone._id||''] || false}
            onChange={()=>{setExpanded(prev=>({...prev, [zone._id||'']:!expanded[zone._id||'']}))}}
        >
            <Stack direction='row'>
                <AccordionSummary
                    sx={{flexDirection:'row-reverse', minHeight:'48px !important'}}
                    expandIcon={expanded[zone._id||'']?<RemoveIcon /> : <AddBoxIcon />}
                    onChange={()=>{setExpanded(prev=>({...prev, [zone._id || '']:!expanded}))}}
                    aria-controls={`panel-content_${zone._id}`}
                    id={`panel-header_${zone._id}`}
                >
                    <Typography sx={{ml:1}} component="span">{`${zone.name} (${zonesData.filter(e=>e.parent === zone._id).length} subzones)`}</Typography>
                    </AccordionSummary>
                    <IconButton
                        sx={{width:48}}
                        aria-describedby='editDeleteMenu'
                        onClick={(e)=>{
                            setAnchorEl(e.currentTarget)
                            setOpenMenu(true)
                        }}
                    >
                        <MoreVertIcon />
                    </IconButton>
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
                                placeholder='Add subzone'
                                value={editName}
                                onChange={(e)=>{
                                    setEditName(e.target.value)
                                }}
                                variant='standard' 
                            />
                            <Button size='small' onClick={()=>{
                                if(editName !==''){
                                    Meteor.callAsync('editZone', {id:zone._id, name:editName})
                                    setAnchorEl(null)
                                    setOpenEdit(false)
                                }
                            }}>
                                <SaveIcon />
                            </Button>
                        </Stack>
                        </Paper>
                    </Popover>
                    <Popover
                        id='editDeleteMenu'
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
                                    setOpenEdit(true)
                                }}
                            >
                                <ListItemIcon>
                                    <EditIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Edit"
                                    secondary={ null}
                                />
                            </ListItemButton>
                            <ListItemButton onClick={()=>{handleClickOpenDelete()}}>
                                <ListItemIcon>
                                    <DeleteIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Delete"
                                    secondary={ null}
                                />
                            </ListItemButton>
                        </List>
                    </Popover>
            </Stack>  
            <AccordionDetails sx={{pr:0}}>
                {zonesData.filter(e=>e.parent === zone._id).map(zone=><ZoneRenderItem expanded={expanded} setExpanded={setExpanded} key={zone._id} zonesData={zonesData} zone={zone} addZoneItem={addZoneItem} setTextFields={setTextFields} textFields={textFields} />)}
                <Paper sx={{p:1}}>
                    <Stack direction='row'>
                    <TextField
                        placeholder='Add subzone'
                        value={textFields[zone._id || ''] || ''}
                        onChange={(e)=>{
                            setTextFields(prev=>({...prev, [zone._id || '']:e.target.value}))
                        }}
                        variant='standard' 
                    />
                    <Button size='small' onClick={()=>{addZoneItem(zone._id || '')}}>
                        <AddIcon />
                    </Button>
                </Stack>
                </Paper>
                
                
            </AccordionDetails>
        </Accordion>
        </>
    )}

const zoneApp:AppType={
    appName:'Zones',
    appIcon:<Icon  />,
    render:function Zones(_props:AppProps){
    useSubscribe('zones')
    const ZonesData = useFind(()=>ZonesCollection.find())
    const addZoneItem = (parent:string)=>{
        const name = textFields[parent]||''
        Meteor.callAsync('addZoneItem', {name, parent})
        setTextFields(prev=>({...prev, [parent]:''}))
    }
    const [textFields, setTextFields]=useState<{[x:string]:string}>({})
    const [expanded, setExpanded]=useState<{[x:string]:boolean}>({})

    return(
        <Paper sx={{minHeight:'100%',p:2,boxSizing:'border-box'}}>
            {
                ZonesData.filter(el=>el.parent === 'root').map(zone=>{
                    return (
                        <ZoneRenderItem 
                            key={zone._id}
                            zone={zone}
                            zonesData={ZonesData}
                            addZoneItem={addZoneItem}
                            setTextFields={setTextFields}
                            textFields={textFields}
                            expanded={expanded}
                            setExpanded={setExpanded}
                        />
                    )
                })
            }
            <Paper sx={{p:1}}>
                <Stack sx={{ml:2, mt:2}} direction='row'>
                    <TextField
                        placeholder='Add new'
                        value={textFields['root'] || ''}
                        onChange={(e)=>{
                            setTextFields(prev=>({...prev, root:e.target.value}))
                        }}
                        variant='standard' 
                    />
                    <Button size='small' onClick={()=>{addZoneItem('root')}}>
                        <AddIcon />
                    </Button>
                </Stack>
            </Paper>
        </Paper>
    )
    }
}

export default zoneApp