import * as React from 'react';
import { Meteor } from 'meteor/meteor';
import { ControllersCollection , Controller} from '/imports/api/controllers';
import { useState } from 'react';
import { AppType } from "../..";
import Icon from './icon'
import CircularProgress from '@mui/material/CircularProgress';
import {
    Paper,
    Stack,
    ButtonGroup,
    Table,
    TableHead,
    TableBody,
    TableRow,
    Divider,
    Button,
    TextField,
    Card,
    Typography,
    CardContent,
    Box,
    Stepper,
    Step,
    StepLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    TableCell,
    Dialog,
    DialogActions,
    DialogTitle,
    DialogContent
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
const ControllersAppRenderer= () => {
    const loading = useSubscribe('controllers');
    const controllers = useFind(() => ControllersCollection.find());
    type controllerManufacturer = {
        name: string;
        logo: string;
        description: string;
    }
    const controllerManufacturers:controllerManufacturer[] =[{
        name:'Apollo security',
        logo:'/controllers/apollo.png',
        description:'ASP-4, ASP-2, AAN-100, AAN-32, AAN-4/2/1'
    },
    {
        name:'Compass33',
        logo:'/controllers/compass33.svg',
        description:'Integrated Compass33 Access Controll server'
    }]
    const [selectedmanufacturer, setSelectedmanufacturer] = useState<controllerManufacturer | null>(null);
    const [activeStep, setActiveStep] = useState<number>(0);
    const [name, setName] = useState<string>('')
    const [address, setAddress] = useState<string>('');
    const [editController, setEditController] = useState<Controller | null>(null);
    const [deteleController, setDeleteController] = useState<Controller | null>(null);
    const steps=[
        'Select Controller Manufacturer',
        'Complete the form',
        'Review and submit'
    ]
    return <>
        <Paper sx={{minHeight:'100%', p:2, boxSizing:'border-box', maxWidth:'100%', overflowX:'auto'}}>
            {loading() ? (
                <Box sx={{ display: 'flex' }}>
                    <CircularProgress />
                </Box>
            )
            :(<>
                <Dialog open={editController !== null} onClose={()=>{ setEditController(null)}}>
                    <DialogTitle>{`Edit ${editController?.name}`}</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2}>
                                <TextField
                                    value={editController?.name || ''}
                                    onChange={(e) => {
                                        if (editController) {
                                            setEditController({ ...editController, name: e.target.value });
                                        }
                                    }}
                                    label="Controller Name"
                                    variant="standard"
                                    color='secondary'
                                />
                                <TextField
                                    value={editController?.address || ''}
                                    onChange={(e) => {
                                        if (editController) {
                                            setEditController({ ...editController, address: e.target.value });
                                        }
                                    }}
                                    label="Controller Address"
                                    variant="standard"
                                    color='secondary'
                                />
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={()=>{setEditController(null)}}>Cancel</Button>
                            <Button onClick={()=>{
                                try{
                                    if (!editController?._id) {
                                        throw new Error('Controller ID is required for editing');
                                    }
                                    Meteor.callAsync('editController', editController._id, {
                                        name: editController.name,
                                        address: editController.address,
                                        manufacturer: editController.manufacturer
                                    });
                                }catch(e){
                                    console.error('Error editing controller:', e);
                                    alert('Failed to edit controller. Please try again.');
                                    return;
                                }
                                setEditController(null);
                            }}>Save</Button>
                        </DialogActions>
                </Dialog>
                <Dialog open={deteleController !== null} onClose={()=>{ setDeleteController(null)}}>
                    <DialogTitle>{`Delete ${deteleController?.name}`}</DialogTitle>
                    <DialogContent>
                        <Typography>Are you sure you want to delete this controller?</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={()=>{setDeleteController(null)}}>Cancel</Button>
                        <Button onClick={async () => {
                            try {
                                await Meteor.callAsync('removeController', deteleController?._id);
                            } catch (e) {
                                console.error('Error removing controller:', e);
                                alert('Failed to remove controller. Please try again.');
                            }
                            setDeleteController(null);
                        }}>Delete</Button>
                    </DialogActions>
                </Dialog>
                <Accordion defaultExpanded= {controllers.length === 0} sx={{mb:2}}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel1-content"
                        id="panel1-header"
                    >
                        <Typography component="span">Add new Controller</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ width: '100%' }}>
                            <Stepper activeStep={activeStep} alternativeLabel>
                                {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                                ))}
                            </Stepper>
                        </Box>
                        {activeStep === 0 &&(
                            <>
                            <Stack direction='row' spacing={2} sx={{mt:2}}>
                                {controllerManufacturers.map((manufacturer, index) => (
                                <Card
                                    raised
                                    key={index}
                                    sx={ selectedmanufacturer?.name === manufacturer.name
                                        ?{
                                            cursor:'pointer',
                                            display: 'flex',
                                            flexDirection:'row',
                                            width:'100%',
                                            maxWidth:'50%',
                                            pl:2,
                                            pr:2,
                                            scale:1.03,
                                            backgroundColor:'rgba(0, 0, 0, 0.1)',
                                        }
                                        :{
                                            cursor:'pointer',
                                            display: 'flex',
                                            flexDirection:'row',
                                            width:'100%',
                                            maxWidth:'50%',
                                            pl:2,
                                            pr:2,
                                            scale:0.9
                                        }
                                    }
                                    onClick={() => {
                                        setSelectedmanufacturer(manufacturer);
                                        setActiveStep(1);
                                    }}
                                >
                                    <Box sx={{width:'50%', display: 'flex', flexDirection: 'column' }}>
                                        <CardContent sx={{ flex: '1 0 auto' }}>
                                            <Typography component="div" variant="h5">
                                                {manufacturer.name}
                                            </Typography>
                                            <Typography
                                                variant="subtitle1"
                                                component="div"
                                                sx={{ color: 'text.secondary' }}
                                            >
                                            {manufacturer.description}
                                            </Typography>
                                        </CardContent>
                                    </Box>
                                    <Box sx={{width:'50%',display:'flex', alignContent:'center', flexWrap:'wrap'}}>
                                        <img style={{maxWidth:'100%'}} src={manufacturer.logo} alt={manufacturer.name} />
                                    </Box>
                                </Card>
                                ))}
                            </Stack>
                            {selectedmanufacturer && (
                                <Stack direction='row' spacing={2} sx={{mt:2, flexDirection:'row-reverse'}}>
                                    <ButtonGroup variant="contained" aria-label="Step actions">
                                        <Button disabled>{`<< Back`}</Button>
                                        <Button onClick={()=>{setActiveStep(1)}}>{`Next >>`}</Button>
                                    </ButtonGroup>
                                </Stack>
                            )}
                            </>
                        )}
                        {activeStep === 1 &&(
                            <Stack spacing={2} sx={{mt:2}}>
                                <Divider/>
                                <Box>
                                    <Typography variant="subtitle1">Manufacturer: {selectedmanufacturer?.name}</Typography>
                                </Box>
                                <Box>
                                    <TextField value={name} onChange={(e)=>{setName(e.target.value)}} id="standard--name" label="Controller Name" variant="standard" color='secondary' />
                                </Box>
                                <Box>
                                    <TextField value={address} onChange={(e)=>{setAddress(e.target.value)}} id="standard-basic" label="Controller Address" variant="standard" color='secondary' />
                                </Box>
                                
                                <Stack direction='row' spacing={2} sx={{mt:2, flexDirection:'row-reverse'}}>
                                    <ButtonGroup variant="contained" aria-label="Step actions">
                                        <Button onClick={()=>{setActiveStep(0)}}>{`<< Back`}</Button>
                                        <Button onClick={()=>{setActiveStep(2)}}>{`Next >>`}</Button>
                                    </ButtonGroup>
                                </Stack>
                            </Stack>
                        )}
                        {activeStep === 2 &&(
                            <Stack spacing={2} sx={{mt:2}}>
                                <Divider/>
                                <Typography variant="h6">Review and Submit</Typography>
                                <Box>
                                    <Table>
                                        <TableBody>
                                            <TableRow sx={{backgroundColor:'rgba(0, 0, 0, 0.1)'}}>
                                                <TableCell><Typography variant='subtitle2'> Manufacturer </Typography></TableCell>
                                                <TableCell>{selectedmanufacturer?.name}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell>{name}</TableCell>
                                            </TableRow>
                                            <TableRow  sx={{backgroundColor:'rgba(0, 0, 0, 0.1)'}}>
                                                <TableCell>Address</TableCell>
                                                <TableCell>{address}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </Box>
                                <Stack direction='row' spacing={2} sx={{mt:2, flexDirection:'row-reverse'}}>
                                    <ButtonGroup variant="contained" aria-label="Step actions">
                                        <Button onClick={()=>{setActiveStep(1)}}>{`<< Back`}</Button>
                                        <Button onClick={async()=>{
                                            try{
                                                await Meteor.callAsync('addController', {
                                                    name,
                                                    address,
                                                    manufacturer: selectedmanufacturer?.name || ''
                                                });
                                            }catch(e){
                                                console.error('Error adding controller:', e);
                                                alert('Failed to add controller. Please try again.');
                                                return;
                                            }
                                            setActiveStep(0);
                                            setSelectedmanufacturer(null);
                                            setName('');
                                            setAddress('');
                                        }}>{`Submit`}</Button>
                                    </ButtonGroup>
                                </Stack>
                            </Stack>
                        )}
                    </AccordionDetails>
                </Accordion>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Controller Name</TableCell>
                            <TableCell>Manufacturer</TableCell>
                            <TableCell>Address</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {controllers.map((controller, index) => (
                            <TableRow key={controller._id} sx={index % 2 === 0 ? { backgroundColor: 'rgba(0, 0, 0, 0.1)' } : {}}>
                                <TableCell>{controller.name}</TableCell>
                                <TableCell>{controller.manufacturer}</TableCell>
                                <TableCell>{controller.address}</TableCell>
                                <TableCell>
                                    <ButtonGroup variant="contained" aria-label="Controller actions">
                                        <Button onClick={async () => {
                                            setEditController(controller);
                                        }}>Edit</Button>
                                        <Button onClick={async () => {
                                            setDeleteController(controller);
                                        }}>Remove</Button>
                                    </ButtonGroup>
                                </TableCell>
                            </TableRow>
                            
                        ))}
                        </TableBody>
                </Table>
            </>)}
        </Paper>
    </>
}

const ControllersApp: AppType = {
    appName: 'Controllers',
    appIcon: <Icon />,
    render: () => <ControllersAppRenderer />,
    module: 'accessControl',
};

export default ControllersApp;
