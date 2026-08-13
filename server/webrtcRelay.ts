import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { createClient } from 'redis';
import { Socket, connect as tcpConnect } from 'net';
import { createHash } from 'crypto';
import { PeerConnection, Video } from 'node-datachannel';
import type { PeerConnection as PC, Track } from 'node-datachannel';

// WebRTC livestream relay.
//
// Cameras run on the shared perception engine (no per-cam RTSP output), so the
// raw camera url is registered under cam:stream:<camId>. This module pulls that
// RTSP source directly (Basic/Digest auth), interleaves RTP over TCP, and
// FORWARDS the packets untouched — no transcode — into node-datachannel
// (libdatachannel) WebRTC tracks. Works for BOTH H.264 and H.265: the codec is
// read from the RTSP SDP and advertised to the browser as-is, so an H.265-capable
// browser (recent Chrome w/ HW HEVC, Safari) plays H.265 directly. Each viewer's
// forwarded packets are re-stamped with that viewer's negotiated payload type and
// a fixed SSRC. Signaling is plain DDP ('webrtcOffer').

const redisGet = await createClient()
  .on('error', (err) => console.log('webrtcRelay redis error', err))
  .connect();

// Fixed SSRC we stamp on every forwarded packet (each PeerConnection is its own
// SRTP session, so reusing one value across viewers is fine).
const RELAY_SSRC = 0x1a2b3c4d;

// ── Minimal RTSP client → raw RTP packets + detected codec ───────────────────

class RtspRtpClient {
  private sock!: Socket;
  private buf: Buffer = Buffer.alloc(0);
  private cseq = 1;
  private session = '';
  private keepalive?: ReturnType<typeof setInterval>;
  private pendingResponse: ((headers: string, body: Buffer) => void)[] = [];

  private user = '';
  private pass = '';
  private reqUrl = '';
  private auth: { realm: string; nonce: string } | null = null;
  private basic = false;

  constructor(
    private url: string,
    private onRtp: (pkt: Buffer) => void,
    private onDead: (err: Error) => void,
    private onReady: (codec: string, fmtp: string) => void,   // fired after DESCRIBE, once codec/fmtp known
  ) {
    const u = new URL(url);
    this.user = decodeURIComponent(u.username);
    this.pass = decodeURIComponent(u.password);
    u.username = ''; u.password = '';
    this.reqUrl = u.toString();
  }

  private authHeader(method: string, uri: string): string[] {
    if (!this.user) return [];
    if (this.auth) {
      const ha1 = createHash('md5').update(`${this.user}:${this.auth.realm}:${this.pass}`).digest('hex');
      const ha2 = createHash('md5').update(`${method}:${uri}`).digest('hex');
      const resp = createHash('md5').update(`${ha1}:${this.auth.nonce}:${ha2}`).digest('hex');
      return [`Authorization: Digest username="${this.user}", realm="${this.auth.realm}", ` +
              `nonce="${this.auth.nonce}", uri="${uri}", response="${resp}"`];
    }
    if (this.basic) {
      return [`Authorization: Basic ${Buffer.from(`${this.user}:${this.pass}`).toString('base64')}`];
    }
    return [];
  }

  start() {
    const u = new URL(this.url);
    this.sock = tcpConnect(parseInt(u.port || '554', 10), u.hostname, () => this.handshake());
    this.sock.on('data', (d) => this.onData(d));
    this.sock.on('error', (e) => this.die(e));
    this.sock.on('close', () => this.die(new Error('rtsp socket closed')));
  }

  stop() {
    if (this.keepalive) clearInterval(this.keepalive);
    this.onDead = () => {};
    try { this.sock.destroy(); } catch { /* already gone */ }
  }

  private die(err: Error) {
    if (this.keepalive) clearInterval(this.keepalive);
    const cb = this.onDead;
    this.onDead = () => {};
    cb(err);
  }

