import { Mongo } from 'meteor/mongo';

// A keyword hit from the VLM caption service (percept_caption.py). The service
// fires `caption_alert` on redis when a camera's caption text matches one of the
// user-defined watch-words (cam.captionKeywords), and the server records it here.
export interface CaptionAlert {
  _id?: string;
  source: string;      // camId
  text: string;        // the caption that matched
  keyword: string;     // the watch-word that hit
  timestamp: Date;
  seen: boolean;
  seenBy?: string;
  seenAt?: Date | null;
}

export const CaptionAlertsCollection = new Mongo.Collection<CaptionAlert>('captionAlerts');
