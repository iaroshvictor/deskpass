import TelegramBot from 'node-telegram-bot-api';
import { TgSessions, TgSession } from '/imports/api/tgSessions';
import { cleanupChat } from './utils';

// Fetch session data from the database
export const getSession = async (chatId: number): Promise<TgSession | undefined> => {
  return await TgSessions.findOneAsync({ chatId });
};
// Update the session in the database
export const updateOrCreateSession = async (chatId: number, updates: Partial<TgSession>, push?:number): Promise<void> => {
  const s= await TgSessions.findOneAsync({chatId})
  if(s){
    const qb:{$set:Partial<TgSession>, $push?:{messagesToRemove:number}} = { $set: updates }
    if(push){
      qb.$push={messagesToRemove:push}
    }
    await TgSessions.updateAsync({ chatId }, qb, { upsert: true });
  }
  else{
    await TgSessions.insertAsync({chatId, ...updates})
  }
  
};

export const resetSessionState = async (chatId: number, bot:TelegramBot): Promise<void> => {
  const session = await getSession(chatId);
  if(session){
    await cleanupChat({session, bot})
    await TgSessions.updateAsync(
      { chatId },
      { $set: { state: "", stateDataHolder: "", messagesToRemove:[] } },
    );
  }
  
};