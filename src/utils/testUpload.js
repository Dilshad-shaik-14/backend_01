import { uploadOnCloudinary } from "./cloudinary";

const testUpload = async () => {
  const result = await uploadOnCloudinary("image.jpg", "image"); 
  if (result) {
    console.log("✅ Uploaded to Cloudinary:", result);
  } else {
    console.log("❌ Upload failed");
  }
};

testUpload();
