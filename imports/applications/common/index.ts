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
import Operators from './Operators';
import Settings from './Settings'
import ScenariosApp from './scenarios';
import ScenarioArchiveApp from './scenarioArchive';
import EventArchiveApp from './eventArchive';

// Server methods live in ./methods.ts — importing them here would ship them to
// the browser along with this barrel.

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
    EventArchiveApp,
};
