import * as React from 'react';
import { AppProps, AppType } from "../..";
import Icon from './icon';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { Division, DivisionsCollection } from '/imports/api/divisions';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { VisitsSummaryCollection, VisitSummary, VisitSummaryMetaCollection } from '/imports/api/visitSummary';
import {
    Paper,
    Box,
    CircularProgress,
    Grid,
    Typography,
    Divider,
    Table,
    TableHead,
    Pagination,
    TableRow,
    TableCell,
    TableBody,
    Avatar,
    IconButton,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Slide,
    Stack,
    Autocomplete,
    TextField,
    FormControlLabel,
    Checkbox

} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CustomTreeItem from './CustomTreeItem';
import PreviewIcon from '@mui/icons-material/Preview';
import IdentifyEdit from '/imports/applications/common/personsDatabase/indetifyEditForm';
import EditIcon from '@mui/icons-material/Edit';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Meteor } from 'meteor/meteor';
import ExportWizard from './exportWizard';
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});
type TreeItem = {
    id:string;
    label:string;
    children?: TreeItem[];
}
const DivisionsAppRenderer =({}:AppProps) =>{
    const [expandedItems, setExpandedItems] = React.useState<string[]>(['root']);
    const [selectedItems, setSelectedItems] = React.useState<string[]>(['root']);
    const [message, setMessage] = React.useState<string | null>(null);
    const [skip, setSkip] = React.useState<number>(0);
    const [showNotEnrolled, setShowNotEnrolled] = React.useState<boolean>(false);
    const limit= 100;
    const PersonFilter = useFind(() => VisitSummaryMetaCollection.find({}));
    const [pageFilter, setPageFilter] = React.useState<{[key: string]: any}>({idInfo:{$exists:true}});
    React.useEffect(() => {
        setPageFilter(prev => {
            const newFilter: {[key: string]: any} = {...prev, 'idInfo.divission': {$in: selectedItems}};
            if (showNotEnrolled) {
                newFilter.$or = [
                    { face_b64: { $exists: false } },
                    { face_b64: '' },
                    { face_b64: null }
                ];
            } else {
                delete newFilter.$or;
            }
            return newFilter;
        });
    }, [selectedItems, showNotEnrolled]);
    const selectedPerson = React.useMemo(() => {
            return PersonFilter.filter(person => pageFilter._id ? pageFilter._id.$in?.includes(person._id) : false);
        }, [PersonFilter, pageFilter._id]);
    useSubscribe('visitSummaryMeta');
    useSubscribe ('visitssummary', pageFilter, limit, skip, {timestamp:-1});
    const visits = useFind(() => VisitsSummaryCollection.find(pageFilter),[pageFilter]);
    const mySubs = [useSubscribe('divisions')];
    const handleExpandedItemsChange = (
        _event: React.SyntheticEvent | null,
        itemIds: string[],
    ) => {
        setExpandedItems(itemIds);
    };
    const [numPages, setNumPages] = React.useState(0);
    React.useEffect(() => {
        (async()=>{
            try{
                const count = await Meteor.callAsync('countVisits', pageFilter) as number;
                setNumPages(Math.ceil(count / 100));
            }catch (e) {
                console.error('Error counting visits:', e);
            }
        })()
    }, [pageFilter])
    const divisions = useFind(() => DivisionsCollection.find({}));
    const MyTreeView = React.useMemo(() => {
        const buildTree = (items: Division[], parentId: string | null = null): TreeItem[] => {
            return items
                .filter(item => item.parent === parentId)
                .map(item => ({
                    id: item._id || '',
                    label: item.name,
                    children: buildTree(items, item._id)
                }));
        };
        setSelectedItems(['root', ...divisions.map(d => d._id || '')]);
        return [{id:'root', label:'Select All', children: buildTree(divisions, 'root')}];
    }, [divisions]);
    React.useEffect(() => {
        console.log('Divisions:', MyTreeView);
    }, [MyTreeView])
    const [exportOpen, setExportOpen] = React.useState(false);
    const [selectedItemDialog, setSelectedItemDialog] = React.useState<VisitSummary | null>(null);
    const [idForm, setIdForm] = React.useState<boolean>(false)
    const handleEditClick = () => {
        setIdForm(true);  
    };
    const identifyEditRef = React.useRef<{ save: () => boolean, deleteSummary: () => boolean }>(null);
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
    const loading = () => mySubs.every((sub) => sub());
    
    return (
        <Paper sx={{minHeight:'100%', p:2, boxSizing:'border-box', maxWidth:'100%', overflowX:'auto'}}>
        {loading() ? (
                <Box sx={{position:'absolute', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            )
            :(
                <Grid container spacing={2}>
                    <Grid size={4}>
                        <Paper elevation={3} sx={{height:'100%', p:2}}>
                            <Typography variant ='subtitle2'>Select Divission</Typography>
                            <Divider sx={{mb:1}} />
                            <RichTreeView
                                items={MyTreeView}
                                checkboxSelection
                                multiSelect
                                selectionPropagation={{ parents: true, descendants: true }}
                                selectedItems={selectedItems}
                                expandedItems={expandedItems}
                                onExpandedItemsChange={handleExpandedItemsChange}
                                onSelectedItemsChange={(_e, newSelection) => {
                                    setSelectedItems(newSelection);
                                    console.log('Selected items:', newSelection);
                                }}
                                slots={{ item: CustomTreeItem}} 
                            />
                        </Paper>
                    </Grid>
                    <Grid size={8}>
                        <Paper elevation={3} sx={{height:'100%', p:2}}>
                            <Stack spacing={2} direction="row" alignItems="center">
                                <Typography variant ='subtitle2' sx={{width:'100%'}}>Access Controll members</Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FileDownloadIcon />}
                                    onClick={() => setExportOpen(true)}
                                    sx={{ flexShrink: 0 }}
                                >
                                    Export
                                </Button>
                                <Pagination
                                    sx={{width:'100%', display:'flex', justifyContent:'flex-end' }}
                                    count={numPages}
                                    color="secondary"
                                    page={(skip+limit)/limit}
                                    onChange={(_e, v)=>{
                                        setSkip((v-1)*limit);
                                    }}
                                />
                            </Stack>
                            <Autocomplete
                                sx={{width:'100%', mt:2}}
                                options={PersonFilter}
                                getOptionKey={(option) => `meta${option._id || ''}`}
                                getOptionLabel={(option) => `${option.idInfo?.firstName || ''} ${option.idInfo?.lastName || ''}`}
                                renderInput={(params) => <TextField {...params} label="Quick Search" variant="outlined" />}
                                multiple
                                value={selectedPerson}
                                onChange={(_event, value) => {
                                    if(!value || value.length === 0) {
                                        setPageFilter(prev => {delete prev._id; return {...prev}});
                                    } else {
                                        setPageFilter(prev=>({...prev, _id:{$in: value.map(v => v._id)}}));
                                    }
                                }}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={showNotEnrolled}
                                        onChange={(e) => setShowNotEnrolled(e.target.checked)}
                                    />
                                }
                                label="Show only not enrolled (missing face)"
                            />
                            <Divider sx={{mb:1}} />
                                {visits.length >0 
                                    ?<>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell></TableCell>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>Comment</TableCell>
                                                    <TableCell>Divission</TableCell>
                                                    <TableCell></TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {visits.map((visit, index) => (
                                                    <TableRow key={`${visit._id}_${index}`}>
                                                        <TableCell>
                                                            <Avatar
                                                                sx={{ width: 56, height: 56, borderRadius:2, cursor: 'pointer'}}
                                                                src={`data:image/jpeg;base64,${visit.face_b64}`}
                                                                 onClick={()=>{
                                                                    setSelectedItemDialog(visit);
                                                                    handleEditClick();
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {visit.idInfo?.firstName} {visit.idInfo?.lastName}
                                                        </TableCell>
                                                        <TableCell>
                                                            {visit.idInfo?.comment}
                                                        </TableCell>
                                                        <TableCell>
                                                            {divisions.find(d => d._id === visit.idInfo?.divission)?.name || 'No Division'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <IconButton onClick={()=>{
                                                                setSelectedItemDialog(visit);
                                                                handleEditClick();
                                                            }}
                                                            >
                                                                <PreviewIcon/>
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                
                                            </TableBody>
                                        </Table>
                                        <Pagination                                            sx={{width:'100%', mt:2 }}
                                            count={numPages}
                                            color="secondary"
                                            page={(skip+limit)/limit}
                                            onChange={(_e, v)=>{
                                                setSkip((v-1)*limit);
                                            }}
                                        />
                                    </> :<>
                                        No persons in this list
                                    </>}
                         </Paper>
                    </Grid>
                </Grid>
            )
        }
        {exportOpen && (
            <ExportWizard pageFilter={pageFilter} onClose={() => setExportOpen(false)} />
        )}
        <Snackbar
            open={!!message}
            autoHideDuration={6000}
            onClose={()=>{setMessage(null)}}
            message={message || ''}
        />
        {idForm && 
            <Dialog
                open={true} 
                maxWidth='xl'
                fullWidth
                slots={{
                transition: Transition,
                }}
                keepMounted
                onClose={() => { setSelectedItemDialog(null); setIdForm(false); }}
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
            </Dialog>
        }
        </Paper>
    );
}

const DivisionsManagementApp: AppType = {
    appName: 'Divisions Management',
    appIcon: <Icon />,
    render: DivisionsAppRenderer,
    module: 'accessControl',
};

export default DivisionsManagementApp;
