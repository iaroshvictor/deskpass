import React from 'react';
import Icon from './icon';
import {AppType} from '../..';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Stack, Typography, Paper, Box, IconButton, Snackbar, Chip, Button } from '@mui/material';
import { Cam, CamsCollection } from '/imports/api/cams';
import { CamEventsCollection, CamLiveStatusCollection } from '/imports/api/camEvents';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// Client-only collection fed by the 'cam_overlay' publication (server/main.ts).
const CamOverlayCollection = new Mongo.Collection<any>('cam_overlay');

// The boxes/pose/zones/lines are now burned into the DeepStream video (engine
// nvdsosd → annotated RTSP), so there is no client-side canvas overlay — only
// the sidebar below. Raw-source fallback shows clean video (no annotations).

// Right-side sidebar: live stats + recent face thumbnails (the annotated-stream look).
const OverlaySidebar = ({ cam }: { cam: Cam }) => {
  useSubscribe('cam_overlay', cam._id);
  const ov = useFind(() => CamOverlayCollection.find({ _id: cam._id }))[0];
  const status = useFind(() => CamLiveStatusCollection.find({ _id: cam._id }))[0];
  const thumbs = React.useRef<string[]>([]);
  const faces = ov?.faces?.filter((f: any) => f.thumb) || [];
  if (faces.length) { thumbs.current = [...faces.map((f: any) => f.thumb), ...thumbs.current].slice(0, 6); }
  return (
    <Box sx={{
      position:'absolute', top:0, right:0, height:'100%', width:120,
      background:'rgba(12,12,12,.72)', color:'#fff', p:0.5, pointerEvents:'none',
      display:'flex', flexDirection:'column', gap:0.5,
    }}>
      <Typography sx={{ fontSize:10, color:'#8ab4ff' }}>PERSONS</Typography>
      <Typography sx={{ fontSize:26, fontWeight:700, lineHeight:1 }}>{status?.persons ?? ov?.persons?.length ?? '—'}</Typography>
      <Typography sx={{ fontSize:10, color:'#7CFC00' }}>FPS</Typography>
      <Typography sx={{ fontSize:16 }}>{(ov?.fps ?? status?.fps ?? 0).toFixed(1)}</Typography>
      <Typography sx={{ fontSize:10, color:'#FFD700' }}>FACES</Typography>
      <Typography sx={{ fontSize:16 }}>{status?.faces ?? ov?.faces?.length ?? 0}</Typography>
      <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0.3, mt:0.5 }}>
        {thumbs.current.map((t, i) => (
          <img key={i} src={`data:image/jpeg;base64,${t}`} style={{ width:'100%', borderRadius:2 }} />
        ))}
      </Box>
    </Box>
  );
};
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

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

// WebRTC livestream: SDP offer/answer over DDP ('webrtcOffer' method, see
// server/webrtcRelay.ts), media over a normal RTCPeerConnection.  The server
// forwards the cam process's H.264 RTP untouched — no transcoding anywhere.
const useWebRtcLive = (
    camId: string,
    videoRef: React.RefObject<HTMLVideoElement>,
    epoch: number,
    onState: (s: 'connecting' | 'live' | 'error') => void,
) => {
    React.useEffect(() => {
        if (!camId) return;
        let pc: RTCPeerConnection | null = null;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let disposed = false;

        const start = async () => {
            if (disposed) return;
            onState('connecting');
            pc = new RTCPeerConnection();
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.ontrack = (evt) => {
                if (videoRef.current) videoRef.current.srcObject = evt.streams[0];
            };
            pc.onconnectionstatechange = () => {
                if (!pc || disposed) return;
                if (pc.connectionState === 'connected') onState('live');
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    onState('error');
                    pc.close(); pc = null;
                    retry = setTimeout(start, 3000);
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            // non-trickle: wait for ICE gathering so the offer carries candidates
            await new Promise<void>((resolve) => {
                if (pc!.iceGatheringState === 'complete') return resolve();
                const timer = setTimeout(resolve, 2000);
                pc!.onicegatheringstatechange = () => {
                    if (pc?.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); }
                };
            });

            try {
                const answerSdp: string = await Meteor.callAsync(
                    'webrtcOffer', camId, pc!.localDescription!.sdp);
                if (disposed || !pc) return;
                await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
            } catch (e) {
                console.error('webrtcOffer failed:', e);
                onState('error');
                pc?.close(); pc = null;
                retry = setTimeout(start, 5000);
            }
        };
        start();
        return () => {
            disposed = true;
            if (retry) clearTimeout(retry);
            pc?.close();
        };
    }, [camId, epoch]);
};

