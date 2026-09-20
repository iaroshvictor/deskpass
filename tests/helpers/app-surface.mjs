// What the application actually exposes, read from the source.
//
// The form tests need two lists that must not be maintained by hand, because
// a hand-kept list silently stops matching the app: every screen that submits
// a form, and every method name the server registers. Both are derived here.
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) { if (entry !== 'node_modules') walk(p, out); }
    else out.push(p);
  }
  return out;
};

const posix = (p) => p.split(path.sep).join('/');

/** Controls that make a screen a form rather than a read-only view. */
const INPUT = /<(TextField|Input|Select|Checkbox|Switch|Autocomplete|DateRangePicker|RadioGroup|InputPicker|SelectPicker|TagPicker)\b/;

/**
 * Screens that take input and submit it: { file, methods[] }.
 *
 * A screen counts as a form when it renders at least one input control and
 * calls at least one Meteor method.
 */
export function formScreens(root = 'imports/applications') {
  const screens = [];
  for (const file of walk(root).filter((f) => f.endsWith('.tsx'))) {
    const src = fs.readFileSync(file, 'utf8');
    if (!INPUT.test(src)) continue;
    const methods = [...src.matchAll(/Meteor\.(?:call|callAsync)\(\s*'([^']+)'/g)].map((m) => m[1]);
    if (!methods.length) continue;
    screens.push({ file: posix(file), methods: [...new Set(methods)].sort() });
  }
  return screens.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Method names declared as members of an object literal.
 *
 * Counting braces to find the object's extent does not survive braces inside
 * strings, comments and template literals, so this reads the indentation
 * instead: every method in these files is a member at the first or second
 * levels, written as `name(`, `async name(` or `name: function`. A member
 * nested deeper is indented deeper and is not a method.
 */
function memberNames(src) {
  const names = [];
  const member = /^ {2,8}(?:async\s+)?['"]?([A-Za-z_$][\w.$]*)['"]?\s*(?:\(|:\s*(?:async\s+)?function|:\s*(?:async\s+)?\()/;
  for (const line of src.split('\n')) {
    const m = line.match(member);
    if (m) names.push(m[1]);
  }
  return names;
}

/**
 * Every method name the server registers.
 *
 * Methods reach Meteor two ways here: literal `Meteor.methods({...})` blocks,
 * and per-application objects (`imports/applications/**\/serverMethods.ts`)
 * that server/main.ts spreads into one call.
 */
export function serverMethodNames(roots = ['server', 'imports']) {
  const names = new Set();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root).filter((f) => /\.tsx?$/.test(f))) {
      const src = fs.readFileSync(file, 'utf8');
      // One application spells the file servermethods.ts, so match either.
      const isMethodsFile = /servermethods\.tsx?$/i.test(file);
      if (!isMethodsFile && !src.includes('Meteor.methods(')) continue;
      for (const name of memberNames(src)) names.add(name);
    }
  }
  return names;
}
