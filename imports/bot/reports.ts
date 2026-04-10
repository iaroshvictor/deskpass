
import ChartJSImage from 'chartjs-to-image';
import TelegramBot from 'node-telegram-bot-api';
import { TgSession } from '../api/tgSessions';
import fs from 'node:fs'
import moment from 'moment';
import { createObjectCsvWriter } from 'csv-writer';



const calculateDateRange = (period: string) => {
  const now = moment();
  let startDate;
  let endDate = now.toDate();

  switch (period) {
    case '24h':
      startDate = now.subtract(24, 'hours').toDate();
      break;
    case 'today':
      startDate = now.startOf('day').toDate();
      break;
    case 'yesterday':
      startDate = now.subtract(1, 'day').startOf('day').toDate();
      endDate = now.subtract(1, 'day').endOf('day').toDate();
      break;
    case '7days':
      startDate = now.subtract(7, 'days').startOf('day').toDate();
      break;
    case 'thisweek':
      startDate = now.startOf('week').toDate();
      break;
    case 'lastweek':
      startDate = now.subtract(1, 'week').startOf('week').toDate();
      endDate = now.subtract(1, 'week').endOf('week').toDate();
      break;
    case '31days':
      startDate = now.subtract(31, 'days').startOf('day').toDate();
      break;
    case 'thismonth':
      startDate = now.startOf('month').toDate();
      break;
    case 'lastmonth':
      startDate = now.subtract(1, 'month').startOf('month').toDate();
      endDate = now.subtract(1, 'month').endOf('month').toDate();
      break;
    default:
      throw new Error("Invalid period specified");
  }

  return { startDate, endDate };
};

const getAggregationInterval = (stepper: string) => {
  switch (stepper) {
    case '10minutes':
      return 10;
    case '30minutes':
      return 30;
    case '60minutes':
      return 60;
    default:
      throw new Error("Invalid stepper specified");
  }
};

const aggregateDataBySensor = async (
  _startDate: Date,
  _endDate: Date,
  _interval: number,
  _indice: 'temperature'|'humidity'|'pressure'|'difference'
) => {
 

  // Fetch and aggregate sensor readings by interval
 

  return {};
};

const generateCsvFileWithSensors = async (sensorData: { [sensorId: string]: { title: string, data: { [time: string]: number | null } } }) => {
  const filePath = `./report_${moment(new Date()).format('DD.MM_HH:mm:ss')}.csv`;

  const headers = [
    { id: 'time', title: 'Time' },
    ...Object.values(sensorData).map(sensor => ({ id: sensor.title, title: sensor.title }))
  ];

  const rows: { [key: string]: any }[] = [];

  // Collect all time labels
  const timeLabels = Object.values(sensorData)[0].data;

  Object.keys(timeLabels).forEach(timeLabel => {
    const row: { [key: string]: any } = { time: timeLabel };
    for (const sensorId in sensorData) {
      const sensorTitle = sensorData[sensorId].title;
      row[sensorTitle] = sensorData[sensorId].data[timeLabel];
    }
    rows.push(row);
  });

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: headers
  });

  await csvWriter.writeRecords(rows);
  return filePath;
};

// Generate CSV file for arrival time data
const generateArrivalTimeCsv = async (reportData: {
  departmentName: string;
  timingSelection: string;
  dailyData?: { [date: string]: { [personName: string]: string | null } };
  singleDayData?: { [personName: string]: string | null };
  lastEntryData?: { [personName: string]: { time: string | null, type: string | null } };
  dailyLastEntryData?: { [date: string]: { [personName: string]: { time: string | null, type: string | null } } };
}) => {
  const timestamp = moment().format('DD.MM_HH:mm:ss');
  const filePath = `./arrival_report_${timestamp}.csv`;

  if (reportData.dailyData) {
    // Multi-day CSV format
    const dates = Object.keys(reportData.dailyData).sort();
    const allPersons = new Set<string>();

    // Collect all unique person names
    dates.forEach(date => {
      Object.keys(reportData.dailyData![date]).forEach(person => allPersons.add(person));
    });

    // Create headers for arrival and last entry times
    const headers = [
      { id: 'person', title: 'Person Name' },
      ...dates.flatMap(date => [
        { id: `${date}_arrival`, title: `${moment(date).format('DD/MM')} Arrival` },
        { id: `${date}_last`, title: `${moment(date).format('DD/MM')} Last Entry` }
      ])
    ];

    const rows = Array.from(allPersons).map(person => {
      const row: { [key: string]: any } = { person };
      dates.forEach(date => {
        const arrivalTime = reportData.dailyData![date][person] || 'Missing';
        const lastEntryData = reportData.dailyLastEntryData?.[date]?.[person];
        const lastEntryTime = lastEntryData?.time ?
          `${lastEntryData.time} (${lastEntryData.type})` :
          'N/A';

        row[`${date}_arrival`] = arrivalTime;
        row[`${date}_last`] = lastEntryTime;
      });
      return row;
    });

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers
    });

    await csvWriter.writeRecords(rows);
  } else if (reportData.singleDayData) {
    // Single day CSV format
    const headers = [
      { id: 'person', title: 'Person Name' },
      { id: 'arrivalTime', title: 'Arrival Time' },
      { id: 'lastEntryTime', title: 'Last Entry Time' },
      { id: 'lastEntryType', title: 'Last Entry Type' },
      { id: 'status', title: 'Status' }
    ];

    const rows = Object.entries(reportData.singleDayData).map(([person, time]) => {
      const lastEntry = reportData.lastEntryData?.[person];
      return {
        person,
        arrivalTime: time || 'Missing',
        lastEntryTime: lastEntry?.time || 'N/A',
        lastEntryType: lastEntry?.type || 'N/A',
        status: time ? 'Present' : 'Missing'
      };
    });

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers
    });

    await csvWriter.writeRecords(rows);
  }

  return filePath;
};

