import { Mongo } from 'meteor/mongo';

export interface TgSession {
  _id?:string;
  chatId: number;
  state?: '' | 'awaiting_username' | 'awaiting_password';  // Login flow state
  stateDataHolder?: string;  // Store the username temporarily
  messagesToRemove?: number[];  // To track the last message sent by the bot
  subscribedToAlerts?:boolean;
  userId?:string;
}

export const TgSessions = new Mongo.Collection<TgSession>('tgsessions');