// Livestream signaling lives in server/webrtcRelay.ts ('webrtcOffer' method):
// the browser exchanges SDP over DDP and receives the cam process's H.264 RTP
// via werift — no MediaMTX / WHEP proxy involved anymore.
export default {};
