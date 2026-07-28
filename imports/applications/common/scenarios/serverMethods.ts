import { Meteor } from 'meteor/meteor';
import { ScenariosCollection, ScenarioEventsCollection, Scenario, TRIGGER_SOURCE } from '/imports/api/scenarios';
import { ScenariosV2Collection, ScenarioEventsV2Collection, ScenarioV2 } from '/imports/api/scenarioModel';

function validateV2(s: Partial<ScenarioV2>) {
  if (!s.name?.trim()) throw new Meteor.Error('invalid-scenario', 'Name is required');
  if (!s.scope?.kind) throw new Meteor.Error('invalid-scenario', 'Scope is required');
  if (s.scope.kind === 'cams' && !s.scope.camIds?.length)
    throw new Meteor.Error('invalid-scenario', 'Pick at least one camera');
  if (s.scope.kind === 'zone' && !s.scope.zoneDefId)
    throw new Meteor.Error('invalid-scenario', 'Pick a zone');
  if (s.scope.kind === 'line' && !s.scope.lineDefId)
    throw new Meteor.Error('invalid-scenario', 'Pick a line');
  if (!s.rule?.condition?.kind) throw new Meteor.Error('invalid-scenario', 'Condition is required');
}

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any;

function validate(data: Partial<Scenario>) {
  if (!data.name?.trim()) throw new Meteor.Error('invalid-scenario', 'Name is required');
  if (!data.camId) throw new Meteor.Error('invalid-scenario', 'Camera is required');
  if (!data.trigger) throw new Meteor.Error('invalid-scenario', 'Trigger is required');
  const src = TRIGGER_SOURCE[data.trigger];
  if (src === 'zone' && !data.zoneId) throw new Meteor.Error('invalid-scenario', 'This trigger needs a zone');
  if (src === 'line' && !data.lineId) throw new Meteor.Error('invalid-scenario', 'This trigger needs a line');
}

const scenarioMethods: { [x: string]: MeteorMethod } = {
  async insertScenario(data: Scenario) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    validate(data);
    return ScenariosCollection.insertAsync({
      ...data,
      enabled: data.enabled ?? true,
      cooldownSec: data.cooldownSec ?? 30,
      severity: data.severity ?? 'warning',
      params: data.params ?? {},
      createdAt: new Date(),
      triggerCount: 0,
    });
  },
  async updateScenario(id: string, data: Partial<Scenario>) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    validate({ ...(await ScenariosCollection.findOneAsync({ _id: id })), ...data });
    const { _id, createdAt, triggerCount, lastTriggeredAt, ...set } = data as any;
    return ScenariosCollection.updateAsync({ _id: id }, { $set: set });
  },
  async removeScenario(id: string) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    return ScenariosCollection.removeAsync({ _id: id });
  },
  async setScenarioEnabled(id: string, enabled: boolean) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    return ScenariosCollection.updateAsync({ _id: id }, { $set: { enabled } });
  },
  async markScenarioEventsSeen(ids?: string[]) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    return ScenarioEventsCollection.updateAsync(
      ids?.length ? { _id: { $in: ids } } : { seen: false },
      { $set: { seen: true } }, { multi: true });
  },

  // ── v2 (scenario model with scope/schedule/rule) ──────────────────────────
  async insertScenarioV2(data: ScenarioV2) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    validateV2(data);
    return ScenariosV2Collection.insertAsync({
      ...data,
      enabled: data.enabled ?? true,
      cooldownSec: data.cooldownSec ?? 30,
      severity: data.severity ?? 'warning',
      createdAt: new Date(),
      triggerCount: 0,
    });
  },
  async updateScenarioV2(id: string, data: Partial<ScenarioV2>) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    validateV2({ ...(await ScenariosV2Collection.findOneAsync({ _id: id })), ...data });
    const { _id, createdAt, triggerCount, lastTriggeredAt, ...set } = data as any;
    return ScenariosV2Collection.updateAsync({ _id: id }, { $set: set });
  },
  async removeScenarioV2(id: string) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    return ScenariosV2Collection.removeAsync({ _id: id });
  },
  async setScenarioV2Enabled(id: string, enabled: boolean) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    return ScenariosV2Collection.updateAsync({ _id: id }, { $set: { enabled } });
  },
  async markScenarioEventsV2Seen(ids?: string[]) {
    if (!this.userId) throw new Meteor.Error('not-authorized');
    return ScenarioEventsV2Collection.updateAsync(
      ids?.length ? { _id: { $in: ids } } : { seen: false },
      { $set: { seen: true } }, { multi: true });
  },
};

export default scenarioMethods;