// Live status chips + recent line-crossing events for one cam.
// Data arrives from the perception engine via redis 'cam_events' → CamLiveStatus / CamEvents.
const CamLiveInfo = ({ cam }: { cam: Cam }) => {
    useSubscribe('cam_live_status');
    useSubscribe('cam_events', cam._id || '', 10);
    const status = useFind(() => CamLiveStatusCollection.find({ _id: cam._id }))[0];
    const events = useFind(() => CamEventsCollection.find(
        { source: cam._id }, { sort: { timestamp: -1 }, limit: 10 }));

    const lineLabel = (lineId: string) =>
        cam.lines?.find(l => l.lineId === lineId)?.label || lineId;
    const zoneLabel = (zoneId: string) =>
        cam.overlayZones?.find(z => z.zoneId === zoneId)?.label || zoneId;

    return (
        <Box sx={{ p: 0.5 }}>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                <Chip size="small" label={`${status?.fps?.toFixed(1) ?? '—'} fps`} />
                <Chip size="small" color={status?.persons ? 'primary' : 'default'}
                      label={`persons ${status?.persons ?? '—'}`} />
                {Object.entries(status?.zoneCounts ?? {}).map(([zid, cnt]) => (
                    <Chip key={zid} size="small"
                          color={cnt > 0 ? 'warning' : 'default'}
                          label={`${zoneLabel(zid)}: ${cnt}`} />
                ))}
                {Object.entries(status?.zoneMotion ?? {}).map(([zid, score]) => (
                    <Chip key={`m-${zid}`} size="small" variant="outlined"
                          label={`${zoneLabel(zid)} motion ${score.toFixed(1)}`} />
                ))}
            </Stack>
            {events.length > 0 && (
                <Box sx={{ mt: 0.5, maxHeight: 96, overflowY: 'auto' }}>
                    {events.map(ev => (
                        <Typography key={ev._id} variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                            {ev.timestamp.toLocaleTimeString()} — P#{ev.tid} crossed «{lineLabel(ev.line)}» → {ev.to}
                        </Typography>
                    ))}
                </Box>
            )}
        </Box>
    );
};

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
    const [streamEpoch, setStreamEpoch] = React.useState(0)   // bump to force stream reconnect
    const [streamState, setStreamState] = React.useState<'connecting' | 'live' | 'error'>('connecting')
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const videoBoxRef = React.useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = React.useState(false)
    const [showOverlay, setShowOverlay] = React.useState(true)
    useWebRtcLive(cam._id || '', videoRef, streamEpoch, setStreamState)
    React.useEffect(() => {
        const onChange = () => setIsFullscreen(document.fullscreenElement === videoBoxRef.current)
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])
    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
        } else {
            videoBoxRef.current?.requestFullscreen().catch(() => {})
        }
    }
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
            <Box ref={videoBoxRef} sx={{
                position: 'relative',
                width: '100%',
                paddingTop: '49.63%', // DS output is 2176×1080 (video + sidebar)
                overflow: 'hidden',
                backgroundColor: '#000',
            }}>
            {/* processed DeepStream output via WebRTC (server/webrtcRelay.ts) */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                }}
                />
            {/* boxes/pose/zones/lines are burned into the DeepStream video now — sidebar only */}
            {showOverlay && <OverlaySidebar cam={cam} />}
            {streamState !== 'live' && (
                <Typography variant="caption" sx={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)', color: '#888',
                }} onClick={() => setStreamEpoch(e => e + 1)}>
                    {streamState === 'connecting' ? 'connecting…' : 'stream unavailable — click to retry'}
                </Typography>
            )}
            <Button size="small" onClick={() => setShowOverlay(v => !v)}
                sx={{ position:'absolute', bottom:4, left:4, minWidth:0, px:1,
                      color:'#fff', backgroundColor:'rgba(0,0,0,.45)', fontSize:10,
                      '&:hover':{ backgroundColor:'rgba(0,0,0,.7)' } }}>
                {showOverlay ? 'sidebar ✓' : 'sidebar'}
            </Button>
            <IconButton
                onClick={toggleFullscreen}
                size="small"
                sx={{
                    position: 'absolute', bottom: 4, right: 4,
                    color: '#fff', backgroundColor: 'rgba(0,0,0,0.45)',
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                }}
            >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
            </Box>
            <CamLiveInfo cam={cam} />
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



