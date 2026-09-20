/**
 * Server methods for the access-control applications.
 * Separated from ./index.ts so they never reach the client bundle — see the
 * note in ../common/methods.ts.
 */
import ControllerMethods from './controllers/serverMethods';
import GateMethods from './gates/serverMethods';
import DivisionMethods from './divisionsManagement/serverMethods';
import IntruderMethods from './intruderAlerts/servermethods';
import AttendanceMethods from './attendanceArchive/serverMethods';
import AccessPermissionsMethods from './accessPermissions/serverMethods';
import TemporaryCardsMethods from './temporaryCards/serverMethods';

export const AccessControllMethods = {
    ...ControllerMethods,
    ...GateMethods,
    ...DivisionMethods,
    ...IntruderMethods,
    ...AttendanceMethods,
    ...AccessPermissionsMethods,
    ...TemporaryCardsMethods,
};
