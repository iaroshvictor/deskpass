import { Meteor } from 'meteor/meteor';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
import { Accounts } from 'meteor/accounts-base';
const Methods : {[x:string]:MeteorMethod} = {
    'operators.insert': function(data:{username:string, password:string}) {
        // method implementation
        const {username, password} = data;
        Accounts.createUser(
              {
                username,
                password
              }
            );
    },
    'operators.update': async function(id:string,data:{username:string, password:string}) {
        // method implementation
        const {username, password} = data;
        try {
            await Meteor.users.updateAsync(id, {
                $set: {
                    username,
                }
            });
            if (password) {
                if (Meteor.isServer) {
                    console.log(Accounts.setPassword)
                    Accounts.setPassword(id, password);
                }
            }
        } catch (error) {
            console.error("Error updating user:", error);
        }

    },
    'operators.remove': function(id:string) {
        // method implementation
        console.log("Removing user with ID:", id);
        Meteor.users.removeAsync(id, (error:any) => {
            if (error) {
                console.error("Error removing user:", error);
            } else {
                console.log("User removed successfully");
            }
        });
    }
}
export default Methods;