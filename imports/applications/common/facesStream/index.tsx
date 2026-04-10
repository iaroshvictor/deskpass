import React from 'react';
import { AppType } from "../..";
import { VisitsSummaryCollection } from '/imports/api/visitSummary';
import { CamsCollection } from '/imports/api/cams';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import {Paper, Stack, Typography, Badge} from '@mui/material';
import Icon from './icon';

const facesStreamRender = () => {
    useSubscribe('visitssummary', {}, 20);
    useSubscribe('cams');
    const Cams = useFind(() => CamsCollection.find({}, { sort: { name: 1 } }));
    const visits = useFind(() => VisitsSummaryCollection.find({}, { sort: { timestamp: -1 } }));
    const getCamName = (camId: string) => {
        const cam = Cams.find(c => c._id === camId);
        return cam ? cam.name : 'Unknown Camera';
    }
  return (
    <Paper sx={{minHeight:'100%',p:2,boxSizing:'border-box'}}>
        <Stack spacing={1} direction='row' sx={{flexWrap:'wrap', gap:1, justifyContent:'space-between'}}>
                {visits.map((visit) => (
                <Paper key={visit._id} sx={{ p: 0, maxWidth: 80, textAlign: 'center'}}>
                    <Stack direction="column" spacing={1} sx={{width: '100%', textAlign: 'center' }}>
                        <Badge badgeContent={visit.faces || 0} color="primary" max={9999}>
                            <img src={`data:image/jpeg;base64,${visit.face_b64}`} alt="Face" style={{maxWidth:'100%'}} />
                        </Badge>
                        <Typography sx={{overflow:'hidden', display:'-webkit-box', lineClamp:2, WebkitLineClamp:2,wordBreak:'break-all'}} variant="caption">{getCamName(visit.source)}</Typography>
                        <Typography sx={{mt:0}} variant="body2">{visit.timestamp.toLocaleString()}</Typography>
                    </Stack>
                </Paper>
                ))}
            </Stack>
    </Paper>
  );
}

const facesStream:AppType={
    appName:'Faces Stream',
    appIcon:<Icon  />,
    render:facesStreamRender
}
export default facesStream;