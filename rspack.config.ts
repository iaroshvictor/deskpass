import { defineConfig } from "@meteorjs/rspack";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the `Meteor` object, such as:
 * - `Meteor.isClient` / `Meteor.isServer`
 * - `Meteor.isDevelopment` / `Meteor.isProduction`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */

// Type checking costs more than the compile itself on this codebase — around
// twelve minutes a build — and it repeats work that `npm run typecheck` (and
// any editor) already does. Off by default in development, always on for a
// production build. Set DESKPASS_TYPECHECK=1 to get it back in dev.
const typeCheckInDev = process.env.DESKPASS_TYPECHECK === '1';

export default defineConfig((Meteor) => {
  const isDev = Meteor.isDevelopment;
  const typeCheck = !isDev || typeCheckInDev;

  return {
    plugins: typeCheck ? [new TsCheckerRspackPlugin()] : [],

    // Source maps in development: the default full 'source-map' took minutes
    // to produce for a bundle this size, and the `eval-` variants inline the
    // map into the bundle, which doubled it to 18 MB — the browser then spends
    // longer downloading than the build saved. This keeps the map in a
    // separate file the browser fetches only when devtools are open, so the
    // bundle stays small and the build stays quick. Production is untouched.
    ...(isDev && { devtool: 'cheap-module-source-map' as const }),

    externals: [{ canvas: 'commonjs canvas', '@node-rs/xxhash': 'commonjs @node-rs/xxhash', 'node-datachannel': 'commonjs node-datachannel' }],
  };
});
