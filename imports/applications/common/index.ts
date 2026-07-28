import Zones from './zones'
import CamConfig from './CamConfig';
import {NewCamApp, EditCamApp} from './newCamera';
import  LiveStreamApp from './livestream';
import FacesStreamApp from './facesStream';
import PersonsDatabaseApp from './personsDatabase';
import EnrollPersonApp from './enrollPerson';
import TaskManagerApp from './taskManager';
import ModelsManagementApp from './modelsManagement';
import DvrApp from './dvr';
import RoleBuilderApp from './RoleBuilder';
import zoneMethods from './zones/serverMethods';
import camMethods from './CamConfig/serverMethods';
import liveStreamMethods from './livestream/serverMethods';
import personMethods from './personsDatabase/serverMethods';
import Operators from './Operators';
import OperatorMethods from './Operators/serverMethods';
import SettingsMethods from './Settings/serverMethods';
import RoleBuilderMethods from './RoleBuilder/serverMethods';
import Settings from './Settings'
import ScenariosApp from './scenarios';
import ScenarioArchiveApp from './scenarioArchive';
import scenarioMethods from './scenarios/serverMethods';
export const CommonMethods = {
    ...zoneMethods,
    ...camMethods,
    ...liveStreamMethods,
    ...personMethods,
    ...OperatorMethods,
    ...SettingsMethods,
    ...RoleBuilderMethods,
    ...scenarioMethods,
}
export default {
    Zones,
    CamConfig,
    LiveStreamApp,
    NewCamApp,
    EditCamApp,
    FacesStreamApp,
    PersonsDatabaseApp,
    EnrollPersonApp,
    Operators,
    Settings,
    TaskManagerApp,
    ModelsManagementApp,
    DvrApp,
    RoleBuilderApp,
    ScenariosApp,
    ScenarioArchiveApp,
};