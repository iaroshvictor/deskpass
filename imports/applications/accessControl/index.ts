import ControllersApp from './controllers';
import GatesApp from './gates';
import AccessPermissionsApp from './accessPermissions';
import AttendanceArchiveApp from './attendanceArchive';
// import ScheduleControlApp from './scheduleControl';
import DivisionsManagementApp from './divisionsManagement';
// import TimeReportsApp from './timeReports';
import GatesControlApp from './gatesControl';
import TemporaryCardsApp from './temporaryCards';

import ControllerMethods from './controllers/serverMethods';
import GateMethods from './gates/serverMethods';
import DivisionMethods from './divisionsManagement/serverMethods';
import IntruderMethods from './intruderAlerts/servermethods';
import IntruderAlertsArchive from './intruderAlerts';
import AttendanceMethods from './attendanceArchive/serverMethods';
import AccessPermissionsMethods from './accessPermissions/serverMethods';
import TemporaryCardsMethods from './temporaryCards/serverMethods';

const AccessControllMethods = {...ControllerMethods, ...GateMethods, ...DivisionMethods, ...IntruderMethods, ...AttendanceMethods, ...AccessPermissionsMethods, ...TemporaryCardsMethods};
export { AccessControllMethods };

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
