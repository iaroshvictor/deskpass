/**
 * Server methods for the person-alert applications.
 * Separated from ./index.ts so they never reach the client bundle — see the
 * note in ../common/methods.ts.
 */
import personListsMethods from "./personLists/serverMethods";
import alertsArchiveMethods from './alertsArchive/serverMethods';

export const PersonAlertmethods = {
    ...personListsMethods,
    ...alertsArchiveMethods,
};
