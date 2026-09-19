import { ZonesCollection } from "/imports/api/zones"
import { requirePermission } from "/imports/security/guards"
import { PERMISSIONS } from "/imports/security/accessPolicy"
import { Meteor } from "meteor/meteor"

export default {
    addZoneItem: async function (this: Meteor.MethodThisType, { parent, name }: { parent: string, name: string }) {
      await requirePermission(this, PERMISSIONS.ZONE_EDIT);
      if (typeof name !== 'string' || !name.trim()) {
        throw new Meteor.Error('invalid-zone', 'A zone name is required.');
      }
      return await ZonesCollection.insertAsync({ parent: parent || 'root', name: name.trim() });
    },
    editZone: async function (this: Meteor.MethodThisType, { id, name }: { id: string, name: string }) {
      await requirePermission(this, PERMISSIONS.ZONE_EDIT);
      if (typeof name !== 'string' || !name.trim()) {
        throw new Meteor.Error('invalid-zone', 'A zone name is required.');
      }
      return await ZonesCollection.updateAsync(id, { $set: { name: name.trim() } });
    },
    deleteZone: async function (this: Meteor.MethodThisType, id: string) {
      await requirePermission(this, PERMISSIONS.ZONE_EDIT);
      const currentZone = await ZonesCollection.findOneAsync({ _id: id });
      if (!currentZone) return 0;
      // Re-parent the children first and wait for it: when both writes were
      // fired without await the removal could land first and orphan them.
      await ZonesCollection.updateAsync(
        { parent: id },
        { $set: { parent: currentZone.parent || 'root' } },
        { multi: true },
      );
      return await ZonesCollection.removeAsync(id);
    }
  }
