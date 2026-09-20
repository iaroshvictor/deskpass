/**
 * Server methods for the metrix applications.
 * Separated from ./index.ts so they never reach the client bundle — see the
 * note in ../common/methods.ts.
 */
import heatmapMethods from './heatmaps/serverMethods';
import trafficTimelineMethods from './trafficTimeline/serverMethods';

export const MetrixMethods = {
    ...heatmapMethods,
    ...trafficTimelineMethods,
};
