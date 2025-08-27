import multer from "multer";
import path from "path";
import fs from "fs";

const tempDir = path.join("/tmp", "uploads");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, tempDir);
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

const videoUpload = upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "videoFile", maxCount: 1 },
]);

const playlistUpload = upload.fields([
  { name: "coverImage", maxCount: 1 },
]);


export { upload, videoUpload, playlistUpload };
