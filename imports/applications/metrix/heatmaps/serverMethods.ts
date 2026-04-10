import { Meteor } from 'meteor/meteor';
import { VisitsCollection } from '/imports/api/visits';
import { CamsCollection } from '/imports/api/cams';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any;

export interface HeatmapPoint {
    x: number;
    y: number;
    intensity: number;
}

export interface HeatmapData {
    points: HeatmapPoint[];
    // Detection frame dimensions (from the detection pipeline)
    detectionWidth: number;
    detectionHeight: number;
    snapshot: string;
}

const heatmapMethods: { [x: string]: MeteorMethod } = {
    /**
     * Get heatmap data for a specific camera within a date range
     * Calculates the bottom-middle point of each person_box (representing feet position)
     */
    getHeatmapData: async function (
        camId: string,
        startDate: Date,
        endDate: Date
    ): Promise<HeatmapData> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to get heatmap data.');
        }

        if (!camId) {
            throw new Meteor.Error('invalid-cam', 'Camera ID is required.');
        }

        // Get the camera to retrieve the snapshot
        const cam = await CamsCollection.findOneAsync({ _id: camId });
        if (!cam) {
            throw new Meteor.Error('cam-not-found', 'Camera not found.');
        }

        if (!cam.snapshot) {
            throw new Meteor.Error('no-snapshot', 'Camera does not have a snapshot configured. Please update the camera snapshot first.');
        }

        // Query visits for the specified camera and date range
        const filter: any = {
            source: camId,
            timestamp: {
                $gte: startDate,
                $lte: endDate
            }
        };

        const visits = await VisitsCollection.find(filter, {
            fields: { person_box: 1, face_box: 1 }
        }).fetchAsync();

        // Calculate heatmap point for each visit
        // Priority: use bottom-middle of person_box (feet position)
        // Fallback: use center of face_box if person_box is invalid
        const pointsMap: Map<string, number> = new Map();
        const gridSize = 10; // 10px grid for aggregation

        for (const visit of visits) {
            let x: number | null = null;
            let y: number | null = null;

            const personBox = visit.person_box;
            const faceBox = visit.face_box;

            // Check if person_box is valid (width and height > 20)
            if (personBox && personBox.width > 20 && personBox.height > 20) {
                const { left, top, width, height } = personBox;

                // Validate coordinates are within detection frame
                if (left >= 0 && top >= 0 && left + width <= 1920 && top + height <= 1080) {
                    // Bottom-middle point (feet position)
                    x = Math.round(left + width / 2);
                    y = Math.round(top + height);
                }
            }

            // Fallback to face_box center if person_box is invalid
            if (x === null && faceBox && faceBox.width > 10 && faceBox.height > 10) {
                const { left, top, width, height } = faceBox;

                // Validate coordinates are within detection frame
                if (left >= 0 && top >= 0 && left + width <= 1920 && top + height <= 1080) {
                    // Center of face_box
                    x = Math.round(left + width / 2);
                    y = Math.round(top + height / 2);
                }
            }

            // Skip if no valid coordinates found
            if (x === null || y === null) {
                continue;
            }

            // Aggregate to grid cell
            const gridX = Math.round(x / gridSize) * gridSize;
            const gridY = Math.round(y / gridSize) * gridSize;
            const key = `${gridX},${gridY}`;

            const currentCount = pointsMap.get(key) || 0;
            pointsMap.set(key, currentCount + 1);
        }

        // Convert map to array of points with intensity
        const maxCount = Math.max(...Array.from(pointsMap.values()), 1);
        const points: HeatmapPoint[] = [];

        pointsMap.forEach((count, key) => {
            const [x, y] = key.split(',').map(Number);
            points.push({
                x,
                y,
                intensity: count / maxCount // Normalize intensity between 0-1
            });
        });

        // Return points with detection frame dimensions
        // The detection pipeline uses 1920x1080 (from capsfilter in detection app)
        // Client will scale points to match actual snapshot dimensions
        return {
            points,
            detectionWidth: 1920,
            detectionHeight: 1080,
            snapshot: cam.snapshot
        };
    },

    /**
     * Count visits for heatmap preview (returns count without full data)
     * Counts visits that have either valid person_box OR valid face_box
     */
    countHeatmapVisits: async function (
        camId: string,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in.');
        }

        const filter: any = {
            source: camId,
            timestamp: {
                $gte: startDate,
                $lte: endDate
            },
            // Count visits with valid person_box OR valid face_box
            $or: [
                { 'person_box.width': { $gt: 20 }, 'person_box.height': { $gt: 20 } },
                { 'face_box.width': { $gt: 10 }, 'face_box.height': { $gt: 10 } }
            ]
        };

        return await VisitsCollection.find(filter).countAsync();
    }
};

export default heatmapMethods;

