import React from 'react';
import {Meteor} from 'meteor/meteor'
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CustomProvider from 'rsuite/CustomProvider';
import  SignIn  from './signin/';
import { useTracker } from 'meteor/react-meteor-data';
import Desktop from './desktop/';
import theme from './theme';

/**
 * Keeps the date-range picker in step with the app theme.
 *
 * rsuite is in the project for exactly one component, and its stylesheet —
 * pasted into client/main.css — already ships both `.rs-theme-light` and
 * `.rs-theme-dark`. All that was missing is something to switch the class, so
 * the picker no longer stays a white rectangle on a dark screen.
 */
function ThemedShell({ children }: { children: React.ReactNode }) {
  const { mode, systemMode } = useColorScheme();
  const resolved = (mode === 'system' ? systemMode : mode) ?? 'dark';
  return <CustomProvider theme={resolved}>{children}</CustomProvider>;
}

export default function App() {
  const [loading, setLoading] = React.useState(true)
  const myUser = useTracker(() => Meteor.user());
  React.useEffect(()=>{
    if(typeof myUser !== "undefined"){
      setLoading(false)
    }
  },[myUser])
  return (
    // defaultMode "system" so a workstation that is already dark stays dark;
    // CssBaseline applies the palette to <body>, which until now was styled
    // only by hand in client/main.css.
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <ThemedShell>
        {loading ? <>Loading ...</>
        :<>
          {myUser ?(
              <Desktop />
          )
            :<SignIn />
          }
          </>
        }
      </ThemedShell>
    </ThemeProvider>
  );
}
