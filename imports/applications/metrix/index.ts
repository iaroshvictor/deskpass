import HeatmapsApp from './heatmaps';
import TrafficTimelineApp from './trafficTimeline';

// Server methods live in ./methods.ts — importing them here would ship them to
// the browser along with this barrel.

export default {
    HeatmapsApp,
    TrafficTimelineApp
};
