import React, { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { IntruderAlertsCollection } from '/imports/api/intruderAlerts';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { Alert, Card, Grid, AlertTitle, Stack, Paper,Autocomplete, TextField, Typography } from '@mui/material';
import { CamsCollection } from '/imports/api/cams';
import {VisitSummaryMetaCollection, SummaryMeta, VisitSummary}   from '/imports/api/visitSummary';
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

type props ={
    alertId: string;
    onCloseModal: () => void;
}

const AlertItemModal = ({alertId, onCloseModal}:props) => {
    useSubscribe('alertItem', alertId);
    useSubscribe('visitSummaryMeta');
    useSubscribe('cams');
    const PersonFilter = useFind(() => VisitSummaryMetaCollection.find({}));
    const [selectedPerson, setSelectedPerson] = useState<SummaryMeta | null>(null);
    const Cams = useFind(() => CamsCollection.find());
    const intruder = useFind(() => IntruderAlertsCollection.find({_id: alertId}), [alertId]);
    const myIntruder = React.useMemo(()=>{
        return intruder?.[0] || null;
    },[intruder]);
    const [seenBy, setSeenBy] = useState<string | null>(null);
    useEffect(() => {
        (async() => {
            const username = await Meteor.callAsync('getUserName', myIntruder?.seenBy || '')
            setSeenBy(username || null);
        })()
        
    }, [myIntruder.seenBy]);
    const handleSeen =()=>{
        try{
            Meteor.callAsync('setSeenIntruder', alertId)  }catch(e){}
        //onCloseModal();
    }
    const handleAddFaceModel =()=>{
        if (!selectedPerson || !myIntruder) {
            return;
        }
        try {
            Meteor.callAsync('reposessIntruder', selectedPerson._id, myIntruder._id);
            onCloseModal();
        } catch (e) {
            console.error('Error adding face model:', e);
        }
        setSelectedPerson(null);
    }
    const[ bestMatch , setBestMatch] = useState<{item:VisitSummary, dist:number} | null | false>(false);
    useEffect(() => {
        if(myIntruder){
            (async()=>{
                const bestMatchresult = await Meteor.callAsync('findBestMatch', myIntruder._id||'');
                setBestMatch(bestMatchresult);
            })();
        }
    }, [myIntruder]);
    const getDetectionLevel = (cosineSim: number): string =>
        (Math.max(0, Math.min(1, cosineSim)) * 100).toFixed(1);
    return (
        <Dialog
            open={true} 
            maxWidth='xl'
            fullWidth
            slots={{
            transition: Transition,
            }}
            keepMounted
            onClose={() => onCloseModal()}
            aria-describedby="alert-dialog-slide-description"
        >
            <DialogTitle></DialogTitle>
            <DialogContent>
                {myIntruder &&(
                    <Grid container spacing={2}>
                        <Grid size={4}>
                        <Card>
                            <Stack direction ='row' spacing={1}>
                            <img src={`data:image/jpeg;base64,${myIntruder.person_b64}`} alt="Person" style={{maxWidth:'100%'}} />
                            <img src={`data:image/jpeg;base64,${myIntruder.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                            </Stack>
                        </Card>
                        </Grid>
                        <Grid size={8}>
                            <Stack direction='row' spacing={2} >
                            <Alert variant="filled" severity="warning" sx={{width:'100%'}}>
                                <AlertTitle>Intruder Detected</AlertTitle>
                                Cam: {Cams.find(cam=>cam._id === myIntruder.source)?.name} at {new Date(myIntruder.timestamp).toLocaleString()}
                                {(myIntruder.lines || myIntruder.zones) && (() => {
                                    const cam = Cams.find(c => c._id === myIntruder.source);
                                    return (
                                        <Stack spacing={0.5} sx={{mt:1}}>
                                            {myIntruder.lines && Object.entries(myIntruder.lines).map(([lineId, side]) => {
                                                const label = cam?.lines?.find(l => l.lineId === lineId)?.label ?? lineId;
                                                const isTrigger = lineId === myIntruder.triggerLine && side === myIntruder.triggerSide;
                                                return (
                                                    <Typography key={lineId} variant="caption" sx={{fontWeight: isTrigger ? 'bold' : 'normal'}}>
                                                        Line: {label} → {side}{isTrigger ? ' ⚠' : ''}
                                                    </Typography>
                                                );
                                            })}
                                            {myIntruder.zones && Object.entries(myIntruder.zones).map(([zoneId, pos]) => {
                                                const cam = Cams.find(c => c._id === myIntruder.source);
                                                const label = cam?.overlayZones?.find(z => z.zoneId === zoneId)?.label ?? zoneId;
                                                return (
                                                    <Typography key={zoneId} variant="caption">
                                                        Zone: {label} → {pos}
                                                    </Typography>
                                                );
                                            })}
                                        </Stack>
                                    );
                                })()}
                            </Alert>
                            {myIntruder.seen && (
                                <Alert variant="filled" severity="info" sx={{width:'100%'}}>
                                    <AlertTitle>Seen</AlertTitle>
                                    Seen by: {seenBy || 'Unknown'} at {myIntruder.seenAt ? new Date(myIntruder.seenAt).toLocaleString() : 'Unknown'}
                                </Alert>
                            )}
                            </Stack>
                            <Paper elevation={3} sx={{mt:2}}>
                                {bestMatch === false &&(
                                    <Typography variant="body1" sx={{p:2}}>
                                        Looking for best match...
                                    </Typography>
                                )}
                                {bestMatch === null &&(
                                    <Typography variant="body1" sx={{p:2}}>
                                        No match found
                                    </Typography>
                                )}
                                {bestMatch && (
                                    <Stack direction='row' spacing={2} sx={{p:2}}>
                                        <img src={`data:image/jpeg;base64,${bestMatch.item.face_b64}`} alt="Best Match Face" style={{maxWidth:'100px'}} />
                                        <Stack>
                                            <Typography variant="body1">
                                                Best match: {bestMatch.item.idInfo?.firstName} {bestMatch.item.idInfo?.lastName}
                                            </Typography>
                                            <Typography variant="body2">
                                                Comment: {bestMatch.item.idInfo?.comment}
                                            </Typography>
                                            <Typography variant="body2">
                                                Similarity: {`${getDetectionLevel(bestMatch.dist)} %`}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                )}
                                <Stack direction='row' spacing={2} sx={{p:2}}>
                                <Autocomplete
                                    sx={{width:'100%'}}
                                    options={PersonFilter}
                                    getOptionKey={(option) => `meta${option._id || ''}`}
                                    getOptionLabel={(option) => `${option.idInfo?.firstName || ''} ${option.idInfo?.lastName || ''}`}
                                    renderInput={(params) => <TextField {...params} label="Add face model to a person" variant="outlined" />}
                                    value={selectedPerson}
                                    onChange={(_event, value) => {
                                        setSelectedPerson(value);
                                    }}
                                />
                                {selectedPerson && (
                                    <Button onClick={handleAddFaceModel} variant="contained" color="primary">
                                        Add Face Model
                                    </Button>
                                )}
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>

                )}
            </DialogContent>
            <DialogActions>
                 <Button onClick={() => handleSeen()}>Set Seen</Button>
                <Button onClick={() => onCloseModal()}>Close</Button>
            </DialogActions>
        </Dialog>
    )
}
export default AlertItemModal