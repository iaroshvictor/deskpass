import { getSession } from './session';
import {AlertItem} from '../api/alertsArchive'
import  TelegramBot  from 'node-telegram-bot-api';
import {TgSession} from '../api/tgSessions'

export const showUnderConstruction = async(chatId:number, bot:TelegramBot):Promise<number>=>{
    return (await bot.sendMessage(chatId, "Feature under development")).message_id;
}

export const displayMainMenu =async (chatId:number, bot:TelegramBot):Promise<number>=>{
  const thisSession = await getSession(chatId)
  const isSubscribed = thisSession?.subscribedToAlerts
  const menu = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: isSubscribed ? "Pause alerts" : "Subscribe to alerts",
            callback_data: isSubscribed ? 'pause' : 'subscribe',
          }
        ],
        [
          { text: "Generate report", callback_data: 'generate_report' }
        ]
      ]
    }
  };
  // Send the new menu and store the message ID for cleanup
  const sentMessage = await bot.sendMessage(chatId, "Here are your available commands:", menu);
  return sentMessage.message_id
};
import { AlertLists } from '../api/alertLists';
import { CamsCollection } from '../api/cams';
import { VisitSummary, VisitsSummaryCollection, IdInfo } from '../api/visitSummary';

interface TelegramMessage {
  text: string;
  photos?: string[]; // Base64 encoded images
  parseMode?: 'HTML' | 'Markdown';
}

export async function formatAlertMessage(alertItem: AlertItem): Promise<TelegramMessage> {
  try {
    // Get camera information
    const camera =await  CamsCollection.findOneAsync({ _id: alertItem.source });
    const cameraName = camera?.name || alertItem.source || 'Unknown Camera';
    
    // Get alert list information
    const alertList =await AlertLists.findOneAsync({ _id: alertItem.listId });
    const listName = alertList?.name || 'Unknown List';
    
    // Get person information from VisitsSummary using idInfo as reference
    let personIdInfo: IdInfo | undefined;
    let referenceVisit: VisitSummary | undefined;
    
    if (alertItem.idInfo) {
      // Try with original type first, then try with converted type for legacy data
      referenceVisit = await VisitsSummaryCollection.findOneAsync({ _id: `${alertItem.idInfo}` });
      if (!referenceVisit && typeof alertItem.idInfo === 'string' && !isNaN(Number(alertItem.idInfo))) {
        referenceVisit = await VisitsSummaryCollection.findOneAsync({ _id: `${Number(alertItem.idInfo)}` });
      }
      personIdInfo = referenceVisit?.idInfo;
    }
    
    // Get person name from referenced IdInfo
    const personName = personIdInfo 
      ? `${personIdInfo.firstName || ''} ${personIdInfo.lastName || ''}`.trim()
      : 'Unknown Person';
    
    // Format timestamp
    const timestamp = alertItem.timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
    
    // Get additional person info if available
    const comment = personIdInfo?.comment || '';
    
    // Get reference photo from the referenced visit summary
    let referencePhoto = '';
    if (referenceVisit?.face_b64) {
      referencePhoto = referenceVisit.face_b64;
    }
        
    // Create message text with HTML formatting
    const messageText = `
    🚨 <b>SECURITY ALERT</b> 🚨
    🔍 <b>Detection Details:</b>
    👤 <b>Person:</b> ${personName}
    📹 <b>Camera:</b> ${cameraName}
    📋 <b>Alert List:</b> ${listName}
    🕐 <b>Time:</b> ${timestamp}

    ${comment ? `💬 <b>Comment:</b> ${comment}\n` : ''}
    `.trim();
    
    // Prepare photos array
    const photos: string[] = [];
    
    // Add current detection face photo
    if (alertItem.face_b64) {
      photos.push(alertItem.face_b64);
    }
    
    // Add reference photo if available and different
    if (referencePhoto) {
      photos.push(referencePhoto);
    }
    
    return {
      text: messageText,
      photos: photos.length > 0 ? photos : undefined,
      parseMode: 'HTML'
    };
    
  } catch (error) {
    console.error('Error formatting alert message:', error);
    
    // Fallback simple message
    const fallbackText = `
    🚨 SECURITY ALERT 🚨

    Person detected on ${alertItem.source || 'Unknown Camera'}
    Time: ${alertItem.timestamp.toLocaleString()}
    Tracking ID: ${alertItem.tracking_id}
    Status: ${alertItem.seen ? 'Seen' : 'UNREAD'}
    `.trim();
    
    return {
      text: fallbackText,
      photos: alertItem.face_b64 ? [alertItem.face_b64] : undefined,
      parseMode: 'HTML'
    };
  }
}

// Alternative function for sending multiple messages (useful for Telegram's media group limitations)
export async function formatAlertMessageWithMediaGroup(alertItem: AlertItem): Promise<{
  textMessage: TelegramMessage;
  mediaGroup?: string[];
}> {
  const message = await formatAlertMessage(alertItem);
  
  return {
    textMessage: {
      text: message.text,
      parseMode: message.parseMode
    },
    mediaGroup: message.photos
  };
}

