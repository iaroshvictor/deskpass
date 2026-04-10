import TelegramBot, { CallbackQuery, Message } from 'node-telegram-bot-api';
import { getSession, updateOrCreateSession } from './session';
import { handleLogin, cancelLogin, initializeLogin } from './login';
import { toggleUserSubscription } from './alerts';
// import { showSensorMenu, handleSensorSelection } from './sensors';
import { generateReport, generateArrivalTimeReport } from './reports';
import { cleanupChat, displayMainMenu, showIndiceMenu, showStepperMenu, showReportTypesMenu, showTimingSelectionMenu, showDepartmentSelectionMenu } from './utils'
// Initialize the bot
export function initBot(token: string): TelegramBot {
  const bot = new TelegramBot(token, { polling: true });

  // Start command to initiate the login process
  bot.onText(/\/start/, async (msg: Message) => {
    const chatId = msg.chat.id;
    await initializeLogin(chatId, bot);
    
  });

  // Handle messages for login flow
  bot.on('message', async (msg: Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    const session = await getSession(chatId);
    if (session?.state === 'awaiting_password' || session?.state === 'awaiting_username') {
      await handleLogin(bot, chatId, text, session);
    }
  });

  // Handle callback queries
  bot.on('callback_query', async (callbackQuery: CallbackQuery) => {
    const chatId = callbackQuery.message?.chat.id!;
    const action = callbackQuery.data;
    const session = await getSession(chatId)
    if (session)
      await cleanupChat({bot, session});
    if(action === 'cancel_login'){
      await cancelLogin(chatId, bot)
    }
    if (action === 'subscribe' || action === 'pause') {
      if(session)
        await toggleUserSubscription(session);
      await bot.sendMessage(chatId, action === 'subscribe' ? "✅ You have subscribed to alerts.":"⏸️ Alerts have been paused.");
      const menuId = await displayMainMenu(chatId, bot)
      await updateOrCreateSession(chatId,{messagesToRemove:[menuId]})
    } else if (action === 'generate_report') {
      // Start the new report flow
      const reportTypesMenuId = await showReportTypesMenu(bot, chatId);
      await updateOrCreateSession(chatId, {messagesToRemove: [reportTypesMenuId]});
    } else if (action?.startsWith('interval_')) {
      const intervalValue = action.split('_')[1];
      await updateOrCreateSession(chatId,{stateDataHolder:intervalValue})
      const indiceMenuId = await showIndiceMenu(bot, chatId)
      await updateOrCreateSession(chatId,{messagesToRemove:[indiceMenuId]})
    } else if(action?.startsWith('reportIndex_')) {
      const stepperValue = action.split('_')[1];
      if (session)
        await updateOrCreateSession(chatId,{stateDataHolder:`${session.stateDataHolder}_${stepperValue}`})
      const indiceMenuId = await showStepperMenu(bot, chatId)
      await updateOrCreateSession(chatId,{messagesToRemove:[indiceMenuId]})
    } else if(action?.startsWith('stepper_')) {
      if (session)
        await generateReport(bot, chatId, session, action.split('_')[1]);
      const intervalMenuId = await displayMainMenu(chatId, bot)
      await updateOrCreateSession(chatId,{messagesToRemove:[intervalMenuId]})
    } else if (action?.startsWith('report_type_')) {
      // Handle report type selection
      const reportType = action.split('report_type_')[1];
      await updateOrCreateSession(chatId, {stateDataHolder: reportType});
      const timingMenuId = await showTimingSelectionMenu(bot, chatId);
      await updateOrCreateSession(chatId, {messagesToRemove: [timingMenuId]});
    } else if (action?.startsWith('timing_')) {
      // Handle timing selection
      const timing = action.split('timing_')[1];
      if (session) {
        const reportType = session.stateDataHolder || '';
        await updateOrCreateSession(chatId, {stateDataHolder: `${reportType}|${timing}`});
      }
      const departmentMenuId = await showDepartmentSelectionMenu(bot, chatId);
      await updateOrCreateSession(chatId, {messagesToRemove: [departmentMenuId]});
    } else if (action?.startsWith('department_')) {
      // Handle department selection and generate report
      const departmentId = action.split('department_')[1];
      if (session && session.stateDataHolder) {
        const [reportType, timing] = session.stateDataHolder.split('|');
        await generateArrivalTimeReport(bot, chatId, reportType, departmentId, timing);
      }
      const mainMenuId = await displayMainMenu(chatId, bot);
      await updateOrCreateSession(chatId, {messagesToRemove: [mainMenuId], stateDataHolder: ''});
    }
  });
  return bot;
}