  private send(method: string, uri: string, extra: string[] = []): Promise<{ headers: string; body: Buffer }> {
    const lines = [
      `${method} ${uri} RTSP/1.0`,
      `CSeq: ${this.cseq++}`,
      'User-Agent: deskpass-relay',
      ...this.authHeader(method, uri),
      ...(this.session ? [`Session: ${this.session}`] : []),
      ...extra, '', '',
    ];
    this.sock.write(lines.join('\r\n'));
    return new Promise((resolve) => this.pendingResponse.push((headers, body) => resolve({ headers, body })));
  }

  private parseChallenge(headers: string): boolean {
    const wa = headers.match(/WWW-Authenticate:\s*(.+)/i)?.[1] ?? '';
    if (/^Digest/i.test(wa)) {
      const realm = wa.match(/realm="([^"]*)"/i)?.[1] ?? '';
      const nonce = wa.match(/nonce="([^"]*)"/i)?.[1] ?? '';
      this.auth = { realm, nonce };
      return !!nonce;
    }
    if (/^Basic/i.test(wa)) { this.basic = true; return true; }
    return false;
  }

  private async handshake() {
    try {
      let desc = await this.send('DESCRIBE', this.reqUrl, ['Accept: application/sdp']);
      if (/^RTSP\/1\.0 401/.test(desc.headers) && this.parseChallenge(desc.headers)) {
        desc = await this.send('DESCRIBE', this.reqUrl, ['Accept: application/sdp']);
      }
      if (!/^RTSP\/1\.0 200/.test(desc.headers)) {
        throw new Error(`DESCRIBE failed: ${desc.headers.split('\r\n')[0]}`);
      }
      const sdp = desc.body.toString();
      const vIdx = sdp.indexOf('m=video');
      if (vIdx < 0) throw new Error('no video track in SDP');

      // codec + fmtp the camera advertises. The fmtp carries profile-level-id and
      // (for server-relayed streams) sprop-parameter-sets — the SPS/PPS that such
      // streams send ONLY out-of-band. We re-advertise them in the WebRTC answer
      // so the browser can decode even when they never arrive in-band.
      const vSec = (() => { const b = sdp.slice(vIdx); const e = b.indexOf('\nm='); return e >= 0 ? b.slice(0, e) : b; })();
      let codec = vSec.match(/a=rtpmap:\d+\s+([\w-]+)\//i)?.[1]?.toUpperCase() ?? 'H264';
      if (codec === 'HEVC') codec = 'H265';
      const fmtp = vSec.match(/a=fmtp:\d+\s+([^\r\n]+)/i)?.[1]?.trim() ?? '';
      this.onReady(codec, fmtp);

      const control = sdp.slice(vIdx).match(/a=control:(\S+)/)?.[1] ?? '';
      const setupUrl = control.startsWith('rtsp://')
        ? control
        : `${this.reqUrl.replace(/\/+$/, '')}/${control}`;

      const setup = await this.send('SETUP', setupUrl,
        ['Transport: RTP/AVP/TCP;unicast;interleaved=0-1']);
      this.session = setup.headers.match(/Session:\s*([^;\r\n]+)/)?.[1] ?? '';
      if (!this.session) throw new Error('no RTSP session id');

      await this.send('PLAY', this.reqUrl, ['Range: npt=0.000-']);
      this.keepalive = setInterval(() => { this.send('OPTIONS', this.reqUrl).catch(() => {}); }, 25_000);
    } catch (e: any) {
      this.die(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private onData(chunk: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      if (this.buf.length < 1) return;
      if (this.buf[0] === 0x24) {                       // '$' interleaved RTP/RTCP
        if (this.buf.length < 4) return;
        const channel = this.buf[1];
        const len = this.buf.readUInt16BE(2);
        if (this.buf.length < 4 + len) return;
        if (channel === 0) this.onRtp(Buffer.from(this.buf.subarray(4, 4 + len)));
        this.buf = this.buf.subarray(4 + len);
      } else {
        const headEnd = this.buf.indexOf('\r\n\r\n');
        if (headEnd < 0) return;
        const headers = this.buf.subarray(0, headEnd).toString();
        const clen = parseInt(headers.match(/Content-Length:\s*(\d+)/i)?.[1] ?? '0', 10);
        if (this.buf.length < headEnd + 4 + clen) return;
        const body = this.buf.subarray(headEnd + 4, headEnd + 4 + clen);
        this.buf = this.buf.subarray(headEnd + 4 + clen);
        this.pendingResponse.shift()?.(headers, body);
      }
    }
  }
}

// ── Relay: one RTSP session per cam, RTP fan-out to WebRTC tracks ─────────────

interface Viewer { pc: PC; track: Track; pt: number; }
interface Relay  { client: RtspRtpClient; viewers: Set<Viewer>; codec: string; fmtp: string; }

const relays = new Map<string, Relay>();
const byConnection = new Map<string, Set<{ camId: string; viewer: Viewer }>>();

// Re-stamp each forwarded packet with the viewer's negotiated payload type and
// our fixed SSRC, then hand it to that viewer's track.
function forwardRtp(relay: Relay, pkt: Buffer) {
  if (pkt.length < 12) return;
  for (const v of relay.viewers) {
    const out = Buffer.from(pkt);               // copy — each viewer gets its own PT
    out[1] = (out[1] & 0x80) | (v.pt & 0x7f);   // keep marker bit, set payload type
    out.writeUInt32BE(RELAY_SSRC, 8);           // SSRC
    try { if (v.track.isOpen()) v.track.sendMessageBinary(out); } catch { /* track gone */ }
  }
}

function dropViewer(camId: string, viewer: Viewer) {
  const relay = relays.get(camId);
  if (!relay) return;
  relay.viewers.delete(viewer);
  try { viewer.pc.close(); } catch { /* already closed */ }
  if (relay.viewers.size === 0) {           // last viewer → drop RTSP session
    relay.client.stop();
    relays.delete(camId);
  }
}

async function getRelay(camId: string): Promise<Relay> {
  const existing = relays.get(camId);
  if (existing) return existing;

  // Prefer the engine's annotated RTSP output (boxes/pose/zones/lines burned in,
  // frame-aligned); fall back to the raw camera url if the engine isn't emitting one.
  const input = (await redisGet.get(`cam:annotated:${camId}`))
             || (await redisGet.get(`cam:stream:${camId}`));
  if (!input) throw new Meteor.Error('no-stream', `no live stream registered for cam ${camId}`);

  const r: Relay = { viewers: new Set(), client: null as any, codec: 'H264', fmtp: '' };
  await new Promise<void>((resolve, reject) => {
    r.client = new RtspRtpClient(
      input,
      (pkt) => forwardRtp(r, pkt),
      (err) => {                              // dies → tear down; reject is a no-op if already ready
        console.log(`webrtcRelay [${camId}] rtsp died:`, err.message);
        for (const v of r.viewers) { try { v.pc.close(); } catch { /* */ } }
        relays.delete(camId);
        reject(err);
      },
      (codec, fmtp) => { r.codec = codec; r.fmtp = fmtp; resolve(); },   // ready once codec/fmtp known
    );
    relays.set(camId, r);
    r.client.start();
  });
  return r;
}

// pick the browser payload type for the camera's codec. For H.264, prefer the PT
// whose profile-level-id matches the stream's profile (High/Main/Baseline), so
// the negotiated profile agrees with the SPS we hand over — else the first one.
function findPayloadType(offer: string, codec: string, camFmtp: string): number | null {
  if (codec === 'H265') {
    const m = offer.match(/a=rtpmap:(\d+)\s+(?:H265|HEVC)\//i);
    return m ? parseInt(m[1], 10) : null;
  }
  const camIdc = (camFmtp.match(/profile-level-id=([0-9a-f]{2})/i)?.[1] ?? '').toLowerCase();
  const pts: { pt: number; idc: string }[] = [];
  const re = /a=rtpmap:(\d+)\s+H264\//gi; let m: RegExpExecArray | null;
  while ((m = re.exec(offer))) {
    const pt = m[1];
    const plid = offer.match(new RegExp(`a=fmtp:${pt}\\s[^\\r\\n]*profile-level-id=([0-9a-f]{6})`, 'i'))?.[1]?.toLowerCase() ?? '';
    pts.push({ pt: parseInt(pt, 10), idc: plid.slice(0, 2) });
  }
  if (!pts.length) return null;
  return (pts.find((p) => camIdc && p.idc === camIdc) ?? pts[0]).pt;
}

// mid of the offer's video m-line — the answer track MUST reuse it. Chrome matches
// m-lines by mid; a mismatch makes libdatachannel append an extra m-line, which
// Chrome rejects with "order of m-lines in answer doesn't match order in offer".
function videoMid(sdp: string): string {
  const v = sdp.slice(sdp.indexOf('m=video'));
  const end = v.indexOf('\nm=');
  const block = end >= 0 ? v.slice(0, end) : v;
  return block.match(/a=mid:(\S+)/)?.[1] ?? '0';
}

Meteor.methods({
  async webrtcOffer(camId: string, sdpOffer: string) {
    check(camId, String); check(sdpOffer, String);
    if (!this.userId) throw new Meteor.Error('not-authorized');
    this.unblock();

    const relay = await getRelay(camId);

    const pt = findPayloadType(sdpOffer, relay.codec, relay.fmtp);
    if (pt == null) {
      throw new Meteor.Error('codec-unsupported',
        `this browser can't receive ${relay.codec} (camera streams ${relay.codec})`);
    }

    const pc = new PeerConnection(`relay-${camId}-${Date.now()}`, { iceServers: [] });
    const video = new Video(videoMid(sdpOffer), 'SendOnly');   // reuse the offer's mid
    // pass the camera's fmtp (profile-level-id + sprop-parameter-sets) so the
    // browser gets the SPS/PPS out-of-band even if the stream never sends them in-band.
    if (relay.codec === 'H265') video.addH265Codec(pt);
    else if (relay.fmtp) video.addH264Codec(pt, relay.fmtp);   // fmtp must be a string, not undefined
    else video.addH264Codec(pt);
    video.addSSRC(RELAY_SSRC, 'video');
    const track = pc.addTrack(video);

    const viewer: Viewer = { pc, track, pt };
    relay.viewers.add(viewer);

    pc.onStateChange((state) => {
      if (state === 'failed' || state === 'closed' || state === 'disconnected') dropViewer(camId, viewer);
    });

    // tie viewer lifetime to the DDP session (tab closed → clean up)
    const connId = this.connection?.id;
    if (connId) {
      if (!byConnection.has(connId)) {
        byConnection.set(connId, new Set());
        this.connection!.onClose(() => {
          for (const e of byConnection.get(connId) ?? []) dropViewer(e.camId, e.viewer);
          byConnection.delete(connId);
        });
      }
      byConnection.get(connId)!.add({ camId, viewer });
    }

    // setRemoteDescription(offer) auto-generates the answer; wait for ICE
    // gathering to complete so the returned SDP carries host candidates.
    const answer = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const d = pc.localDescription();
        d ? resolve(d.sdp) : reject(new Meteor.Error('no-answer', 'answer not ready'));
      }, 3000);
      pc.onGatheringStateChange((s) => {
        if (s === 'complete') {
          clearTimeout(timer);
          const d = pc.localDescription();
          if (d) resolve(d.sdp);
        }
      });
      pc.setRemoteDescription(sdpOffer, 'offer');
    });

    return answer;
  },
});
