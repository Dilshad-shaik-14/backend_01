import { Router } from "express";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishVideo,
  togglePublishStatus,
  updateVideo,
  getVideoDetails,
  getVideoByTitle
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { videoUpload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/")
  .get(getAllVideos)
  .post(videoUpload, publishVideo);

router.route("/title/:title").get(getVideoByTitle);
router.route("/toggle/publish/:videoId").patch(togglePublishStatus);
router.route("/details/:videoId").get(getVideoDetails);

router.route("/:videoId")
  .get(getVideoById)
  .delete(deleteVideo)
  .patch(videoUpload, updateVideo);



export default router;
