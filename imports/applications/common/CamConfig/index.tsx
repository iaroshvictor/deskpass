import * as React from 'react'
import { Meteor } from 'meteor/meteor';
import { useState } from 'react';
import Icon from './icon'
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { Paper,
    Alert,
    Button,
    Fab,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableRow,
    TableCell,
    TableHead,
    MenuList,
    MenuItem,
    ListItemIcon,
    ListItemText,
    TableBody,
    TableContainer,
    Popover,
    Dialog,
    IconButton,
    Slide,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Snackbar
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { ZonesCollection, Zone } from '/imports/api/zones';

import { AppProps, AppType } from '../..';
import AddIcon from '@mui/icons-material/Add';
import { CamsCollection, Cam } from '/imports/api/cams';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import { TransitionProps } from '@mui/material/transitions';
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});
import {ExtraConfig} from '../..'
type ZoneItemProps ={
    zone: Zone,
    Cams: Cam[],
    Zones: Zone[],
    launchApp?: (appName: string, extraConfigs?: ExtraConfig) => void
}
const ZoneItem = ({zone, Cams, Zones, launchApp}:ZoneItemProps)=>{
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [todeleteCam, setTodeleteCam] = useState<null | Cam>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [camActions, setCamActions] = useState<null | Cam>(null);
    const [snapshotModalCam, setSnapshotModalCam] = useState<null | Cam>(null);
    const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);
    const [newSnapshot, setNewSnapshot] = useState<string | null>(null);
    return(
        <>
        <Accordion sx={{boxShadow: '0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)', mb: 1}} key={zone._id}>
            <AccordionSummary   expandIcon={<ExpandMoreIcon />} sx={{backgroundColor:'#f5f5f5'}}>
                {`${zone.name} (${Cams.filter(cam => cam.zone === zone._id).length})`} 
            </AccordionSummary>
            <AccordionDetails sx={{pr:0}}>
                {Cams.filter(cam => cam.zone === zone._id).length>0 &&(
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Person Alert</TableCell>
                                    <TableCell>Access Control</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Cams.filter(cam => cam.zone === zone._id).map(mycam=>{
                                    return (
                                        <TableRow key={mycam._id}>
                                            <TableCell>
                                                {mycam.name}
                                            </TableCell>
                                            <TableCell>{mycam.faceAlert? <CheckBoxIcon /> : <IndeterminateCheckBoxIcon />}</TableCell>
                                            <TableCell>{mycam.accessControl? <CheckBoxIcon /> : <IndeterminateCheckBoxIcon />}</TableCell>
                                            <TableCell>
                                                <IconButton
                                                    onClick={(e) => {
                                                        setCamActions(mycam);
                                                        setMenuAnchorEl(e.currentTarget)
                                                    }}
                                                    size="small"
                                                    color="primary"
                                                >
                                                    <MoreVertIcon />
                                                </IconButton>
                                                {(menuAnchorEl && camActions && camActions._id === mycam._id )&& (
                                                <Popover
                                                    open
                                                    anchorEl={menuAnchorEl}
                                                    onClose={() => {setMenuAnchorEl(null); setCamActions(null)}}
                                                    anchorOrigin={{
                                                        vertical: 'bottom',
                                                        horizontal: 'left',
                                                    }}
                                                >
                                                    <MenuList>
                                                        <MenuItem
                                                            onClick={()=>{
                                                                setMenuAnchorEl(null);
                                                                launchApp?.('Edit cctv', {cam: camActions});
                                                            }}
                                                        >
                                                        <ListItemIcon>
                                                            <EditIcon fontSize="small" />
                                                        </ListItemIcon>
                                                        <ListItemText>Edit</ListItemText>
                                                        </MenuItem>
                                                        <MenuItem
                                                            onClick={()=>{
                                                                setMenuAnchorEl(null);
                                                                setCamActions(null);
                                                                setNewSnapshot(null);
                                                                setSnapshotModalCam(mycam);
                                                            }}
                                                        >
                                                        <ListItemIcon>
                                                            <PhotoCameraIcon fontSize="small" />
                                                        </ListItemIcon>
                                                        <ListItemText>Edit Snapshot</ListItemText>
                                                        </MenuItem>
                                                        <MenuItem
                                                            onClick={()=>{
                                                                setMenuAnchorEl(null);
                                                                setTodeleteCam(camActions);
                                                            }}
                                                        >
                                                        <ListItemIcon>
                                                            <DeleteIcon fontSize="small" />
                                                        </ListItemIcon>
                                                        <ListItemText>Delete</ListItemText>
                                                        </MenuItem>
                                                    </MenuList>
                                                </Popover>
                                                )}
                                                
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                {Zones.filter(z => z.parent === zone._id).length > 0 && (
                    Zones.filter(z => z.parent === zone._id).map((subZone) => (
                        <ZoneItem key={subZone._id} zone={subZone} launchApp={launchApp} Cams={Cams} Zones={Zones} />
                    ))
                )}
            </AccordionDetails>
        </Accordion>
        <Dialog
            open={!!todeleteCam}
            slots={{
            transition: Transition,
            }}
            keepMounted
            onClose={()=>{setTodeleteCam(null)}}
            aria-describedby="alert-dialog-slide-description"
        >
        <DialogTitle>{`Are you sure you want to delete ${todeleteCam?.name}?`}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-slide-description">
            {`This action can not be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={()=>{setTodeleteCam(null)}}>Disagree</Button>
            <Button 
                onClick={async()=>{
                    try{
                        await Meteor.callAsync('removeCam', todeleteCam?._id);
                    }
                    catch (error:any) {
                        setErrorMessage(`Error deleting camera: ${error.message}`);
                    }
                    setTodeleteCam.bind(null, null)
                }}
            >
                Agree
            </Button>
        </DialogActions>
      </Dialog>
      <Dialog
            open={!!snapshotModalCam}
            onClose={()=>{setSnapshotModalCam(null); setNewSnapshot(null);}}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>{`Edit Snapshot - ${snapshotModalCam?.name}`}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
                    {snapshotLoading ? (
                        <CircularProgress />
                    ) : (
                        <>
                            {(newSnapshot || snapshotModalCam?.snapshot) ? (
                                <img
                                    src={`data:image/jpeg;base64,${newSnapshot || snapshotModalCam?.snapshot}`}
                                    alt="Camera Snapshot"
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                                />
                            ) : (
                                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                    No snapshot available
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'space-between', px: 2, pb: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={snapshotLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                        disabled={snapshotLoading}
                        onClick={async () => {
                            if (!snapshotModalCam?.streamurl) return;
                            setSnapshotLoading(true);
                            try {
                                const img = await Meteor.callAsync('validateRtspLink', snapshotModalCam.streamurl);
                                if (img) {
                                    setNewSnapshot(img);
                                }
                            } catch (error: any) {
                                setErrorMessage(`Error generating snapshot: ${error.reason || error.message}`);
                            } finally {
                                setSnapshotLoading(false);
                            }
                        }}
                    >
                        Generate New Snapshot
                    </Button>
                    <Stack direction="row" spacing={1}>
                        <Button onClick={() => { setSnapshotModalCam(null); setNewSnapshot(null); }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            disabled={!newSnapshot || snapshotLoading}
                            onClick={async () => {
                                if (!snapshotModalCam?._id || !newSnapshot) return;
                                try {
                                    await Meteor.callAsync('updateCam', snapshotModalCam._id, {
                                        ...snapshotModalCam,
                                        snapshot: newSnapshot
                                    });
                                    setErrorMessage('Snapshot updated successfully');
                                    setSnapshotModalCam(null);
                                    setNewSnapshot(null);
                                } catch (error: any) {
                                    setErrorMessage(`Error saving snapshot: ${error.reason || error.message}`);
                                }
                            }}
                        >
                            Save
                        </Button>
                    </Stack>
                </Stack>
            </DialogActions>
        </Dialog>
      <Snackbar
            open={!!errorMessage}
            autoHideDuration={6000}
            onClose={()=>{setErrorMessage(null)}}
            message={errorMessage || ''}
        />
    </>
    )
}
const CamConfigApp = ({ launchApp }: AppProps = { launchApp: undefined }) => {   
    useSubscribe('zones');
    useSubscribe('cams');
    
    const Cams = useFind(() => CamsCollection.find());
    const Zones = useFind(() => ZonesCollection.find());
    return (
        <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
            {Zones.length === 0 ? (
                <>
                    <Alert variant="filled" severity="info">
                        No zones are defined. Please create the zones hierarchy first.
                    </Alert>
                    {typeof launchApp === 'function' && (
                        <Button onClick={() => launchApp('Zones')}>Open Zones Config</Button>
                    )}
                </>
            )
        :(
            // display a list of cameras in hierarchical view by zones that are attached to it
            <>
            {Zones.filter(z=>z.parent === 'root').map((zone) => (
                <ZoneItem key={zone._id} zone={zone} Cams={Cams} launchApp={launchApp} Zones={Zones} />
            ))}
            </>
        )}
        {launchApp &&(
            <Fab
                size="small"
                variant="extended"
                sx={{position:'absolute', bottom:10, right:12}}
                aria-label='Add'
                color="primary"
                onClick={()=>{launchApp('Add cctv')}}
            >
                <AddIcon /> Add new
            </Fab>
        )}
        </Paper>
    );
};
const camApp:AppType ={
    appName: 'Cam Config',
    render: CamConfigApp,
    appIcon: <Icon />
}
export default camApp;