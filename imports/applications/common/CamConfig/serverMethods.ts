import { OnvifDevice as OnvifDeviceDt } from "/imports/api/onvifClient";
import { CamsCollection , Cam} from "/imports/api/cams";
import { CamLineDefsCollection, CamLineDef } from "/imports/api/camLineDefs";
import { CamZoneDefsCollection, CamZoneDef } from "/imports/api/camZoneDefs";
import { Meteor } from "meteor/meteor";
import { OnvifDevice  } from 'node-onvif-ts';
import rtsp from 'rtsp-ffmpeg';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any

const camMethods : {[x:string]:MeteorMethod} = {

    insertCam(data:Cam){
        if (!data || !data.name || !data.streamurl) {
            throw new Meteor.Error('invalid-cam', 'Cam must have a name and stream URL');
        }
        if (!this.userId){
           throw new Meteor.Error('not-authorized', 'You must be logged in to insert a cam.');
        }
        return CamsCollection.insertAsync(data)
    },
    updateCam(id:string, data:Cam){
        if (!this.userId){
           throw new Meteor.Error('not-authorized', 'You must be logged in to insert a cam.');
        }
        return CamsCollection.updateAsync({_id:id}, data)
    },
    removeCam(id:string){
        if (!this.userId){
           throw new Meteor.Error('not-authorized', 'You must be logged in to insert a cam.');
        }
        return CamsCollection.removeAsync(id)
    },
    async validateOnvifDevice( selectedDevice:OnvifDeviceDt, onvifusername:string, onvifpassword:string){
        if (!this.userId){
           throw new Meteor.Error('not-authorized', 'You must be logged in to insert a cam.');
        }
        //get rtsp  stream using onvif
        if(!selectedDevice || !selectedDevice.xaddrs || selectedDevice.xaddrs.length === 0){
            throw new Meteor.Error('invalid-device', 'Invalid ONVIF device selected');
        }
        if(!onvifusername || !onvifpassword){
            throw new Meteor.Error('invalid-credentials', 'Username and password are required');
        }
        const device = new OnvifDevice({
            xaddr: selectedDevice.xaddrs[0],
            user: onvifusername,
            pass: onvifpassword,
        });
        try {
            await device.init();
            const streamUri = await device.getUdpStreamUrl();
            if (streamUri) {
                return streamUri;
            } else {
                throw new Meteor.Error('no-stream-uri', 'No stream URI available for this device');
            }
        }
        catch (error: any) {
            console.error('Error validating ONVIF device:', error);
            throw new Meteor.Error('onvif-validation-error', 'Failed to validate ONVIF device', error.message);
        }

    },
    async insertCamLineDef(data: CamLineDef) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }
        if (!data?.label?.trim()) {
            throw new Meteor.Error('invalid-data', 'Label is required.');
        }
        return CamLineDefsCollection.insertAsync({ label: data.label.trim() });
    },
    async updateCamLineDef(id: string, data: Partial<CamLineDef>) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }
        return CamLineDefsCollection.updateAsync({ _id: id }, { $set: data });
    },
    async deleteCamLineDef(id: string) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }
        return CamLineDefsCollection.removeAsync({ _id: id });
    },
    async insertCamZoneDef(data: CamZoneDef) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }
        if (!data?.label?.trim()) {
            throw new Meteor.Error('invalid-data', 'Label is required.');
        }
        return CamZoneDefsCollection.insertAsync({ label: data.label.trim() });
    },
    async updateCamZoneDef(id: string, data: Partial<CamZoneDef>) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }
        return CamZoneDefsCollection.updateAsync({ _id: id }, { $set: data });
    },
    async deleteCamZoneDef(id: string) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }
        return CamZoneDefsCollection.removeAsync({ _id: id });
    },
    validateRtspLink(rtspLink:string){
        this.unblock();
        if(!rtspLink || !rtspLink.startsWith('rtsp://')){
            throw new Meteor.Error('invalid-rtsp-link', 'Invalid RTSP link provided');
        }
        const stream = new rtsp.FFMpeg({ input: rtspLink });
        return new Promise<string>((resolve, reject) => {
            // Throwing inside an EventEmitter's 'error' handler does not reject
            // the promise — it becomes an uncaught exception and takes the whole
            // server down, which is what happened whenever ffmpeg was missing
            // from PATH. Reject instead, so the caller gets an error and the
            // rest of the application keeps running.
            let settled = false;
            const finish = (fn: () => void) => {
                if (settled) return;
                settled = true;
                try { stream.stop(); } catch { /* never started */ }
                fn();
            };

            // Neither event is guaranteed to fire: an unreachable camera can
            // leave ffmpeg waiting indefinitely.
            const timer = setTimeout(
                () => finish(() => reject(new Meteor.Error('rtsp-timeout', 'The camera did not send a frame in time.'))),
                20000,
            );

            stream.on('data', (data: Buffer) => {
                clearTimeout(timer);
                finish(() => resolve(data.toString('base64')));
            });
            stream.on('error', (err: any) => {
                clearTimeout(timer);
                console.error('[rtsp] preview failed for', rtspLink, '-', err?.message ?? err);
                const missingFfmpeg = /executable wasn't found/i.test(String(err?.message ?? ''));
                finish(() => reject(new Meteor.Error(
                    missingFfmpeg ? 'ffmpeg-missing' : 'invalid-rtsp-link',
                    missingFfmpeg
                        ? 'ffmpeg is not installed on the server, so camera previews are unavailable.'
                        : 'Could not read a frame from that RTSP link.',
                )));
            });
        });
        // Here you can add more validation logic for the RTSP link if needed
       
    }
}
export default camMethods;