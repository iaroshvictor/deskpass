import React, { useEffect, useRef, useState } from 'react';
import { Meteor } from 'meteor/meteor';

import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { Alert, Box, Card, Chip, Grid, AlertTitle, Stack, Paper, Typography } from '@mui/material';
import { CamsCollection } from '/imports/api/cams';
import {VisitsSummaryCollection}   from '/imports/api/visitSummary';
import { AlertsArchiveCollection } from '/imports/api/alertsArchive';
import {AlertLists} from '/imports/api/alertLists';
import { RecordingsCollection } from '/imports/api/recordings';

// Converts a raw PAR dict to sorted {label, score} pairs ready for display.
// 'female' is always included: high score → "female", low score → "male".
export const parToChips = (par: Record<string, number | string>): {label: string, score: number}[] => {
    const chips: {label: string, score: number}[] = [];
    for (const [k, v] of Object.entries(par)) {
        if (k.endsWith('_color') || typeof v !== 'number') continue;
        if (k === 'female') {
            chips.push(v >= 0.5
                ? { label: 'female', score: v }
                : { label: 'male',   score: 1 - v }
            );
        } else if (v >= 0.6) {
            chips.push({ label: k.replace(/_/g, ' '), score: v });
        }
    }
    return chips.sort((a, b) => b.score - a.score);
};

const PREROLL_MS = 5000;

const AlertRecordingPlayer = ({ camId, timestamp }: { camId: string; timestamp: Date }) => {
    const targetMs  = timestamp.getTime() - PREROLL_MS;
    const dayStart  = new Date(timestamp); dayStart.setHours(0, 0, 0, 0);
    const dayEnd    = new Date(timestamp); dayEnd.setHours(23, 59, 59, 999);

    useSubscribe('recordings', [camId], dayStart.getTime(), dayEnd.getTime(), 50);

    const allRecs = useFind(() =>
        RecordingsCollection.find({ camId }, { sort: { startedAt: -1 } })
    );

    // segment whose window contains targetMs
    const recording = allRecs.find(r =>
        r.startedAt.getTime() <= targetMs &&
        (r.endedAt ? r.endedAt.getTime() >= targetMs : r.status === 'recording')
    );

    const videoRef   = useRef<HTMLVideoElement>(null);
    const seekDoneRef = useRef(false);

    useEffect(() => {
        seekDoneRef.current = false;
    }, [recording?._id]);

    const handleCanPlay = () => {
        if (seekDoneRef.current || !videoRef.current || !recording) return;
        seekDoneRef.current = true;
        const offset = Math.max(0, (targetMs - recording.startedAt.getTime()) / 1000);
        videoRef.current.currentTime = offset;
    };

    if (!recording) return (
        <Box sx={{ py: 1 }}>
            <Typography variant="caption" color="text.secondary">No recording available for this alert.</Typography>
        </Box>
    );

    return (
        <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                RECORDING — {new Date(targetMs).toLocaleTimeString()} + 5 s
            </Typography>
            <video
                ref={videoRef}
                src={`/dvr-media/${recording._id}`}
                controls
                onCanPlay={handleCanPlay}
                style={{ width: '100%', borderRadius: 4, marginTop: 4, background: '#000' }}
            />
        </Box>
    );
};
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
    const handleAddFaceModel = async () => {
        try {
            await Meteor.callAsync('addFaceToSummary', myAlert._id);
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
                                                Similarity: {myAlert.similarity !== undefined ? `${(myAlert.similarity * 100).toFixed(1)}%` : 'N/A'}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                )}
                                {myAlert.par && Object.keys(myAlert.par).length > 0 && (
                                    <Stack spacing={1} sx={{px:2, pb:1}}>
                                        <Typography variant="caption" color="text.secondary" sx={{fontWeight:600}}>APPEARANCE</Typography>
                                        {(['head_color','upper_color','lower_color'] as const).some(k => myAlert.par![k]) && (
                                            <Stack direction='row' spacing={2}>
                                                {(['head_color','upper_color','lower_color'] as const).map(k => myAlert.par![k] && (
                                                    <Stack key={k} direction='row' spacing={0.5} alignItems='center'>
                                                        <Box sx={{width:14, height:14, borderRadius:'50%', bgcolor:String(myAlert.par![k]), border:'1px solid #ccc'}} />
                                                        <Typography variant="caption">{k.replace('_color','')}: {myAlert.par![k]}</Typography>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        )}
                                        <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
                                            {parToChips(myAlert.par).map(({label, score}) => (
                                                <Chip
                                                    key={label}
                                                    label={`${label} ${(score * 100).toFixed(0)}%`}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Stack>
                                    </Stack>
                                )}
                                <Box sx={{px:2, pb:1}}>
                                    <AlertRecordingPlayer camId={myAlert.source} timestamp={new Date(myAlert.timestamp)} />
                                </Box>
                                <Stack direction='row' spacing={2} sx={{p:2}}>
                                    <Button
                                        onClick={handleAddFaceModel}
                                        variant="contained"
                                        color={myAlert.attached ? 'success' : 'primary'}
                                        disabled={!!myAlert.attached}
                                    >
                                        {myAlert.attached ? 'Face Model Attached' : 'Add Face Model'}
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