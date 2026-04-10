import { ZonesCollection } from "/imports/api/zones"
export default {
    addZoneItem:async({parent, name}:{parent:string, name:string})=>{
      ZonesCollection.insertAsync({parent, name})
    },
    editZone:async({id, name}:{id:string, name:string})=>{
      ZonesCollection.updateAsync(id, {$set:{name}})
    },
    deleteZone:async(id:string)=>{
      const currentZone = await ZonesCollection.findOneAsync({_id:id})
      ZonesCollection.updateAsync({parent:id}, {$set:{parent:currentZone?.parent || 'root'}})
      ZonesCollection.removeAsync(id)
    }
  }