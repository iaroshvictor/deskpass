// import axios from 'axios';

export default {
    // async proxyWHEP(streamPath: string, sdpOffer: string) {
    //     // POST the offer SDP to MediaMTX WHEP endpoint
    //     const url = `http://localhost:8889/${encodeURIComponent(streamPath)}/whep`;
    //     const response = await axios.post(url, sdpOffer, {
    //         headers: {
    //             'Content-Type': 'application/sdp'
    //         },
    //         responseType: 'text'
    //     });
    //     // Return the SDP answer as plain text
    //     return response.data;
    // },
    // async whepOptions(streamPath: string) {
    //     const url = `http://localhost:8889/${encodeURIComponent(streamPath)}/whep`;
    //     const res = await axios.options(url);
    //     // Parse ICE servers from Link header
    //     const link = res.headers['link'];
    //     if (!link) return [];
    //     // Parse according to reader.js logic
    //     return link.split(', ').map((l: string) => {
    //         const m = l.match(/^<(.+?)>; rel="ice-server"(; username="(.*?)"; credential="(.*?)"; credential-type="password")?/i);
    //         if (!m) return null;
    //         const ret: any = { urls: [m[1]] };
    //         if (m[3]) {
    //             ret.username = JSON.parse(`"${m[3]}"`);
    //             ret.credential = JSON.parse(`"${m[4]}"`);
    //             ret.credentialType = 'password';
    //         }
    //         return ret;
    //     }).filter(Boolean);
    // },
    // async whepPostOffer(streamPath: string, sdpOffer: string) {
    //     const url = `http://localhost:8889/${encodeURIComponent(streamPath)}/whep`;
    //     const res = await axios.post(url, sdpOffer, {
    //         headers: { 'Content-Type': 'application/sdp' },
    //         maxRedirects: 0,
    //         validateStatus: status => status === 201,
    //     });
    //     // MediaMTX returns answer in body and session URL in Location header
    //     return {
    //         sdpAnswer: res.data,
    //         sessionUrl: res.headers['location'],
    //     };
    // },
    // async whepPatchCandidates(sessionUrl: string, sdpFrag: string) {
    //     // Ensure sessionUrl is an absolute URL
    //     let url = sessionUrl;
    //     if (url && !/^https?:\/\//.test(url)) {
    //         // If it's a relative path, prepend the MediaMTX base URL
    //         url = `http://localhost:8889${url.startsWith('/') ? '' : '/'}${url}`;
    //     }
    //     await axios.patch(url, sdpFrag, {
    //         headers: {
    //             'Content-Type': 'application/trickle-ice-sdpfrag',
    //             'If-Match': '*',
    //         },
    //         validateStatus: status => status === 204,
    //     });
    //     return true;
    // },
    // async whepDeleteSession(sessionUrl: string) {
    //     // Ensure sessionUrl is an absolute URL
    //     let url = sessionUrl;
    //     if (url && !/^https?:\/\//.test(url)) {
    //         url = `http://localhost:8889${url.startsWith('/') ? '' : '/'}${url}`;
    //     }
    //     try {
    //         await axios.delete(url, {
    //             validateStatus: status => status === 204 || status === 404 // treat 404 as valid (session already gone)
    //         });
    //     } catch (err: any) {
    //         // Ignore 404 errors, rethrow others
    //         if (!(err && err.response && err.response.status === 404)) {
    //             throw err;
    //         }
    //     }
    //     return true;
    // }
}