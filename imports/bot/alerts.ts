import TelegramBot from 'node-telegram-bot-api';

import { TgSession, TgSessions } from '../api/tgSessions';
import {formatAlertMessage, cleanupChat, displayMainMenu} from './utils'
import {AlertItem} from '../api/alertsArchive'
import {updateOrCreateSession} from './session'
// Toggle subscription for alerts
export const toggleUserSubscription = async (session: TgSession): Promise<void> => {
  await TgSessions.updateAsync({_id:session._id}, {$set:{subscribedToAlerts:!session.subscribedToAlerts}})
};

// Check the user's subscription status
export const getUserSubscriptionStatus = async (chatId: number): Promise<boolean> => {
  return (await TgSessions.findOneAsync({chatId}))?.subscribedToAlerts || false
};
export const sendAlert =async (alert:AlertItem, bot:TelegramBot)=>{
  TgSessions.find({subscribedToAlerts:true}).forEach(async session=>{
    const message = await formatAlertMessage(alert);
    
    // Send text message first
    await bot.sendMessage(session.chatId, message.text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    
    // Send photos if available
    await Promise.all((message.photos ||[]).map((el, i)=>{
        const photoBuffer = Buffer.from(el, 'base64');
        // Add caption to identify each photo
        let caption = '';
        if (i === 0) caption = '📸 Current Detection - Face';
        else if (i === 1) caption = '📋 Reference Photo';
        
        return bot.sendPhoto(session.chatId, photoBuffer, {
        caption: caption,
        parse_mode: 'HTML'
        });
    }))
    await cleanupChat({session, bot})
    const menuId = await displayMainMenu(session.chatId, bot)
      await updateOrCreateSession(session.chatId,{messagesToRemove:[menuId]})
  })
}