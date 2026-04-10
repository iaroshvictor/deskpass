import PersonLists from "./personLists";
import AlertsArchive from "./alertsArchive";
import personListsMethods from "./personLists/serverMethods"; 
import alertsArchiveMethods from './alertsArchive/serverMethods'

export const PersonAlertmethods ={
    ...personListsMethods,
    ...alertsArchiveMethods

}
export default {PersonLists, AlertsArchive }