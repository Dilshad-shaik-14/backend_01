import { Router } from 'express';
import {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylist,
} from "../controllers/playlist.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import { playlistUpload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/").post(verifyJWT, playlistUpload, createPlaylist);

router
    .route("/:playlistId")
    .get(verifyJWT,getPlaylistById)
    .patch(verifyJWT,playlistUpload,updatePlaylist)
    .delete(verifyJWT,deletePlaylist);

router.route("/add/:videoId/:playlistId").patch(verifyJWT,addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").delete(verifyJWT,removeVideoFromPlaylist);

router.route("/user/:userId").get(verifyJWT,getUserPlaylists);

export default router;