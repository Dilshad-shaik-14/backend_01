import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    // Ensure the user is logged in
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: User must be logged in to toggle subscription");
    }

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid Channel ID");
    }

    const subscription = await Subscription.findOne({ channel: channelId, subscriber: req.user._id });

   if (subscription) {
  // Unsubscribe
  await Subscription.findByIdAndDelete(subscription._id);
  return res.status(200).json(new ApiResponse(200, { isSubscribed: false }, "Unsubscribed from channel successfully"));
} else {
  // Subscribe
  const newSubscription = await Subscription.create({
    channel: channelId,
    subscriber: req.user._id,
    isSubscribed: true,
  });
  return res.status(200).json(new ApiResponse(200, { isSubscribed: true }, "Subscribed to channel successfully"));
}

});

// Controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const channelId = req.params.channelId;

  const subscribers = await Subscription.aggregate([
    { $match: { channel: new mongoose.Types.ObjectId(channelId), isSubscribed: true } },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
      },
    },
    { $unwind: "$subscriber" },
    {
      $project: {
        _id: 1,
        subscriber: {
          _id: "$subscriber._id",
          fullName: "$subscriber.fullName",
          userName: "$subscriber.userName",
          avatar: "$subscriber.avatar",
          coverImage: "$subscriber.coverImage",
          email: "$subscriber.email",
          createdAt: "$subscriber.createdAt",
        },
        isSubscribed: { $literal: true }
      }
    }
  ]);

  res.status(200).json(
    new ApiResponse(200, subscribers, "Subscribers fetched successfully")
  );
});


const getSubscribedChannels = asyncHandler(async (req, res) => {
  const subscriberId = req.params.subscriberId;

  const subscriptions = await Subscription.aggregate([
    { $match: { subscriber: new mongoose.Types.ObjectId(subscriberId), isSubscribed: true } },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
      },
    },
    { $unwind: "$channel" },
    {
      $project: {
        _id: 1,
        channel: {
          _id: "$channel._id",
          fullName: "$channel.fullName",
          userName: "$channel.userName",
          avatar: "$channel.avatar",
          coverImage: "$channel.coverImage",
          email: "$channel.email",
          createdAt: "$channel.createdAt",
        },
        isSubscribed: { $literal: true }
      }
    }
  ]);

  res.status(200).json(
    new ApiResponse(200, subscriptions, "Subscribed channels fetched successfully")
  );
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
};