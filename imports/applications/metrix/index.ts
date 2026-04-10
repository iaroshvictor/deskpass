import HeatmapsApp from './heatmaps';
import heatmapMethods from './heatmaps/serverMethods';
import TrafficTimelineApp from './trafficTimeline';
import trafficTimelineMethods from './trafficTimeline/serverMethods';

export const MetrixMethods = {
    ...heatmapMethods,
    ...trafficTimelineMethods
};

export default {
    HeatmapsApp,
    TrafficTimelineApp
};