// Generate chart for arrival time data
const generateArrivalTimeChart = async (reportData: {
  departmentName: string;
  timingSelection: string;
  dailyData?: { [date: string]: { [personName: string]: string | null } };
  singleDayData?: { [personName: string]: string | null };
}) => {
  const chart = new ChartJSImage();

  if (reportData.dailyData) {
    // Multi-day chart - show attendance over time
    const dates = Object.keys(reportData.dailyData).sort();
    const labels = dates.map(date => moment(date).format('DD/MM'));

    const presentCounts = dates.map(date => {
      const dayData = reportData.dailyData![date];
      return Object.values(dayData).filter(time => time !== null).length;
    });

    const missingCounts = dates.map(date => {
      const dayData = reportData.dailyData![date];
      return Object.values(dayData).filter(time => time === null).length;
    });

    chart.setConfig({
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Present',
            data: presentCounts,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          },
          {
            label: 'Missing',
            data: missingCounts,
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Attendance Report - ${reportData.departmentName}`
          },
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of People'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  } else if (reportData.singleDayData) {
    // Single day chart - show arrival times distribution
    const times = Object.values(reportData.singleDayData).filter(time => time !== null) as string[];
    const presentCount = times.length;
    const missingCount = Object.values(reportData.singleDayData).filter(time => time === null).length;

    chart.setConfig({
      type: 'doughnut',
      data: {
        labels: ['Present', 'Missing'],
        datasets: [{
          data: [presentCount, missingCount],
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 99, 132, 0.8)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Attendance Summary - ${reportData.departmentName}`
          },
          legend: {
            display: true,
            position: 'bottom'
          }
        }
      }
    });
  }

  chart.setWidth(800).setHeight(600);
  return await chart.toBinary();
};

// Generate a sample report and send to the user
export const generateReport = async (bot: TelegramBot, chatId: number, session:TgSession, stepper:string): Promise<void> => {
  await bot.sendMessage(chatId, "📄 Generating Report, please wait ...");
  type stepper_type = '10minutes'|'30minutes'|'60minutes'
  type indice_type = 'temperature' | 'humidity' | 'pressure' | 'difference'
  type period_type = '24h' | 'today' | 'yesterday' | '7days' | 'thisweek' | 'lastweek' | '31days' | 'thismonth' | 'lastmonth'
  const type_stepper = stepper as stepper_type;
  const stateDataHolder = session.stateDataHolder?.split('_') || []
  const getCSVFile = async (period:period_type, indice:indice_type): Promise<{filePath:string | undefined;data:{
    [sensorId: string]: {
        title: string;
        data: {
            [time: string]: number | null;
        };
    };
}}>=>{     
    const { startDate, endDate } = calculateDateRange(period)
    const interval = getAggregationInterval(type_stepper);
    const sensorData = await aggregateDataBySensor(startDate, endDate, interval, indice);
    const filePath = await generateCsvFileWithSensors(sensorData);
    return {filePath, data:sensorData};
  }
  if(stateDataHolder.length ==2){
    const period = stateDataHolder[0]  as period_type
    const indice =stateDataHolder[1] as indice_type
    const {filePath, data} = await getCSVFile(period, indice)
    const chart =new ChartJSImage();
    const labels = Object.keys(data[Object.keys(data)[0]].data)
    const datasets = Object.values(data).map(sensoreVals=>{
      return {
        label:sensoreVals.title,
        data:Object.values(sensoreVals.data)
      }
    })
    chart.setConfig({
      type:'line',
      data:{
        labels,
        datasets,
        "options": {
          "title": {
            "display": true,
            "text": "Monitoring Chart"
          },
          "scales": {
            "xAxes": [
              {
                "scaleLabel": {
                  "display": true,
                  "labelString": "Time"
                }
              }
            ],
            "yAxes": [
              {
                "stacked": true,
                "scaleLabel": {
                  "display": true,
                  "labelString": indice
                },
                ticks: {
                  beginAtZero: false
              }
              }
            ]
          }
        }
      }
    })
    chart.setWidth(1200).setHeight(600)
    const imageURI = await chart.toBinary()
    await bot.sendPhoto(chatId, imageURI, {}, {
      filename:'report.jpg',
      contentType:'image/jpeg'
    });
    if(filePath){
      await bot.sendDocument(chatId, filePath, {}, { filename:filePath.substring(2)});
      fs.unlinkSync(filePath);
    }
    await bot.sendMessage(chatId, `📄 Report generated: \n- Period: ${period} every ${type_stepper.substring(0, 2)} minutes \n- Indice: ${indice}`);
  }
};

