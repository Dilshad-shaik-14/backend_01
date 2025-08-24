import { Router } from 'express';
import { 
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    changeCurrentPassword, 
    getCurrentUser,
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage, 
    getUserChannelProfile, 
    getWatchHistory,
    suggestUsers,
    getRegisteredUsers,
    deleteWatchHistory,
    forgetPassword,
    resetPassword,
    deleteAvatar,
    deleteCoverImage
}
from '../controllers/user.controller.js';
import {upload} from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import multer from 'multer';

const router = Router()

router.route('/register').post(
    upload.fields([
        {name: 'avatar', maxCount: 1},
        {name: 'coverImage', maxCount: 1}
    ]),
    registerUser
)


router.route('/login').post(loginUser)
//secured routes
router.route('/logout').post(verifyJWT, logoutUser)
router.route('/refresh-token').post(refreshAccessToken)
router.route('/change-password').post(verifyJWT, changeCurrentPassword)
router.route('/current-user').get(verifyJWT, getCurrentUser)
router.route('/update-account').patch(verifyJWT, updateAccountDetails)
router.route('/avatar-update').patch(verifyJWT,upload.single('avatar'),updateUserAvatar)
router.route('/coverImage-update').patch(verifyJWT,upload.single('coverImage'),updateUserCoverImage)
router.route('/c/:userName').get(getUserChannelProfile)
router.route('/watch-History').get(verifyJWT,getWatchHistory)
router.get("/suggestions", verifyJWT, suggestUsers)
router.get("/registered-users", verifyJWT, getRegisteredUsers);
router.delete("/delete-watchhistory", verifyJWT, deleteWatchHistory);
router.post('/forget-password', forgetPassword);
router.post('/reset-password', resetPassword);
router.delete('/delete-avatar', verifyJWT, deleteAvatar);
router.delete('/delete-coverImage', verifyJWT, deleteCoverImage);

export default router;

