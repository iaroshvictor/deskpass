/**
 * Server methods for the "common" applications.
 *
 * Kept out of ./index.ts on purpose. That module is the UI barrel the client
 * imports, and a bundler keeps every module the barrel touches — so importing
 * the serverMethods there shipped their implementations, role lookups and
 * integration identifiers included, inside the client bundle. Only
 * server/main.ts imports this file.
 */
import zoneMethods from './zones/serverMethods';
import camMethods from './CamConfig/serverMethods';
import liveStreamMethods from './livestream/serverMethods';
import personMethods from './personsDatabase/serverMethods';
import OperatorMethods from './Operators/serverMethods';
import SettingsMethods from './Settings/serverMethods';
import RoleBuilderMethods from './RoleBuilder/serverMethods';
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
};