// Helper function to calculate date ranges for arrival time reports
const calculateArrivalDateRange = (timingSelection: string) => {
  // Use UTC to avoid timezone issues
  const now = moment();
  let startDate, endDate;

  switch (timingSelection) {
    case 'today':
      startDate = now.clone().startOf('day').toDate();
      endDate = now.clone().endOf('day').toDate();
      break;
    case 'yesterday':
      startDate = now.clone().subtract(1, 'day').startOf('day').toDate();
      endDate = now.clone().subtract(1, 'day').endOf('day').toDate();
      break;
    case 'last_7_days':
      // Last 7 days including today: if today is 20th, get 14th-20th (7 days)
      startDate = now.clone().subtract(6, 'days').startOf('day').toDate();
      endDate = now.clone().endOf('day').toDate();
      break;
    default:
      throw new Error(`Invalid timing selection: ${timingSelection}. Expected: today, yesterday, or last_7_days`);
  }

  return { startDate, endDate };
};

// Generate arrival time report
export const generateArrivalTimeReport = async (
  bot: TelegramBot,
  chatId: number,
  reportType: string,
  departmentId: string,
  timingSelection: string
): Promise<void> => {
  await bot.sendMessage(chatId, "📄 Generating Arrival Time Report, please wait...");
  console.log(reportType, departmentId, timingSelection)
  try {
    // Import collections
    const { VisitsSummaryCollection } = await import('/imports/api/visitSummary');
    const { DivisionsCollection } = await import('/imports/api/divisions');

    // Get department name
    const department = await DivisionsCollection.findOneAsync({ _id: departmentId });
    const departmentName = department?.name || 'Unknown Department';

    // Find all persons in the selected department
    const personsInDepartment = await VisitsSummaryCollection.find({
      'idInfo.divission': departmentId,
      'idInfo': { $exists: true }
    }).fetchAsync();

    if (personsInDepartment.length === 0) {
      await bot.sendMessage(chatId, `🏢 Department "${departmentName}" is empty - no persons assigned to this department.`);
      return;
    }

    const { startDate, endDate } = calculateArrivalDateRange(timingSelection);

    if (timingSelection === 'last_7_days') {
      // Generate report for each day in the last 7 days
      await generateDailyReports(bot, chatId, personsInDepartment, departmentName, startDate, endDate);
    } else {
      // Generate single day report
      await generateSingleDayReport(bot, chatId, personsInDepartment, departmentName, startDate, endDate, timingSelection);
    }

  } catch (error) {
    console.error('Error generating arrival time report:', error);
    await bot.sendMessage(chatId, "❌ Error generating report. Please try again later.");
  }
};

// Helper function to get gate name from source
const getGateName = async (source: string): Promise<string> => {
  try {
    const { GatesCollection } = await import('/imports/api/gates');
    const gate = await GatesCollection.findOneAsync({
      $or: [
        { _id: source },
        { 'interfaces.cam': source }
      ]
    });
    return gate?.name || source;
  } catch (error) {
    console.error('Error getting gate name:', error);
    return source;
  }
};

