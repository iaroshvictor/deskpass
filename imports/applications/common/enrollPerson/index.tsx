import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { AppType } from "../..";
import Icon from './icon';
import FaceScanSVG from './faceScanSvg';
import {
    Paper,
    Box,
    Typography,
    Card,
    Stack,
    Autocomplete,
    TextField,
    Alert,
    CardMedia,
    ButtonGroup,
    Button,
    Snackbar,
} from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import {LiveCamPlayer} from '/imports/applications/common/livestream';
import { CamsCollection, Cam } from '/imports/api/cams';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { VisitSummary, VisitsSummaryCollection, VisitSummaryMetaCollection, SummaryMeta } from '/imports/api/visitSummary';
import { VisitsCollection, Visit } from '/imports/api/visits';
import IdentifyEdit  from '/imports/applications/common/personsDatabase/indetifyEditForm';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Meteor } from 'meteor/meteor';
const EntrollRender =()=>{
    const steps = ['Select Cam', 'Select Person', 'Cleanup Faces' , 'Enroll/Update Person'];
    const [activeStep, setActiveStep] = useState(0);
    useSubscribe('visitSummaryMeta');
    const [selectedCam, setSelectedCam] = useState<Cam | null>(null);
    const [selectedVisitor, setSelectedVisitor] = useState<VisitSummary | null>(null);
    const [cleanup, setCleanup] = useState<Visit[]>([]);
    const [toRemove, setToRemove] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<Date>(new Date());
    const identifyEditRef = useRef<{ save: () => boolean }>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [lastSelected, setLastSelected] = useState<number | null>(null);
    const [expanded, setExpanded] = useState<string | false>('panel1');
    const PersonFilter = useFind(() => VisitSummaryMetaCollection.find({}));
    const [selectedPerson, setSelectedPerson] = useState<SummaryMeta | null>(null);
    // To call save:
    const handleSave = () => {
        if(expanded === 'panel1'){
            //need to update existing person
            try{
                Meteor.callAsync('reposessModels', selectedPerson?._id || '', cleanup.map(v=>v._id || ''))
                setMessage('Person updated successfully, you can close this window');
            } catch (error:any) {
                setMessage(`Error updating person: ${error.message}`);
            }
            
        }else{
            if (identifyEditRef.current) {
                const result = identifyEditRef.current.save();
                if (result) {
                    setMessage('Person information saved, you can close this window');
                } else {
                    setMessage('Error saving information');
                }
                // handle result
            }
        }
    };
    const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };
    const [direction, setDirection] = useState<'front' | 'right' | 'bottom' | 'left' | 'top' | 'tiltLeft' | 'tiltRight'>('front');
    const cleanupVisits = useFind(()=> VisitsCollection.find({_id:{$in:cleanup.map(v=>v._id)}}), [cleanup]);
    useSubscribe('cams')
    useSubscribe('visits', {tracking_id:selectedVisitor?._id || 0}, 0, 0, {timestamp:-1})
    useSubscribe('visitssummary', {source:(selectedCam?._id || 'voidCam'), timestamp:{$gte:startDate}});
    const visits = useFind(() => VisitsCollection.find({tracking_id: selectedVisitor?._id || 'voidTracking'}, {sort: {timestamp: -1}}), [selectedVisitor?._id]);
    useEffect(() => {
        Meteor.callAsync('optimizeVisits', selectedVisitor?._id)
    }, [visits]);
    const visitsSum = useFind(() => VisitsSummaryCollection.find({timestamp:{$gt:startDate},source: selectedCam?._id || 'voidCam'}, {sort: {timestamp: -1}}),[selectedCam?._id, startDate]);
    const directionTransforms: Record<typeof direction, string> = {
        front: 'rotateY(0deg) rotateX(0deg)',
        left: 'rotateY(30deg) rotateX(0deg)',
        right: 'rotateY(-30deg) rotateX(0deg)',
        bottom: 'rotateY(0deg) rotateX(30deg)',
        top: 'rotateY(0deg) rotateX(-30deg)',
        tiltLeft: 'rotateY(0deg) rotateX(0deg) rotateZ(-15deg)',
        tiltRight: 'rotateY(0deg) rotateX(0deg) rotateZ(15deg)',
    };
    const myCams = useFind(() => CamsCollection.find());
    // Update direction type to include new motions
    useEffect(() => {
        const directions: typeof direction[] = ['front','tiltLeft', 'tiltRight', 'front', 'right', 'bottom', 'left', 'top', 'front'];
        let idx = 0;
        const interval = setInterval(() => {
            setDirection(directions[idx]);
            idx = (idx + 1) % directions.length;
        }, 2000);
        return () => clearInterval(interval);
    }, []);
    return (
        <Paper sx={{minHeight:'100%',p:2,boxSizing:'border-box'}}>
            <Snackbar
                open={!!message}
                autoHideDuration={6000}
                onClose={()=>{setMessage(null)}}
                message={message || ''}
            />
            <Stepper activeStep={activeStep} sx={{mb:2}}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
            {activeStep === 0 &&(
                <Stack direction = 'row' spacing={2} sx={{mb:1}}>
                    <Typography variant='subtitle2' sx={{display:'flex',alignItems:'flex-end', width:'100%'}}>
                        Select the enrollment cam.
                    </Typography>
                    <Autocomplete
                        disablePortal
                        options={myCams}
                        value={selectedCam}
                        sx={{ width:'100%' }}
                        getOptionLabel={(option) => option.name}
                        onChange={(_event, newValue) => {
                            if (newValue) {
                                setSelectedCam(newValue);
                                setStartDate(new Date());
                                setActiveStep(1);
                            }
                        }}
                        renderInput={(params) => <TextField {...params} variant='standard' label='Entrollment cam' />}
                    />
                </Stack>
            )}
            {activeStep === 1 &&(
                <Stack direction='row' spacing={2}>
                    <Box sx={{position:'relative', width:'100%'}}>
                        <Typography
                            variant='body2'
                            sx={{
                                textAlign:'center',
                                position:'absolute',
                                top: '70px',
                                left: '50%',
                                color: '#fff',
                                p:1,
                                transform: 'translateX(-50%)',
                                backgroundColor: '#0000006e',
                                minWidth: '150px',
                                borderRadius: '4px'
                            }}
                        >
                                {`${['tiltLeft','tiltRight'].includes(direction)?'Tilt':'Look'}  ${['tiltLeft','tiltRight'].includes(direction)?direction.slice(4):direction}`}
                        </Typography>
                        <Box
                            sx={{
                                transition: 'transform 1.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: directionTransforms[direction],
                                margin: '0 auto',
                                position:'absolute',
                                top: '90px',
                                left: '25%',
                                width:'50%',
                                transformOrigin: 'center center',
                                zIndex: 1,
                                opacity: 0.9,
                            }}
                        >
                            <FaceScanSVG />
                        </Box>
                        {selectedCam && <LiveCamPlayer sx={{p:0}} cam={selectedCam} />}
                    </Box>
                    <Box sx={{width:'100%'}}>
                        {selectedVisitor
                            ?(
                            <>
                                <Typography variant='subtitle2' sx={{backgroundColor:'#3d3d3d', color:'#fff', textAlign:'center', p:'8px 0', width:'100%'}} >
                                    Aquire face Information
                                </Typography>
                            
                                    <ButtonGroup variant='contained' sx={{width:'100%', mb:1}}>
                                        <Button sx={{width:'100%', borderTopLeftRadius:0 }} color='primary' onClick={()=>{setSelectedVisitor(null)}}>Back</Button>
                                        {visits.length>0 && (
                                            <Button sx={{width:'100%', borderTopRightRadius:0 }} color='secondary' onClick={()=>{setCleanup(visits); setActiveStep(2)}}>Next</Button>
                                        )}
                                    </ButtonGroup>
                                <Stack spacing={1} direction='row' sx={{flexWrap:'wrap', gap:1, justifyContent:'space-between'}}>
                                    {visits.map((visit) => (
                                    <Paper key={visit._id} elevation={3}>
                                        <img src={`data:image/jpeg;base64,${visit.face_b64}`} style={{width:'80px'}} alt="Face" />
                                    </Paper>
                                    ))}
                                </Stack>
                            </>
                        ):(
                            <>
                                <Typography variant='subtitle2' sx={{backgroundColor:'#3d3d3d', color:'#fff', textAlign:'center', p:'8px 0', width:'100%'}} >
                                    Select the person you wish to enroll
                                </Typography>
                                <Stack direction = 'row' spacing={2}>
                                {visitsSum.map((visit) => (
                                    <Card elevation={3} key={visit._id} sx={{mb:1, cursor:'pointer', maxWidth:'25%', width:'100%'}} onClick={() => setSelectedVisitor(visit)}>
                                        <CardMedia
                                            component='img'
                                            image={`data:image/jpeg;base64,${visit.person_b64}`}
                                            alt={'Person Image'}
                                            sx={{
                                                width:'100%',
                                                height:'200px',
                                                objectFit:'cover',
                                                borderRadius:'4px 4px 0 0'
                                            }}
                                        />  
                                    </Card>
                                ))}
                                </Stack>
                            </>
                        )}
                    </Box>
                </Stack>
            )}
            {activeStep === 2 && (
                <>
                    <Typography variant='subtitle2' sx={{backgroundColor:'#3d3d3d', color:'#fff', textAlign:'center', p:'8px 0', width:'100%'}} >
                        Click the items you wish to remove from the list
                    </Typography>
                    <Alert variant="filled" severity="warning">
                        Select and remove all side faces. For a correct identification both eyes and mouth must be visible. Hold SHIFT key to select a range of items.
                    </Alert>
                    <ButtonGroup variant='contained' sx={{width:'100%', mb:1}}>
                        <Button sx={{width:'100%', borderTopLeftRadius:0 }} color='primary' onClick={()=>{setCleanup([]); setActiveStep(1)}}>Back</Button>
                        {toRemove.length>0 && (
                            <Button 
                                sx={{width:'100%'}}
                                color='secondary'
                                onClick={()=>{
                                    Meteor.callAsync('removeVisitItems', toRemove)
                                    setToRemove([]);
                                }}
                            >{`Delete ${toRemove.length} items`}</Button>
                        )}
                        <Button sx={{width:'100%', borderTopRightRadius:0 }} color='success' onClick={()=>{setActiveStep(3) }}>
                            Next
                        </Button>
                    </ButtonGroup>
                    <Stack spacing={1} direction='row' sx={{flexWrap:'wrap', gap:1, justifyContent:'space-between'}}>
                        {cleanupVisits.map((visit, index) => (
                        <Paper
                            key={visit._id}
                            sx={{ p: 0, maxWidth: 80, textAlign: 'center', cursor:'pointer', transform:toRemove.includes(visit._id || '')?'scale(.8)':'scale(1)', transition:'transform 0.2s ease-in-out'}}
                            elevation={toRemove.includes(visit._id || '')?5:3}
                            onClick={(e)=>{
                                if( e.shiftKey ){
                                    if (lastSelected !== null) {
                                        const start = Math.min(lastSelected, index);
                                        const end = Math.max(lastSelected, index);
                                        const newSelection = new Set(toRemove);
                                        for (let i = start; i <= end; i++) {
                                            newSelection.add(cleanupVisits[i]._id || '');
                                        }
                                        setToRemove(Array.from(newSelection));
                                    }
                                }else{
                                    setToRemove(prev=>(prev.includes(visit._id || '')? prev.filter(el=>el!==visit._id):[...prev, visit._id || '']))
                                }
                                setLastSelected(index);
                            }}
                        >
                            <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                        </Paper>
                        ))}
                    </Stack>
                </>
            )}
            {activeStep === 3 &&(
            <>
                <Accordion expanded={expanded === 'panel1'} onChange={handleChange('panel1')}>
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1bh-content"
                    id="panel1bh-header"
                    >
                    <Typography variant="subtitle2">Attach faces to existing person</Typography>
                    </AccordionSummary>
                    <AccordionDetails>

                        <Autocomplete
                            sx={{width:'100%'}}
                            options={PersonFilter}
                            getOptionKey={(option) => `meta${option._id || ''}`}
                            getOptionLabel={(option) => `${option.idInfo?.firstName || ''} ${option.idInfo?.lastName || ''}`}
                            renderInput={(params) => <TextField {...params} label="If you want to attach the faces to an existing person, select the person from the list below." variant="outlined" />}
                            value={selectedPerson}
                            onChange={(_event, value) => {
                                setSelectedPerson(value);
                            }}
                        />
                    </AccordionDetails>
                </Accordion>
                <Accordion expanded={expanded === 'panel2'} onChange={handleChange('panel2')}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel2bh-content"
                        id="panel2bh-header"
                    >
                        <Typography variant="subtitle2">Enroll new person</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <IdentifyEdit ref={identifyEditRef} tracking_id={selectedVisitor?._id || ''} visits={cleanup.map(el=>el._id ||'')}/>
                    </AccordionDetails>
                </Accordion> 
                <Button disabled={expanded === false} onClick={()=>{handleSave()}}>Save</Button>
                <Button onClick={()=>{setActiveStep(2)}}>Back</Button>
            </>
            )}
        </Paper>
    )
}
const EnrollPersonApp: AppType = {
    appName: 'Enroll New Person',
    appIcon: <Icon />,
    render: EntrollRender
};

export default EnrollPersonApp;