// Utility function to create a compact alert message for notifications
export async function formatCompactAlertMessage(alertItem: AlertItem): Promise<string> {
  // Get person name from referenced VisitsSummary
  let personName = 'Unknown Person';
  
  if (alertItem.idInfo) {
    const referenceVisit =await VisitsSummaryCollection.findOneAsync({ _id: `${alertItem.idInfo }`});
    if (referenceVisit?.idInfo) {
      personName = `${referenceVisit.idInfo.firstName || ''} ${referenceVisit.idInfo.lastName || ''}`.trim();
    }
  }
  
  const cameraName = alertItem.source || 'Unknown Camera';
  const time = alertItem.timestamp.toLocaleTimeString();
  
  return `🚨 ${personName} detected on ${cameraName} at ${time}`;
}

export const cleanupChat = async ({session, bot}:{session:TgSession, bot:TelegramBot}) =>{
  return Promise.all(
    (session.messagesToRemove || [])
      .map(messageId=>{
        try{
          bot.deleteMessage(session.chatId, messageId)
        }catch(e : any){

        }
      })
    )
};

export const showIntervalMenu = async (bot: TelegramBot, chatId: number): Promise<number> => {

  const intervalButtons = [
    [
      {text:'24h',data:'24h'},
      {text:'Today', data:'today'},
      {text:'Yesterday',data:'yesterday'}
    ],
    [
      {
        text:'7 Days',
        data:'7days'
      },
      {
        text:'This week',
        data:'thisweek'
      },
      {
        text:'Last Week',
        data:'lastweek'
      }
    ],
    [
      {
        text:'31 Days',
        data:'31days'
      },
      {
        text:'This Month',
        data:'thismonth'
      },
      {
        text:'Last Month',
        data:'lastmonth'
      }
    ]
    ].map(grelement => grelement.map(element=>({
        text: element.text,
        callback_data: `interval_${element.data}`,
        }))
   )
  const menu = {
    reply_markup: {
      inline_keyboard: intervalButtons,  // Each button in its own row
    }
  };

  return (await bot.sendMessage(chatId, "Select the value of Report:", menu)).message_id;
};

export const showIndiceMenu= async(bot:TelegramBot, chatId:number):Promise<number>=>{
  const menu = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text:'🌡️ Temperature',
            callback_data:'reportIndex_temperature'
          }
        ],
        [
          {
            text:'💧 Humidity',
            callback_data:'reportIndex_humidity'
          }
        ],
        [
          {
            text:'🌬️ Pressure',
            callback_data:'reportIndex_pressure'
          }
        ],
        [
          {
            text:'⚖️ Difference',
            callback_data:'reportIndex_difference'
          }
        ]
      ],  // Each button in its own row
    }
  };
  return (await bot.sendMessage(chatId, "Select the timeframe of Report:", menu)).message_id;
};

export const showStepperMenu= async(bot:TelegramBot, chatId:number):Promise<number>=>{
  const menu = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text:'10 minutes',
            callback_data:'stepper_10minutes'
          }
        ],
        [
          {
            text:'30 minutes',
            callback_data:'stepper_30minutes'
          }
        ],
        [
          {
            text:'1 hour',
            callback_data:'stepper_60minutes'
          }
        ]
      ],  // Each button in its own row
    }
  };
  return (await bot.sendMessage(chatId, "Select the timeframe of Report:", menu)).message_id;
}

// New report flow menus
export const showReportTypesMenu = async (bot: TelegramBot, chatId: number): Promise<number> => {
  const menu = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🕐 Arrival Time Report',
            callback_data: 'report_type_arrival_time'
          }
        ]
      ]
    }
  };
  return (await bot.sendMessage(chatId, "📊 Select Report Type:", menu)).message_id;
};

export const showTimingSelectionMenu = async (bot: TelegramBot, chatId: number): Promise<number> => {
  const menu = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📅 Today',
            callback_data: 'timing_today'
          }
        ],
        [
          {
            text: '📅 Yesterday',
            callback_data: 'timing_yesterday'
          }
        ],
        [
          {
            text: '📅 Last 7 Days',
            callback_data: 'timing_last_7_days'
          }
        ]
      ]
    }
  };
  return (await bot.sendMessage(chatId, "📅 Select Time Period:", menu)).message_id;
};

export const showDepartmentSelectionMenu = async (bot: TelegramBot, chatId: number): Promise<number> => {
  // Import DivisionsCollection here to avoid circular imports
  const { DivisionsCollection } = await import('/imports/api/divisions');

  try {
    const departments = await DivisionsCollection.find({}).fetchAsync();

    if (departments.length === 0) {
      return (await bot.sendMessage(chatId, "❌ No departments found in the system.")).message_id;
    }

    const keyboard = departments.map(dept => [
      {
        text: dept.name,
        callback_data: `department_${dept._id}`
      }
    ]);

    const menu = {
      reply_markup: {
        inline_keyboard: keyboard
      }
    };

    return (await bot.sendMessage(chatId, "🏢 Select Department:", menu)).message_id;
  } catch (error) {
    console.error('Error fetching departments:', error);
    return (await bot.sendMessage(chatId, "❌ Error loading departments. Please try again.")).message_id;
  }
};