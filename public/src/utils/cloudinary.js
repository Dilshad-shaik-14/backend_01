import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

 // Configuration
 cloudinary.config({ 
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME ,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET 
 });

 const uploadOnCloudinary = async (localFilePath, resourceType = "auto") => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: resourceType, // ✅ respects passed "video"
    });

    fs.unlinkSync(localFilePath); // clean up
    return {
      ...response,
      url: response.secure_url,
    };
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};


const deleteFileByUrl = async (fileUrl, resourceType = "image") => {
  try {
    if (!fileUrl) return;

    // Extract publicId from full URL
    const parts = fileUrl.split("/upload/");
    if (parts.length < 2) return;

    const publicIdWithExt = parts[1].split(".")[0]; // "my_folder/my_video"
    await cloudinary.uploader.destroy(publicIdWithExt, { resource_type: resourceType });
  } catch (error) {
    console.error("❌ Error deleting file from Cloudinary:", error.message);
  }
};


export { uploadOnCloudinary, deleteFileByUrl };