// Generate single day report
const generateSingleDayReport = async (
  bot: TelegramBot,
  chatId: number,
  personsInDepartment: any[],
  departmentName: string,
  startDate: Date,
  endDate: Date,
  timingSelection: string
): Promise<void> => {
  const { AccessReportCollection } = await import('/imports/api/accessReport');

  let reportText = `📊 Arrival Time Report\n\n`;
  reportText += `🏢 Department: ${departmentName}\n`;
  reportText += `📅 Period: ${timingSelection.charAt(0).toUpperCase() + timingSelection.slice(1)}\n`;
  reportText += `📋 Date: ${moment(startDate).format('DD/MM/YYYY')}\n\n`;

  let presentCount = 0;
  let missingCount = 0;
  const singleDayData: { [personName: string]: string | null } = {};
  const lastEntryData: { [personName: string]: { time: string | null, type: string | null } } = {};

  for (const person of personsInDepartment) {
    const personName = `${person.idInfo?.firstName || ''} ${person.idInfo?.lastName || ''}`.trim();
    // Find first entrance record for this person in the time period
    const firstEntrance = await AccessReportCollection.findOneAsync({
      idInfo: person._id,
      type: 'entrance',
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    }, {
      sort: { timestamp: 1 }
    });

    // Find last entry (entrance or exit) for this person in the time period
    const lastEntry = await AccessReportCollection.findOneAsync({
      idInfo: person._id,
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    }, {
      sort: { timestamp: -1 }
    });

    // Debug: Check if there are ANY records for this person (without date filter)

    if (firstEntrance) {
      const arrivalTime = moment(firstEntrance.timestamp).format('HH:mm');
      const arrivalGateName = await getGateName(firstEntrance.source);

      let entryInfo = `🔵 Arrival: ${arrivalTime} (${arrivalGateName})`;

      // Add last entry info if it exists and is different from first entrance
      if (lastEntry && lastEntry._id !== firstEntrance._id) {
        const lastTime = moment(lastEntry.timestamp).format('HH:mm');
        const lastGateName = await getGateName(lastEntry.source);
        const lastType = lastEntry.type === 'entrance' ? '🔵 Entry' : '🔴 Exit';
        entryInfo += `\n     ${lastType}: ${lastTime} (${lastGateName})`;
      }

      reportText += `✅ ${personName}:\n     ${entryInfo}\n`;
      singleDayData[personName] = arrivalTime;

      // Store last entry data for CSV
      if (lastEntry && lastEntry._id !== firstEntrance._id) {
        const lastTime = moment(lastEntry.timestamp).format('HH:mm');
        lastEntryData[personName] = { time: lastTime, type: lastEntry.type };
      } else {
        lastEntryData[personName] = { time: null, type: null };
      }

      presentCount++;
    } else {
      reportText += `❌ ${personName}: Missing\n`;
      singleDayData[personName] = null;
      lastEntryData[personName] = { time: null, type: null };
      missingCount++;
    }
  }

  reportText += `\n📈 Summary:\n`;
  reportText += `👥 Total persons: ${personsInDepartment.length}\n`;
  reportText += `✅ Present: ${presentCount}\n`;
  reportText += `❌ Missing: ${missingCount}\n`;

  await bot.sendMessage(chatId, reportText);

  // Generate and send CSV file
  try {
    const csvFilePath = await generateArrivalTimeCsv({
      departmentName,
      timingSelection,
      singleDayData,
      lastEntryData
    });

    await bot.sendDocument(chatId, csvFilePath, {}, {
      filename: `arrival_report_${departmentName}_${timingSelection}.csv`
    });

    // Clean up CSV file
    fs.unlinkSync(csvFilePath);
  } catch (error) {
    console.error('Error generating CSV:', error);
  }

  // Generate and send chart
  try {
    const chartBuffer = await generateArrivalTimeChart({
      departmentName,
      timingSelection,
      singleDayData
    });

    await bot.sendPhoto(chatId, chartBuffer, {}, {
      filename: 'arrival_chart.png',
      contentType: 'image/png'
    });
  } catch (error) {
    console.error('Error generating chart:', error);
  }
};

