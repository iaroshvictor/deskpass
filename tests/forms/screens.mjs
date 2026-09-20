// Every screen in the application that takes input and submits it.
//
// The list is written out by hand on purpose: tests/forms/inventory.test.mjs
// compares it against what the source actually contains, so adding a form
// without deciding how it is covered fails the suite. `submits` names the
// methods the screen sends; `kind` says what the screen does with them:
//
//   entity  — creates, edits or deletes records (the CRUD forms)
//   action  — performs an operation on existing records (mark seen, merge…)
//   config  — writes application settings
//   query   — filter controls that only read (counts, reports, timelines)
//   probe   — validates a device or link before it is saved
export const SCREENS = [
  {
    file: 'imports/applications/accessControl/accessPermissions/index.tsx',
    title: 'Access permissions',
    kind: 'entity',
    submits: ['updatePersonAllowedGates'],
  },
  {
    file: 'imports/applications/accessControl/attendanceArchive/index.tsx',
    title: 'Attendance archive filters',
    kind: 'query',
    submits: ['countAccessReport'],
  },
  {
    file: 'imports/applications/accessControl/controllers/index.tsx',
    title: 'Controllers',
    kind: 'entity',
    submits: ['addController', 'editController', 'removeController'],
  },
  {
    file: 'imports/applications/accessControl/divisionsManagement/CustomTreeItem.tsx',
    title: 'Divisions tree editor',
    kind: 'entity',
    submits: ['insertDivision', 'removeDivision', 'updateDivision'],
  },
  {
    file: 'imports/applications/accessControl/divisionsManagement/exportWizard.tsx',
    title: 'Division export wizard',
    kind: 'query',
    submits: ['exportPersons'],
  },
  {
    file: 'imports/applications/accessControl/divisionsManagement/index.tsx',
    title: 'Divisions management',
    kind: 'query',
    submits: ['countVisits'],
  },
  {
    file: 'imports/applications/accessControl/gates/index.tsx',
    title: 'Gates',
    kind: 'entity',
    submits: ['insertGate', 'removeGate', 'updateGate', 'validateRtspLink'],
  },
  {
    file: 'imports/applications/accessControl/intruderAlerts/index.tsx',
    title: 'Intruder alerts',
    kind: 'action',
    submits: ['countIntruder', 'setSeenIntruder'],
  },
  {
    file: 'imports/applications/accessControl/intruderAlerts/intruderItemModal.tsx',
    title: 'Intruder alert details',
    kind: 'action',
    submits: ['findBestMatch', 'getUserName', 'reposessIntruder', 'setSeenIntruder'],
  },
  {
    file: 'imports/applications/accessControl/temporaryCards/index.tsx',
    title: 'Temporary cards',
    kind: 'entity',
    submits: ['attachTemporaryCard', 'countTemporaryCards', 'removeTemporaryCard'],
  },
  {
    file: 'imports/applications/common/Operators/index.tsx',
    title: 'Operators',
    kind: 'entity',
    submits: ['operators.insert', 'operators.remove', 'operators.update'],
  },
  {
    file: 'imports/applications/common/RoleBuilder/index.tsx',
    title: 'Role builder',
    kind: 'entity',
    submits: ['roleDefinitions.insert', 'roleDefinitions.remove', 'roleDefinitions.update'],
  },
  {
    file: 'imports/applications/common/Settings/index.tsx',
    title: 'Settings',
    kind: 'config',
    submits: ['doApolloSync', 'getBotLink', 'setApacsConfig', 'setDvrConfig', 'setTgBot'],
  },
  {
    file: 'imports/applications/common/eventArchive/index.tsx',
    title: 'Event archive',
    kind: 'action',
    submits: ['markScenarioEventsV2Seen', 'setAllAlertsSeen', 'setSeenAlert', 'setSeenIntruder'],
  },
  {
    file: 'imports/applications/common/enrollPerson/index.tsx',
    title: 'Enroll person',
    kind: 'action',
    submits: ['optimizeVisits', 'removeVisitItems', 'reposessModels'],
  },
  {
    file: 'imports/applications/common/livestream/index.tsx',
    title: 'Livestream watch-words',
    kind: 'action',
    submits: ['markCaptionAlertSeen', 'restartCamHandler', 'setCaptionKeywords', 'webrtcOffer'],
  },
  {
    file: 'imports/applications/common/modelsManagement/index.tsx',
    title: 'Models management',
    kind: 'action',
    submits: ['removeVisitItems'],
  },
  {
    file: 'imports/applications/common/newCamera/camForm.tsx',
    title: 'Camera form',
    kind: 'entity',
    submits: ['insertCam', 'updateCam', 'validateRtspLink'],
  },
  {
    file: 'imports/applications/common/newCamera/camOverlay.tsx',
    title: 'Camera lines and zones',
    kind: 'entity',
    submits: ['insertCamLineDef', 'insertCamZoneDef', 'updateCamLineDef', 'updateCamZoneDef'],
  },
  {
    file: 'imports/applications/common/newCamera/newCam.tsx',
    title: 'Add camera wizard',
    kind: 'probe',
    submits: ['validateOnvifDevice', 'validateRtspLink'],
  },
  {
    file: 'imports/applications/common/personsDatabase/indetifyEditForm.tsx',
    title: 'Person identity editor',
    kind: 'entity',
    submits: ['editVisitSummary', 'removeVisit', 'removeVisitItems', 'setRefereceModels', 'setSummaryPhoto'],
  },
  {
    file: 'imports/applications/common/personsDatabase/index.tsx',
    title: 'Persons database',
    kind: 'action',
    submits: ['countVisits', 'mergeVisits', 'optimizeVisits', 'removeVisit', 'removeVisitItems'],
  },
  {
    file: 'imports/applications/common/scenarioArchive/index.tsx',
    title: 'Scenario archive filters',
    kind: 'action',
    submits: ['markScenarioEventsV2Seen'],
  },
  {
    file: 'imports/applications/common/scenarios/index.tsx',
    title: 'Scenarios',
    kind: 'entity',
    submits: ['insertScenarioV2', 'markScenarioEventsV2Seen', 'removeScenarioV2', 'setScenarioV2Enabled', 'updateScenarioV2'],
  },
  {
    file: 'imports/applications/common/zones/index.tsx',
    title: 'Zones',
    kind: 'entity',
    submits: ['addZoneItem', 'deleteZone', 'editZone'],
  },
  {
    file: 'imports/applications/metrix/heatmaps/index.tsx',
    title: 'Heatmaps filters',
    kind: 'query',
    submits: ['getHeatmapData'],
  },
  {
    file: 'imports/applications/metrix/trafficTimeline/index.tsx',
    title: 'Traffic timeline filters',
    kind: 'query',
    submits: ['getTrafficTimeline'],
  },
  {
    file: 'imports/applications/personAlert/alertsArchive/index.tsx',
    title: 'Alerts archive',
    kind: 'action',
    submits: ['setSeenAlert'],
  },
  {
    file: 'imports/applications/personAlert/personLists/index.tsx',
    title: 'Person lists',
    kind: 'entity',
    submits: ['addAlertList', 'editAlertList'],
  },
];

/** Every method reachable from a form, de-duplicated. */
export const FORM_METHODS = [...new Set(SCREENS.flatMap((s) => s.submits))].sort();
