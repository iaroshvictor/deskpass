import { Meteor } from 'meteor/meteor';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
const Methods : {[x:string]:MeteorMethod} = {

}
export default Methods;