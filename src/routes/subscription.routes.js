import { Router } from 'express';
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT);

router.route("/toggle/:channelId").post(toggleSubscription);

router.route("/channel/:channelId/subscribers").get(getUserChannelSubscribers);

router.route("/user/:subscriberId/channels").get(getSubscribedChannels);

export default router;