import React from 'react';
import Icon from './icon';
import {AppType} from '../..';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Stack, Typography, Paper, Box, IconButton, Snackbar } from '@mui/material';
import { Cam, CamsCollection } from '/imports/api/cams';
import { Meteor } from 'meteor/meteor';
import { getStreamServerUrl } from '/imports/config/env';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// const useProxiedWHEP = (streamPath: string, videoRef: React.RefObject<HTMLVideoElement>) => {
//     useEffect(() => {
//         let pc: RTCPeerConnection | null = null;
//         let sessionUrl: string | null = null;
//         let offerData: any = null;
//         let queuedCandidates: RTCIceCandidate[] = [];

//         async function start() {
//             // 1. Get ICE servers via OPTIONS
//             const iceServers: RTCIceServer[] = await Meteor.callAsync('whepOptions', streamPath);

//             // 2. Create PeerConnection
//             pc = new RTCPeerConnection({
//                 iceServers,
//             });

//             pc.addTransceiver('video', { direction: 'recvonly' });
//             pc.addTransceiver('audio', { direction: 'recvonly' });

//             pc.ontrack = (evt) => {
//                 if (videoRef.current) {
//                     videoRef.current.srcObject = evt.streams[0];
//                 }
//             };

//             pc.onicecandidate = (evt) => {
//                 if (evt.candidate) {
//                     if (!sessionUrl) {
//                         queuedCandidates.push(evt.candidate);
//                     } else {
//                         sendLocalCandidates([evt.candidate]);
//                     }
//                 }
//             };

//             // 3. Create offer
//             const offer = await pc.createOffer();
//             await pc.setLocalDescription(offer);

//             // 4. POST offer, get answer and sessionUrl
//             const { sdpAnswer, sessionUrl: returnedSessionUrl } = await Meteor.callAsync('whepPostOffer', streamPath, offer.sdp);
//             sessionUrl = returnedSessionUrl;
//             if (offer.sdp) {
//                 offerData = parseOffer(offer.sdp);
//             } else {
//                 throw new Error('Offer SDP is undefined');
//             }

//             // 5. Set remote description
//             await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer });

//             // 6. Send any queued ICE candidates
//             if (queuedCandidates.length > 0) {
//                 sendLocalCandidates(queuedCandidates);
//                 queuedCandidates = [];
//             }
//         }

//         function parseOffer(sdp: string) {
//             const ret: { iceUfrag: string; icePwd: string; medias: string[] } = {
//                 iceUfrag: '',
//                 icePwd: '',
//                 medias: [],
//             };
//             for (const line of sdp.split('\r\n')) {
//                 if (line.startsWith('m=')) {
//                     ret.medias.push(line.slice('m='.length));
//                 } else if (ret.iceUfrag === '' && line.startsWith('a=ice-ufrag:')) {
//                     ret.iceUfrag = line.slice('a=ice-ufrag:'.length);
//                 } else if (ret.icePwd === '' && line.startsWith('a=ice-pwd:')) {
//                     ret.icePwd = line.slice('a=ice-pwd:'.length);
//                 }
//             }
//             return ret;
//         }

//         async function sendLocalCandidates(candidates: RTCIceCandidate[]) {
//             if (!sessionUrl || !offerData) return;
//             const frag = generateSdpFragment(offerData, candidates);
//             await Meteor.callAsync('whepPatchCandidates', sessionUrl, frag);
//         }

//         function generateSdpFragment(od: any, candidates: RTCIceCandidate[]) {
//             const candidatesByMedia: { [mid: number]: RTCIceCandidate[] } = {};
//             for (const candidate of candidates) {
//                 const mid = candidate.sdpMLineIndex!;
//                 if (!candidatesByMedia[mid]) candidatesByMedia[mid] = [];
//                 candidatesByMedia[mid].push(candidate);
//             }
//             let frag = `a=ice-ufrag:${od.iceUfrag}\r\n` + `a=ice-pwd:${od.icePwd}\r\n`;
//             let mid = 0;
//             for (const media of od.medias) {
//                 if (candidatesByMedia[mid]) {
//                     frag += `m=${media}\r\n` + `a=mid:${mid}\r\n`;
//                     for (const candidate of candidatesByMedia[mid]) {
//                         frag += `a=${candidate.candidate}\r\n`;
//                     }
//                 }
//                 mid++;
//             }
//             return frag;
//         }

//         start();

//         return () => {
//             if (pc) {
//                 pc.getSenders().forEach(sender => sender.track && sender.track.stop());
//                 pc.close();
//             }
//             if (sessionUrl) {
//                 Meteor.call('whepDeleteSession', sessionUrl);
//             }
//         };
//     }, [streamPath, videoRef]);
// };

export const LiveCamPlayer = ({ cam, sx={} }: { cam: Cam, sx?:{[x:string]:any} }) => {
    // const videoRef = useRef<HTMLVideoElement>(null);
    // useProxiedWHEP(cam._id ||'', videoRef);
    // const[camPoster, setCamPoster] = React.useState<string | null>(null);
    // useEffect(() => {
    //     Meteor.callAsync('validateRtspLink', cam.streamurl).then((poster: string) => {
    //         setCamPoster(poster);
    //     }
    //     ).catch((error: any) => {
    //         console.error('Error validating RTSP link:', error);
    //         setCamPoster(null);
    //     }
    //     );
    // }, [cam.streamurl]);
    const [message, setMessage] = React.useState<string | null>(null)
    return (
        <Paper key={cam._id} sx={{ p: 1, minWidth: 320, ...sx, position:'relative' }}>
            <Typography variant='subtitle2' sx={{backgroundColor:'#3d3d3d', color:'#fff', textAlign:'center', p:1}} >{cam.name}</Typography>
            <IconButton 
                onClick={
                    async()=>{
                        await Meteor.callAsync('restartCamHandler', cam._id || '');
                        setMessage('Cam prrocess restarted')
                    }
                }
                color='info'
                sx={{position:'absolute', top:0, right:0, m:1}}
            >
                <RestartAltIcon />
            </IconButton>
            {/* <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls
                poster={`data:image/jpeg;base64,${camPoster}` || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8//8/AwAI/wH+9Q4AAAAASUVORK5CYII='}
                style={{ width: '100%', background: '#000' }}
            /> */}
            <Box sx={{
                position: 'relative',
                width: '100%',
                paddingTop: '56.25%', // 16:9 aspect ratio
                overflow: 'hidden',
            }}>
            <iframe
                title={cam.name}
                src={getStreamServerUrl(cam._id || '')}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                }}
                allowFullScreen
                />
            </Box>
             <Snackbar
                open={!!message}
                autoHideDuration={3000}
                onClose={()=>{setMessage(null)}}
                message={message || ''}
            />
        </Paper>
    );
};

const LivestreamRenderer = () => {
    useSubscribe('cams');
    const myCams = useFind(()=>CamsCollection.find({}));

    return (
        <Stack direction="row" sx={{ flexWrap: 'wrap'}}>
            {myCams.map(cam => (
                <LiveCamPlayer key={cam._id} cam={cam} sx={{maxWidth:'480px', m:1}}/>
            ))}
        </Stack>
    );
}

const LiveStreamApp:AppType ={
    appName: 'Live Stream',
    render: LivestreamRenderer,
    appIcon: <Icon />
}
export default LiveStreamApp;



