import ControllersApp from './controllers';
import GatesApp from './gates';
import AccessPermissionsApp from './accessPermissions';
import AttendanceArchiveApp from './attendanceArchive';
// import ScheduleControlApp from './scheduleControl';
import DivisionsManagementApp from './divisionsManagement';
// import TimeReportsApp from './timeReports';
import GatesControlApp from './gatesControl';
import TemporaryCardsApp from './temporaryCards';
import IntruderAlertsArchive from './intruderAlerts';

// Server methods live in ./methods.ts — importing them here would ship them to
// the browser along with this barrel.

export default {
    ControllersApp,
    GatesApp,
    AccessPermissionsApp,
    AttendanceArchiveApp,
    //ScheduleControlApp,
    DivisionsManagementApp,
    //TimeReportsApp,
    IntruderAlertsArchive,
    GatesControlApp,
    TemporaryCardsApp
};
