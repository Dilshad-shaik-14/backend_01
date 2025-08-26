import { Comment } from "../models/comments.model.js";
import { Tweet } from "../models/tweet.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

// Toggle Like for a Comment
const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params; // commentId from route params

    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: User must be logged in to like or unlike a comment");
    }

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    // Check if the comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if the user has already liked the comment
    const existingLike = await Like.findOne({ comment: commentId, user: userId });

    if (existingLike) {
        // If already liked, remove the like
        await Like.findByIdAndDelete(existingLike._id);
        return res.status(200).json(new ApiResponse(200, {}, "Unliked comment successfully"));
    } else {
        // If not liked, add a new like
        const newLike = await Like.create({
            comment: commentId,
            user: userId
        });
        return res.status(200).json(new ApiResponse(200, { like: newLike }, "Comment liked successfully"));
    }
});

// Toggle Like for a Video
const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params; // videoId from route params

    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: User must be logged in to like or unlike a video");
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if the user has already liked the video
    const existingLike = await Like.findOne({ video: videoId, user: userId });

    if (existingLike) {
        // If already liked, remove the like
        await Like.findByIdAndDelete(existingLike._id);
        return res.status(200).json(new ApiResponse(200, {}, "Unliked video successfully"));
    } else {
        // If not liked, add a new like
        const newLike = await Like.create({
            video: videoId,
            user: userId
        });
        return res.status(200).json(new ApiResponse(200, { like: newLike }, "Video liked successfully"));
    }
});

// Toggle Like for a Tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized: User must be logged in to like or unlike a tweet");
  }

  if (!mongoose.isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  const existingLike = await Like.findOne({ tweet: tweetId, user: userId },{ unique: true });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
  } else {
    await Like.create({ tweet: tweetId, user: userId });
  }

  const updatedTweet = await Tweet.findById(tweetId)
    .populate("owner", "username avatar")
    .lean();

  const likes = await Like.find({ tweet: tweetId }).select("user -_id").lean();
  const likeCount = likes.length;
  const isLikedByUser = likes.some((like) => like.user.toString() === userId.toString());

  updatedTweet.likesCount = likeCount;
  updatedTweet.isLikedByCurrentUser = isLikedByUser;
  updatedTweet.likes = likes.map((like) => like.user); // ✅ Ensure this is returned

  return res
    .status(200)
    .json(new ApiResponse(200, { tweet: updatedTweet }, "Tweet like toggled"));
});


// Get All Liked Videos by a User
const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized: User must be logged in to view liked videos");
  }

  const likedVideos = await Like.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        video: { $exists: true, $ne: null }
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videoDetails"
      }
    },
    { $unwind: "$videoDetails" },

    // Populate video.owner
    {
      $lookup: {
        from: "users",
        localField: "videoDetails.owner",
        foreignField: "_id",
        as: "ownerDetails"
      }
    },
    {
      $addFields: {
        owner: { $arrayElemAt: ["$ownerDetails", 0] }
      }
    },

    // Count total likes for each video
    {
      $lookup: {
        from: "likes",
        localField: "videoDetails._id",
        foreignField: "video",
        as: "videoLikes"
      }
    },
    {
      $addFields: {
        totalLikes: { $size: "$videoLikes" }
      }
    },

    {
      $project: {
        _id: "$videoDetails._id",
        title: "$videoDetails.title",
        thumbnail: "$videoDetails.thumbnail",
        duration: "$videoDetails.duration",
        views: "$videoDetails.views",
        createdAt: "$videoDetails.createdAt",
        owner: {
          _id: "$owner._id",
          userName: "$owner.userName",
          fullName: "$owner.fullName",
          avatar: "$owner.avatar"
        },
        totalLikes: 1
      }
    },
    { $sort: { createdAt: -1 } }
  ]);

  return res.status(200).json(
    new ApiResponse(200, { videos: likedVideos }, "Liked videos fetched successfully")
  );
});


const getLikedTweets = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(401, "Unauthorized: Login required");

  const likedTweets = await Like.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        tweet: { $exists: true, $ne: null }
      }
    },
    {
      $lookup: {
        from: "tweets",
        localField: "tweet",
        foreignField: "_id",
        as: "tweetDetails"
      }
    },
    { $unwind: "$tweetDetails" },

    // Lookup owner details
    {
      $lookup: {
        from: "users",
        localField: "tweetDetails.owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          { $project: { userName: 1, fullName: 1, avatar: 1 } }
        ]
      }
    },
    {
      $addFields: {
        owner: { $arrayElemAt: ["$ownerDetails", 0] }
      }
    },

    // Count total likes for the tweet
    {
      $lookup: {
        from: "likes",
        localField: "tweetDetails._id",
        foreignField: "tweet",
        as: "tweetLikes"
      }
    },
    {
      $addFields: {
        totalLikes: { $size: "$tweetLikes" },
        isLiked: true
      }
    },

    {
      $project: {
        _id: "$tweetDetails._id",
        content: "$tweetDetails.content",
        createdAt: "$tweetDetails.createdAt",
        updatedAt: "$tweetDetails.updatedAt",
        owner: {
          _id: "$owner._id",
          userName: "$owner.userName",
          fullName: "$owner.fullName",
          avatar: "$owner.avatar"
        },
        isLiked: 1,
        totalLikes: 1
      }
    },
    { $sort: { createdAt: -1 } }
  ]);

  return res.status(200).json(
    new ApiResponse(200, { tweets: likedTweets }, "Liked tweets fetched successfully")
  );
});


const getLikedComments = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized: Login required");
  }

  const likedComments = await Like.aggregate([
    // Step 1: Match liked comments by this user
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        comment: { $ne: null }
      }
    },
    // Step 2: Join with comments collection
    {
      $lookup: {
        from: "comments",
        localField: "comment",
        foreignField: "_id",
        as: "commentDetails"
      }
    },
    { $unwind: "$commentDetails" },

    // Step 3: Join with users collection for comment owner
    {
      $lookup: {
        from: "users",
        localField: "commentDetails.owner", // Must be ObjectId
        foreignField: "_id",
        as: "owner"
      }
    },
    { $unwind: "$owner" }, // ⛔ STRICT: Excludes comments with missing owners

    // Step 4: Count total likes on each comment
    {
      $lookup: {
        from: "likes",
        localField: "commentDetails._id",
        foreignField: "comment",
        as: "likes"
      }
    },

    // Step 5: Shape the result
    {
      $addFields: {
        isLiked: true,
        totalLikes: { $size: "$likes" }
      }
    },
    {
      $project: {
        _id: "$commentDetails._id",
        content: "$commentDetails.content",
        video: "$commentDetails.video",
        createdAt: "$commentDetails.createdAt",
        updatedAt: "$commentDetails.updatedAt",
        owner: {
          userName: "$owner.userName",
          fullName: "$owner.fullName",
          avatar: "$owner.avatar"
        },
        isLiked: 1,
        totalLikes: 1
      }
    }
  ]);

  // Debug output — remove in production
 // console.log("Fetched Liked Comments:", JSON.stringify(likedComments, null, 2));

  return res.status(200).json(
    new ApiResponse(200, { comments: likedComments }, "Liked comments fetched successfully")
  );
});






export {
    toggleCommentLike,
    toggleVideoLike,
    toggleTweetLike,
    getLikedVideos,
    getLikedTweets,
    getLikedComments
};
