import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import  App  from '/imports/ui/App';
// rsuite's own stylesheet, complete and matched to the installed version.
// A hand-pasted excerpt used to live in client/main.css; it stopped partway
// through the file, which left out the rules that place every popup — pickers
// opened off-screen. The no-reset build is the one to use next to MUI: it
// leaves the global element reset to CssBaseline.
import 'rsuite/dist/rsuite-no-reset.css';

Meteor.startup(() => {
  const container = document.getElementById('react-target');
  const root = createRoot(container!);
  root.render(<App />);
});
