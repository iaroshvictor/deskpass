import { Meteor } from 'meteor/meteor';
import { VisitsCollection } from '/imports/api/visits';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any;

export type TimeInterval = '5min' | '15min' | '30min' | '1hour' | '1day';

export interface TimelineDataPoint {
    timestamp: Date;
    count: number; // Unique visitors (distinct tracking_ids)
}

export interface TrafficTimelineData {
    dataPoints: TimelineDataPoint[];
    totalUniqueVisitors: number;
    interval: TimeInterval;
}

// Get milliseconds for each interval type
function getIntervalMs(interval: TimeInterval): number {
    switch (interval) {
        case '5min': return 5 * 60 * 1000;
        case '15min': return 15 * 60 * 1000;
        case '30min': return 30 * 60 * 1000;
        case '1hour': return 60 * 60 * 1000;
        case '1day': return 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000;
    }
}

const trafficTimelineMethods: { [x: string]: MeteorMethod } = {
    /**
     * Get traffic timeline data for a specific camera within a date range
     * Groups visits by time intervals and counts unique tracking_ids
     */
    getTrafficTimeline: async function (
        camId: string,
        startDate: Date,
        endDate: Date,
        interval: TimeInterval = '1hour'
    ): Promise<TrafficTimelineData> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }

        if (!camId) {
            throw new Meteor.Error('invalid-cam', 'Camera ID is required.');
        }

        const intervalMs = getIntervalMs(interval);

        // Use MongoDB aggregation to group by time intervals and count unique tracking_ids
        const pipeline = [
            {
                $match: {
                    source: camId,
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                // Create time bucket based on interval
                $group: {
                    _id: {
                        $subtract: [
                            { $toLong: '$timestamp' },
                            { $mod: [{ $toLong: '$timestamp' }, intervalMs] }
                        ]
                    },
                    uniqueVisitors: { $addToSet: '$tracking_id' }
                }
            },
            {
                $project: {
                    _id: 1,
                    count: { $size: '$uniqueVisitors' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ];

        const rawCollection = VisitsCollection.rawCollection();
        const results = await rawCollection.aggregate(pipeline).toArray();

        // Convert results to TimelineDataPoint array
        const dataPoints: TimelineDataPoint[] = results.map((r: any) => ({
            timestamp: new Date(r._id),
            count: r.count
        }));

        // Calculate total unique visitors across the entire period
        const totalPipeline = [
            {
                $match: {
                    source: camId,
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    uniqueVisitors: { $addToSet: '$tracking_id' }
                }
            },
            {
                $project: {
                    count: { $size: '$uniqueVisitors' }
                }
            }
        ];

        const totalResult = await rawCollection.aggregate(totalPipeline).toArray();
        const totalUniqueVisitors = totalResult.length > 0 ? totalResult[0].count : 0;

        return {
            dataPoints,
            totalUniqueVisitors,
            interval
        };
    }
};

export default trafficTimelineMethods;

