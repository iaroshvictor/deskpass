import TelegramBot from 'node-telegram-bot-api';
import { Accounts } from "meteor/accounts-base";
import { Meteor } from 'meteor/meteor';
import { getSession, updateOrCreateSession, resetSessionState } from '/imports/bot/session';
import {displayMainMenu} from './utils'
export const initializeLogin = async (chatId:number, bot:TelegramBot) => {
  const thisSession = await getSession(chatId)
  if(thisSession){
    await bot.sendMessage(chatId, "Welcome back!");
    await resetSessionState(chatId, bot)
    const message_id = await displayMainMenu(chatId, bot)
    await updateOrCreateSession(chatId, {messagesToRemove:[message_id]})
  }else{
    await bot.sendMessage(chatId, "Welcome! Please enter your username:");
    await updateOrCreateSession(chatId, { state: 'awaiting_username' });
  }
}
// Validate the username and password using Meteor's user accounts system
export const validateCredentials = async (username: string, password: string): Promise<string | null> => {
  const user = await Meteor.users.findOneAsync({ username });
  // Accounts._checkPassword(user, password);
  if (user ) {
    // const hashedPassword = user.services.password.bcrypt;
    // const userInput = createHash('sha256').update(password).digest('hex');
    if (Accounts._checkPassword(user, password)){
      return user._id
    }
    // if (bcrypt.compareSync(userInput, hashedPassword)){
    //   return user._id
    // };
  }
  return null;
};
export const cancelLogin = async(chatId:number, bot: TelegramBot) => {
  await resetSessionState(chatId, bot)
  //cleanup history
  await initializeLogin(chatId, bot)
}
// Handle the login flow
export const handleLogin = async (bot: TelegramBot, chatId: number, text: string, session: any): Promise<void> => {
  if (session?.state === 'awaiting_username') {
    await updateOrCreateSession(chatId, { stateDataHolder: text, state: 'awaiting_password' });
    await bot.sendMessage(chatId, "Great! Now enter your password:");
  } else if (session?.state === 'awaiting_password') {
    const username = session.stateDataHolder!;
    const password = text;
    const userId=await validateCredentials(username, password)
    if (userId) {
      await bot.sendMessage(chatId, "✅ Login successful! You are now logged in.");

      await resetSessionState(chatId, bot);
      await updateOrCreateSession(chatId, {
        userId,
        subscribedToAlerts:true
      })
      const menuMessage = await displayMainMenu(chatId, bot);
      await updateOrCreateSession(chatId, {
        messagesToRemove:[menuMessage]
      })
    } else {
      const buttons = [{
        text:'Cancel',
        callback_data:'cancel_login'
      }]
      console.log(buttons.map(button => [button]))
      const menu = {
        reply_markup: {
          inline_keyboard: buttons.map(button => [button])  // Each button in its own row
        }
      };
      await bot.sendMessage(chatId, "❌ Wrong credentials. Please try again or click 'Cancel'.", menu);
    }
  }
};