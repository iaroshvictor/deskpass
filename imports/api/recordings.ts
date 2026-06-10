import { Mongo } from 'meteor/mongo';

export interface Recording {
  _id?: string;
  camId: string;
  camName: string;
  filename: string;
  path: string;
  source: 'original' | 'ai';
  streamUrl: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;   // seconds
  sizeBytes?: number;
  status: 'recording' | 'completed' | 'error';
}

export const RecordingsCollection = new Mongo.Collection<Recording>('recordings');
