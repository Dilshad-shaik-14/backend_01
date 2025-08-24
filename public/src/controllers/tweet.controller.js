import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Validate user existence
const validateUser = async (userId) => {
  if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid user ID");

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  return user;
};

// Common tweet aggregation pipeline
const buildTweetAggregation = (matchCondition, currentUserId, skip = 0, limit = 10) => [
  { $match: matchCondition },
  {
    $lookup: {
      from: "users",
      localField: "owner",
      foreignField: "_id",
      as: "owner",
      pipeline: [{ $project: { userName: 1, fullName: 1, avatar: 1 } }]
    }
  },
  {
    $lookup: {
      from: "likes",
      localField: "_id",
      foreignField: "tweetId",
      as: "likes"
    }
  },
  {
    $lookup: {
      from: "comments",
      localField: "_id",
      foreignField: "tweetId",
      as: "comments"
    }
  },
  {
    $addFields: {
      owner: { $arrayElemAt: ["$owner", 0] },
      totalLikes: { $size: "$likes" },
      totalComments: { $size: "$comments" },
      isLiked: {
        $anyElementTrue: {
          $map: {
            input: "$likes",
            as: "like",
            in: { $eq: ["$$like.userId", currentUserId] }
          }
        }
      }
    }
  },
  {
    $project: {
      content: 1,
      createdAt: 1,
      updatedAt: 1,
      owner: 1,
      totalLikes: 1,
      totalComments: 1,
      isLiked: 1
    }
  },
  { $skip: skip },
  { $limit: limit }
];

// Create a tweet
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  await validateUser(req.user._id);

  if (!content || content.trim() === "") throw new ApiError(400, "Tweet content cannot be empty");

  const tweetData = await Tweet.create({ content, owner: req.user._id });

  if (!tweetData) throw new ApiError(500, "Error while creating tweet");

  await tweetData.populate("owner", "userName fullName avatar");

  return res.status(201).json(new ApiResponse(201, { tweet: tweetData }, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  await validateUser(userId);

  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              userName: 1,
              avatar: 1,
              fullName: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerDetails", // ✅ fixed here
    },
    {
      $lookup: {
        from: "likes",
        let: { tweetId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$tweet", "$$tweetId"] },
            },
          },
        ],
        as: "likesInfo",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likesInfo" },
        isLikedByCurrentUser: {
          $in: [
            new mongoose.Types.ObjectId(currentUserId),
            {
              $map: {
                input: "$likesInfo",
                as: "like",
                in: "$$like.user",
              },
            },
          ],
        },
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        likesCount: 1,
        isLikedByCurrentUser: 1,
        owner: {
          _id: "$ownerDetails._id",
          userName: "$ownerDetails.userName",
          avatar: "$ownerDetails.avatar",
          fullName: "$ownerDetails.fullName",
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, { tweets }, "Fetched user tweets"));
});

// Update a tweet
const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  await validateUser(req.user._id);

  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet ID");
  if (!content || content.trim() === "") throw new ApiError(400, "Tweet content cannot be empty");

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) throw new ApiError(404, "Tweet not found");

  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Forbidden: You can't update this tweet");
  }

  tweet.content = content;
  await tweet.save();

  return res.status(200).json(new ApiResponse(200, { tweet }, "Tweet updated successfully"));
});

// Delete a tweet
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  await validateUser(req.user._id);

  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet ID");

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) throw new ApiError(404, "Tweet not found");

  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Forbidden: You can't delete this tweet");
  }

  await tweet.deleteOne();

  return res.status(200).json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

const getAllTweets = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const currentUserId = new mongoose.Types.ObjectId(req.user._id);

  const tweets = await Tweet.aggregate([
    {
      $sort: { createdAt: -1 }
    },
    {
      $skip: skip
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              userName: 1,
              fullName: 1,
              avatar: 1
            }
          }
        ]
      }
    },
    {
      $unwind: "$ownerDetails"
    },
    {
      $lookup: {
        from: "likes",
        let: { tweetId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$tweet", "$$tweetId"] }
            }
          }
        ],
        as: "likesInfo"
      }
    },
    {
      $addFields: {
        likesCount: { $size: "$likesInfo" },
        isLikedByCurrentUser: {
          $in: [
            currentUserId,
            {
              $map: {
                input: "$likesInfo",
                as: "like",
                in: "$$like.user"
              }
            }
          ]
        }
      }
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        likesCount: 1,
        isLikedByCurrentUser: 1,
        owner: {
          _id: "$ownerDetails._id",
          userName: "$ownerDetails.userName",
          avatar: "$ownerDetails.avatar",
          fullName: "$ownerDetails.fullName"
        }
      }
    }
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, { tweets }, "All tweets fetched successfully"));
});



export {
  createTweet,
  getUserTweets,
  updateTweet,
  deleteTweet,
  getAllTweets
};
