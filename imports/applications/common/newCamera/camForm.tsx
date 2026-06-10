import React, { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import {
    Stack, TextField, Button, Box, Popover, Backdrop, CircularProgress,
    List, FormControlLabel, Switch, Divider, ListItem, ListItemText,
    ListItemButton, ListItemIcon, Radio
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Zone } from '/imports/api/zones';
import { Cam, CamLine, CamOverlayZone } from '/imports/api/cams';
import { CamLineDefsCollection } from '/imports/api/camLineDefs';
import { CamZoneDefsCollection } from '/imports/api/camZoneDefs';
import CamOverlay from './camOverlay';

type zoneItemProps = {
    selectedZoneId: string | null,
    setSelectedZoneId: (zoneId: string | null) => void,
    zone: Zone,
    zones: Zone[]
}
const ZoneItem = (props: zoneItemProps) => {
    const { selectedZoneId, setSelectedZoneId, zone, zones } = props;
    return (
        <>
            <ListItem
                disableGutters
                key={zone._id}
                sx={{ p: 0, borderLeft: '1px solid #ccc' }}
            >
                <ListItemButton role={undefined} onClick={() => { setSelectedZoneId(zone._id || ''); }} dense>
                    <ListItemIcon>
                        <Radio
                            sx={{ p: 0 }}
                            checked={selectedZoneId === zone._id}
                            onChange={setSelectedZoneId.bind(null, zone._id || '')}
                            value="b"
                            name="zone"
                        />
                    </ListItemIcon>
                    <ListItemText id={zone._id} primary={zone.name} />
                </ListItemButton>
            </ListItem>

            {zones.filter(z => z.parent === zone._id).length > 0 && (
                <List dense sx={{ borderTop: '1px solid #8080801f', borderBottom: '1px solid #8080801f', ml: 3 }}>
                    {zones.filter(z => z.parent === zone._id).map((childZone) => (
                        <ZoneItem
                            key={childZone._id}
                            zone={childZone}
                            selectedZoneId={selectedZoneId}
                            setSelectedZoneId={setSelectedZoneId}
                            zones={zones}
                        />
                    ))}
                </List>
            )}
        </>
    );
};

type camFormProps = {
    setErrorMessage: (message: string) => void
    rtspLink?: string
    setRtspLink?: (link: string) => void
    Zones: Zone[]
    resetAddForm?: () => void
    Cam?: Cam
    camName?: string
    setCamName?: (name: string) => void
    imageData?: string | null
    setImageData?: (data: string | null) => void
}

const CamForm = (props: camFormProps) => {
    const {
        setErrorMessage,
        rtspLink,
        setRtspLink,
        Zones,
        resetAddForm,
        Cam,
        camName,
        setCamName,
        imageData,
        setImageData
    } = props;

    useSubscribe('cam_line_defs');
    useSubscribe('cam_zone_defs');
    const lineDefs = useFind(() => CamLineDefsCollection.find());
    const zoneDefs = useFind(() => CamZoneDefsCollection.find());

    const [loading, setLoading] = useState<boolean>(Cam && !Cam.snapshot ? true : false);
    const [editRtspLink, setEditRtspLink] = useState<string>(Cam?.streamurl || '');
    const [editCamName, setEditCamName] = useState<string>(Cam?.name || '');
    const [localImageData, setLocalImageData] = useState<string | null>(imageData || Cam?.snapshot || null);
    const [faceAlert, setFaceAlert] = useState<boolean>(Cam?.faceAlert ?? true);
    const [disableSpoofFilter, setDisableSpoofFilter] = useState<boolean>(Cam?.disableSpoofFilter || false);
    const [accessControl, setAccessControl] = useState<boolean>(Cam?.accessControl ?? true);
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(Cam?.zone || null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [lines, setLines] = useState<CamLine[]>(Cam?.lines || []);
    const [overlayZones, setOverlayZones] = useState<CamOverlayZone[]>(Cam?.overlayZones || []);

    const handleClose = () => { setAnchorEl(null); };
    const open = Boolean(anchorEl);

    useEffect(() => {
        if (Cam && !Cam.snapshot) {
            Meteor.callAsync('validateRtspLink', Cam.streamurl).then((img: string) => {
                if (img) {
                    setLocalImageData(img);
                    setLoading(false);
                }
            }).catch((error: any) => {
                console.error('Error validating RTSP link:', error);
                setErrorMessage(error.reason);
                setLoading(false);
            });
        }
    }, [Cam]);

    const id = open ? 'simple-popover' : undefined;
    const currentImage = imageData || localImageData;

    return (<>
        <Backdrop
            sx={{ color: '#fff', zIndex: 99999 }}
            open={loading}
            onClick={handleClose}
        >
            <CircularProgress color="inherit" />
        </Backdrop>
        <Stack direction='row' spacing={2} sx={{ mt: 2 }}>
            <TextField
                sx={{ width: '100%' }}
                label="RTSP Link"
                variant="outlined"
                size="small"
                value={rtspLink || editRtspLink || ''}
                onChange={(e) => { setRtspLink ? setRtspLink(e.target.value) : setEditRtspLink(e.target.value); }}
            />
            <Button
                sx={{ width: '100%' }}
                variant="contained"
                onClick={async () => {
                    try {
                        const serverImageData = await Meteor.callAsync('validateRtspLink', rtspLink || editRtspLink);
                        if (serverImageData) {
                            setImageData ? setImageData(serverImageData) : setLocalImageData(serverImageData);
                        }
                    } catch (error: any) {
                        console.error('Error validating RTSP link:', error);
                        setErrorMessage(error.reason);
                    }
                }}
            >
                Validate & preview RTSP
            </Button>
        </Stack>
        {currentImage && (
            <Stack direction='row' spacing={2} sx={{ mt: 2 }}>
                {/* LEFT: camera image with interactive overlay */}
                <Box sx={{ mt: 2, width: '100%' }}>
                    <CamOverlay
                        imageData={currentImage}
                        lines={lines}
                        overlayZones={overlayZones}
                        lineDefs={lineDefs}
                        zoneDefs={zoneDefs}
                        onChange={(l, z) => { setLines(l); setOverlayZones(z); }}
                        onError={setErrorMessage}
                    />
                </Box>

                {/* RIGHT: settings column */}
                <Stack direction='column' spacing={2} sx={{ mt: 2, width: '100%' }}>
                    <TextField
                        sx={{ width: '100%' }}
                        label="Camera Name"
                        variant="outlined"
                        size="small"
                        onChange={(e) => { setCamName ? setCamName(e.target.value) : setEditCamName(e.target.value); }}
                        value={camName || editCamName || ''}
                    />
                    <Button
                        sx={{ width: '100%' }}
                        variant="outlined"
                        onClick={(event) => { setAnchorEl(event.currentTarget); }}
                    >
                        {selectedZoneId ? `Selected Zone: ${Zones.find(z => z._id === selectedZoneId)?.name}` : 'Select Zone'}
                        <ArrowDropDownIcon />
                    </Button>
                    <Popover
                        id={id}
                        open={open}
                        anchorEl={anchorEl}
                        onClose={handleClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                        <List dense>
                            {Zones.filter(zone => zone.parent === 'root').map((zone) => (
                                <ZoneItem
                                    zone={zone}
                                    selectedZoneId={selectedZoneId}
                                    setSelectedZoneId={(id: string | null) => { if (id) { setSelectedZoneId(id); handleClose(); } }}
                                    key={zone._id}
                                    zones={Zones}
                                />
                            ))}
                        </List>
                    </Popover>
                    <Divider />
                    <FormControlLabel control={<Switch checked={disableSpoofFilter} onChange={(_e, v) => { setDisableSpoofFilter(v); }} />} label="Disable Spoof Filter" />
                    <FormControlLabel control={<Switch checked={faceAlert} onChange={(_e, v) => { setFaceAlert(v); }} />} label="Person Alert" />
                    <FormControlLabel control={<Switch checked={accessControl} onChange={(_e, v) => { setAccessControl(v); }} />} label="Access Control" />
                    <Divider />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={async () => {
                            if (!selectedZoneId) {
                                setErrorMessage('Please select a zone');
                                return;
                            }
                            if ((camName || editCamName).trim() === '') {
                                setErrorMessage('Please enter a camera name');
                                return;
                            }
                            try {
                                const mycam: Cam = {
                                    name: camName || editCamName,
                                    streamurl: rtspLink || editRtspLink,
                                    faceAlert: faceAlert,
                                    accessControl: accessControl,
                                    zone: selectedZoneId,
                                    disableSpoofFilter: disableSpoofFilter,
                                    snapshot: imageData || localImageData || '',
                                    lines: lines,
                                    overlayZones: overlayZones,
                                };
                                if (Cam && Cam._id) {
                                    await Meteor.callAsync('updateCam', Cam._id, mycam);
                                    setErrorMessage('Cam updated Successfully');
                                } else {
                                    await Meteor.callAsync('insertCam', mycam);
                                    setErrorMessage('Cam Added Successfully');
                                    if (resetAddForm) resetAddForm();
                                    if (setRtspLink) setRtspLink('');
                                    setFaceAlert(true);
                                    setAccessControl(true);
                                    setSelectedZoneId(null);
                                    setDisableSpoofFilter(false);
                                    setLines([]);
                                    setOverlayZones([]);
                                    if (setImageData) setImageData(null);
                                    setAnchorEl(null);
                                }
                            } catch (error: any) {
                                setErrorMessage(error.reason);
                            }
                        }}
                    >
                        {Cam ? 'Save edit' : 'Add Camera'}<SaveIcon />
                    </Button>
                </Stack>
            </Stack>
        )}
    </>);
};

export default CamForm;
