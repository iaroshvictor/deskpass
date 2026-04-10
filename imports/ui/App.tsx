import React from 'react';
import {Meteor} from 'meteor/meteor'
import  SignIn  from './signin/';
import { useTracker } from 'meteor/react-meteor-data';
import Desktop from './desktop/';

export default function App() {
  const [loading, setLoading] = React.useState(true)
  const myUser = useTracker(() => Meteor.user());
  React.useEffect(()=>{
    if(typeof myUser !== "undefined"){
      setLoading(false)
    }
  },[myUser])
  return (
    <>
    {loading ? <>Loading ...</>
    :<>
      {myUser ?(
          <Desktop />
      )
        :<SignIn />
      }
      </>
    }
    </>
  );
}