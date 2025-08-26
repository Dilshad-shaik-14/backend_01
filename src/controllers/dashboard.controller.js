import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get channel stats
const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.params.channelId;

    // Validate user authentication
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: User must be logged in to get channel stats");
    }

    // Validate channel ID
    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    // Check if the channel exists
    const channelExists = await Subscription.findOne({ channel: channelId });
    if (!channelExists) {
        throw new ApiError(404, "Channel not found");
    }

    // Fetch total views
    const totalViewsResult = await Video.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(channelId) } },
        { $group: { _id: null, totalViews: { $sum: "$views" } } }
    ]);
    const totalViews = totalViewsResult[0]?.totalViews || 0;

    // Fetch total likes
    const totalLikesResult = await Like.aggregate([
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videoDetails"
            }
        },
        { $unwind: "$videoDetails" },
        { $match: { "videoDetails.owner": new mongoose.Types.ObjectId(channelId) } },
        { $group: { _id: null, totalLikes: { $sum: 1 } } }
    ]);
    const totalLikes = totalLikesResult[0]?.totalLikes || 0;

    // Fetch total subscribers
    const totalSubscribers = await Subscription.countDocuments({ channel: channelId });

    // Fetch total videos
    const totalVideos = await Video.countDocuments({ owner: channelId });

    // Return the stats
    return res.status(200).json(
        new ApiResponse(200, {
            totalViews,
            totalLikes,
            totalSubscribers,
            totalVideos
        }, "Channel stats fetched successfully")
    );
});

 const getChannelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  // Ensure the user making the request is the channel owner
  if (req.user._id.toString() !== channelId) {
    throw new ApiError(403, "Unauthorized access");
  }

  const videos = await Video.find({ owner: channelId }).sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(200, { videos }, "Channel videos fetched successfully")
  );
});


export {
    getChannelStats,
    getChannelVideos
};
