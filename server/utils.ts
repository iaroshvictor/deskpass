
import { createCanvas, loadImage } from 'canvas';
import { Meteor } from 'meteor/meteor';

// Resize a base64 image to a maxWidth using canvas
const resizeBase64Image= async(base64Image: string, maxWidth: number): Promise<string> =>{
    if (Meteor.isServer) {
        // Extract base64 string data (in case it has a data URL prefix)
        if(base64Image === '')
            return ''
        // Load image from base64 string
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const image = await loadImage(imageBuffer);

        // Calculate the height based on the maxWidth while preserving aspect ratio
        const aspectRatio = image.width / image.height;
        const newHeight = maxWidth / aspectRatio;

        // Create canvas and set its size
        const canvas = createCanvas(maxWidth, newHeight);
        const ctx = canvas.getContext('2d');

        // Draw the image on the canvas
        ctx.drawImage(image, 0, 0, maxWidth, newHeight);

        // Get the resized image as a base64 string
        const resizedBase64Image = canvas.toDataURL('image/jpeg');  // You can change to 'image/png' if needed
        // Remove the data URL prefix
        return resizedBase64Image.split(',')[1]; // Return only the base64 part
    }
    return ''
}
export default resizeBase64Image;
