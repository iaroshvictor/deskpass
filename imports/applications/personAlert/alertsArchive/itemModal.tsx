import React, { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';

import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { Alert, Card, Grid, AlertTitle, Stack, Paper, Typography } from '@mui/material';
import { CamsCollection } from '/imports/api/cams';
import {VisitsSummaryCollection}   from '/imports/api/visitSummary';
import { AlertsArchiveCollection } from '/imports/api/alertsArchive';
import {AlertLists} from '/imports/api/alertLists'
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
    useSubscribe('alertsArchive', {_id:alertId}, 100, 0, {timestamp:-1});
    useSubscribe('visitSummaryMeta');
    useSubscribe('cams');
    useSubscribe('alertLists');
    const AlertsList = useFind(() => AlertLists.find({}));
   
    const Cams = useFind(() => CamsCollection.find());
    const alert = useFind(() => AlertsArchiveCollection.find({_id: alertId}), [alertId]);
    const myAlert= React.useMemo(()=>{
        return alert?.[0] || null;
    },[alert]);
     const myAlertList = React.useMemo(()=>{
        return AlertsList.find((l)=>l._id === myAlert.listId)
    }, [AlertsList, myAlert])
    useSubscribe ('visitssummary', {'_id': myAlert?.idInfo||''});
    const [seenBy, setSeenBy] = useState<string | null>(null);
    useEffect(() => {
        (async() => {
            const username = await Meteor.callAsync('getUserName', myAlert?.seenBy || '')
            setSeenBy(username || null);
        })()
        
    }, [myAlert.seenBy]);
    const handleSeen =()=>{
        try{
            Meteor.callAsync('setSeenIntruder', alertId)  }catch(e){}
        //onCloseModal();
    }
    const handleAddFaceModel =()=>{
        try {
            Meteor.callAsync('addFaceToSummary', myAlert._id);
            onCloseModal();
        } catch (e) {
            console.error('Error adding face model:', e);
        }
    }
    const bestMatch = useFind(()=>VisitsSummaryCollection.find({_id:`${myAlert?.idInfo || 't'}`}), [myAlert])
    // const[ bestMatch , setBestMatch] = useState<{item:VisitSummary, dist:number} | null | false>(false);
    // const getDetectionLevel = (num:number) => {
    //     let detectionLevel;

    //     if (num < 0.3) {
    //         // This corresponds to: num = (100 - level) * 0.3 / 10
    //         detectionLevel = 100 - (num * 10 / 0.3);
    //     } else if (num < 0.5) {
    //         // This corresponds to: num = 0.3 + (90 - level) * 0.2 / 30
    //         detectionLevel = 90 - ((num - 0.3) * 30 / 0.2);
    //     } else {
    //         // This corresponds to: num = 0.5 + (60 - level) * 0.2 / 50
    //         detectionLevel = 60 - ((num - 0.5) * 50 / 0.2);
    //     }

    //     // Clamp to [0, 100] just in case
    //     return Math.max(0, Math.min(100, detectionLevel)).toFixed(2);
    // };
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
                {myAlert &&(
                    <Grid container spacing={2}>
                        <Grid size={4}>
                        <Card>
                            <Stack direction ='row' spacing={1}>
                            {myAlert.person_b64 && (
                                <img src={`data:image/jpeg;base64,${myAlert.person_b64}`} alt="Person" style={{maxWidth:'100%'}} />
                            )}
                            <img src={`data:image/jpeg;base64,${myAlert.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                            </Stack>
                        </Card>
                        </Grid>
                        <Grid size={8}>
                            <Stack direction='row' spacing={2} >
                            <Alert variant="filled" severity="warning" sx={{width:'100%', backgroundColor:`${myAlertList?.color}`}}>
                                <AlertTitle>Person Alert</AlertTitle>
                                Cam: {Cams.find(cam=>cam._id === myAlert.source)?.name} at {new Date(myAlert.timestamp).toLocaleString()}
                            </Alert>
                            {myAlert.seen && (
                                <Alert variant="filled" severity="info" sx={{width:'100%'}}>
                                    <AlertTitle>Seen</AlertTitle>
                                    Seen by: {seenBy || 'Unknown'} at {myAlert.seenAt ? new Date(myAlert.seenAt).toLocaleString() : 'Unknown'}
                                </Alert>
                            )}
                            </Stack>
                            <Paper elevation={3} sx={{mt:2}}>
                                {bestMatch[0] && (
                                    <Stack direction='row' spacing={2} sx={{p:2}}>
                                        <img src={`data:image/jpeg;base64,${bestMatch[0].face_b64}`} alt="Best Match Face" style={{maxWidth:'100px'}} />
                                        <Stack>
                                            <Typography variant="body1">
                                                Best match: {bestMatch[0].idInfo?.firstName} {bestMatch[0].idInfo?.lastName}
                                            </Typography>
                                            <Typography variant="body2">
                                                Comment: {bestMatch[0].idInfo?.comment}
                                            </Typography>
                                            <Typography variant="body2">
                                                List Name: {myAlertList?.name}
                                            </Typography>
                                            
                                            <Typography variant="body2">
                                                Similarity: {``}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                )}
                                <Stack direction='row' spacing={2} sx={{p:2}}>
                                    <Button onClick={handleAddFaceModel} variant="contained" color="primary">
                                        Add Face Model
                                    </Button>
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