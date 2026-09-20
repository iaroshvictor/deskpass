// Minimal DDP client for security tests.
//
// Talks raw DDP over the websocket endpoint Meteor exposes at /websocket, the
// same way any third party on the network would. Deliberately does NOT use the
// app's own client code: these tests must see the server exactly as an
// untrusted outsider does, with no bundled helpers and no logged-in session.
import WebSocket from 'ws';

const DEFAULT_URL = process.env.DESKPASS_URL || 'ws://localhost:3000/websocket';

export class DdpClient {
  constructor(url = DEFAULT_URL) {
    this.url = url;
    this.ws = null;
    this.nextId = 0;
    this.pending = new Map();   // method/sub id -> {resolve, reject}
    this.docs = new Map();      // collection -> Map(docId -> fields)
    this.connected = false;
  }

  connect(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DDP connect timeout')), timeoutMs);
      this.ws = new WebSocket(this.url);
      this.ws.on('message', (raw) => this._onMessage(String(raw)));
      this.ws.on('error', (e) => { clearTimeout(timer); reject(e); });
      this.ws.on('open', () => {
        this.ws.send(JSON.stringify({ msg: 'connect', version: '1', support: ['1'] }));
      });
      this._onConnected = () => { clearTimeout(timer); this.connected = true; resolve(this); };
    });
  }

  _onMessage(raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.msg) {
      case 'connected':
        this._onConnected?.();
        break;
      case 'ping':
        this.ws.send(JSON.stringify({ msg: 'pong', id: m.id }));
        break;
      case 'added': {
        if (!this.docs.has(m.collection)) this.docs.set(m.collection, new Map());
        this.docs.get(m.collection).set(m.id, m.fields || {});
        break;
      }
      case 'ready':
        for (const id of m.subs || []) this.pending.get(id)?.resolve({ ok: true });
        break;
      case 'nosub':
        this.pending.get(m.id)?.resolve({ ok: false, error: m.error });
        break;
      case 'result':
        this.pending.get(m.id)?.resolve({ result: m.result, error: m.error });
        break;
    }
  }

  _send(payload, id, timeoutMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: { error: 'timeout' }, timedOut: true }), timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); } });
      this.ws.send(JSON.stringify(payload));
    });
  }

  /** Subscribe. Resolves {ok:true} when the server sends data, {ok:false,error} when it refuses. */
  subscribe(name, params = [], timeoutMs = Number(process.env.DESKPASS_SUB_TIMEOUT_MS || 25000)) {
    const id = String(++this.nextId);
    return this._send({ msg: 'sub', id, name, params }, id, timeoutMs);
  }

  /** Call a method. Resolves {result} or {error}. */
  call(method, params = [], timeoutMs = 15000) {
    const id = String(++this.nextId);
    return this._send({ msg: 'method', id, method, params }, id, timeoutMs);
  }

  /** Documents received for a collection since connect. */
  received(collection) {
    return [...(this.docs.get(collection)?.values() ?? [])];
  }

  login(username, password) {
    return this.call('login', [{ user: { username }, password }]);
  }

  close() { try { this.ws?.close(); } catch { /* already gone */ } }
}

/**
 * Connected anonymous client, retrying while the server is unavailable.
 *
 * Meteor rebuilds on any file change and bounces the app server; during that
 * window its dev proxy answers an upgraded socket with a raw 504, which the
 * websocket library reports as a malformed frame. Without this retry the
 * suite reports security failures that are really just a restarting server.
 */
export async function anonymousClient(attempts = Number(process.env.DESKPASS_CONNECT_ATTEMPTS || 12)) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const c = new DdpClient();
    try {
      await c.connect(8000);
      c.ws.on("error", () => { /* reported through pending call timeouts */ });
      return c;
    } catch (e) {
      lastError = e;
      c.close();
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw new Error(`server not reachable over DDP after ${attempts} attempts: ${lastError?.message}`);
}

/** Block until the server answers DDP, for use in a suite-wide setup. */
export async function waitForServer() {
  const c = await anonymousClient();
  c.close();
}