// Generate daily reports for last 7 days
const generateDailyReports = async (
  bot: TelegramBot,
  chatId: number,
  personsInDepartment: any[],
  departmentName: string,
  startDate: Date,
  endDate: Date
): Promise<void> => {
  const { AccessReportCollection } = await import('/imports/api/accessReport');

  let reportText = `📊 Arrival Time Report - Last 7 Days\n\n`;
  reportText += `🏢 Department: ${departmentName}\n`;
  reportText += `📅 Period: ${moment(startDate).format('DD/MM/YYYY')} - ${moment(endDate).format('DD/MM/YYYY')}\n\n`;

  const dailyData: { [date: string]: { [personName: string]: string | null } } = {};
  const dailyLastEntryData: { [date: string]: { [personName: string]: { time: string | null, type: string | null } } } = {};

  // Generate report for each day
  for (let i = 0; i < 7; i++) {
    console.log(startDate)
    const dayStart = moment(startDate).add(i, 'days').startOf('day').toDate();
    const dayEnd = moment(startDate).add(i, 'days').endOf('day').toDate();
    const dayName = moment(dayStart).format('dddd, DD/MM/YYYY');

    reportText += `\n${'─'.repeat(30)}\n`;
    reportText += `📅 ${dayName}\n`;
    reportText += `${'─'.repeat(30)}\n`;

    let dayPresentCount = 0;
    let dayMissingCount = 0;
    const dayKey = moment(dayStart).format('YYYY-MM-DD');
    dailyData[dayKey] = {};
    dailyLastEntryData[dayKey] = {};

    for (const person of personsInDepartment) {
      const personName = `${person.idInfo?.firstName || ''} ${person.idInfo?.lastName || ''}`.trim();

      // Find first entrance record for this person on this day
      console.log(dayStart, dayEnd)
      const firstEntrance = await AccessReportCollection.findOneAsync({
        idInfo: person._id,
        type: 'entrance',
        timestamp: {
          $gte: dayStart,
          $lte: dayEnd
        }
      }, {
        sort: { timestamp: 1 }
      });

      // Find last entry (entrance or exit) for this person on this day
      const lastEntry = await AccessReportCollection.findOneAsync({
        idInfo: person._id,
        timestamp: {
          $gte: dayStart,
          $lte: dayEnd
        }
      }, {
        sort: { timestamp: -1 }
      });

      if (firstEntrance) {
        const arrivalTime = moment(firstEntrance.timestamp).format('HH:mm');
        const arrivalGateName = await getGateName(firstEntrance.source);

        let entryInfo = `🔵 ${arrivalTime} (${arrivalGateName})`;

        // Add last entry info if it exists and is different from first entrance
        if (lastEntry && lastEntry._id !== firstEntrance._id) {
          const lastTime = moment(lastEntry.timestamp).format('HH:mm');
          const lastGateName = await getGateName(lastEntry.source);
          const lastIcon = lastEntry.type === 'entrance' ? '🔵' : '🔴';
          entryInfo += ` | ${lastIcon} ${lastTime} (${lastGateName})`;
        }

        reportText += `  ✅ ${personName}: ${entryInfo}\n`;
        dailyData[dayKey][personName] = arrivalTime;

        // Store last entry data for CSV
        if (lastEntry && lastEntry._id !== firstEntrance._id) {
          const lastTime = moment(lastEntry.timestamp).format('HH:mm');
          dailyLastEntryData[dayKey][personName] = { time: lastTime, type: lastEntry.type };
        } else {
          dailyLastEntryData[dayKey][personName] = { time: null, type: null };
        }

        dayPresentCount++;
      } else {
        reportText += `  ❌ ${personName}: Missing\n`;
        dailyData[dayKey][personName] = null;
        dailyLastEntryData[dayKey][personName] = { time: null, type: null };
        dayMissingCount++;
      }
    }

    reportText += `  📊 Present: ${dayPresentCount}, Missing: ${dayMissingCount}\n\n`;
  }

  // Overall summary
  reportText += `📈 Overall Summary:\n`;
  reportText += `👥 Total persons in department: ${personsInDepartment.length}\n`;

  // Send the report (split if too long for Telegram)
  if (reportText.length > 4000) {
    // Split the report into chunks
    const chunks = reportText.match(/[\s\S]{1,4000}/g) || [];
    for (let i = 0; i < chunks.length; i++) {
      await bot.sendMessage(chatId, chunks[i]);
      // Small delay between messages to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } else {
    await bot.sendMessage(chatId, reportText);
  }

  // Generate and send CSV file
  try {
    const csvFilePath = await generateArrivalTimeCsv({
      departmentName,
      timingSelection: 'last_7_days',
      dailyData,
      dailyLastEntryData
    });

    await bot.sendDocument(chatId, csvFilePath, {}, {
      filename: `arrival_report_${departmentName}_7days.csv`
    });

    // Clean up CSV file
    fs.unlinkSync(csvFilePath);
  } catch (error) {
    console.error('Error generating CSV:', error);
  }

  // Generate and send chart
  try {
    const chartBuffer = await generateArrivalTimeChart({
      departmentName,
      timingSelection: 'last_7_days',
      dailyData
    });

    await bot.sendPhoto(chatId, chartBuffer, {}, {
      filename: 'arrival_chart_7days.png',
      contentType: 'image/png'
    });
  } catch (error) {
    console.error('Error generating chart:', error);
  }
};

