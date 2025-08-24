import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comments.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// function to validate user existence
const validateUser = async (userId) => {
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    return user;
};

// function to validate video existence
const validateVideo = async (videoId) => {
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }
    return video;
};

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const comments = await Comment.aggregate([
    { $match: { video: new mongoose.Types.ObjectId(videoId) } },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes"
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "userDetails",
        pipeline: [{ $project: { userName: 1, avatar: 1 } }]
      }
    },
    { $unwind: "$userDetails" },
    {
      $addFields: {
        totalLikes: { $size: "$likes" }
      }
    },
    { $skip: (page - 1) * parseInt(limit) },
    { $limit: parseInt(limit) },
    {
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        user: "$userDetails",
        totalLikes: 1
      }
    }
  ]);

  // ✅ Always return the result, even if empty
  return res.status(200).json(
    new ApiResponse(200, { comments }, "Comments fetched successfully")
  );
});


const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    //console.log("Received videoId:", videoId); // Debugging line

    await validateUser(req.user._id);

    await validateVideo(videoId);

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Comment content cannot be empty");
    }

   
const newComment = await Comment.create({
    video: videoId,
    owner: req.user._id,
    content
});


    return res.status(201).json(new ApiResponse(201, { comment: newComment }, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    await validateUser(req.user._id);

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Comment content cannot be empty");
    }

    const updatedComment = await Comment.findOneAndUpdate(
        { _id: commentId, owner: req.user._id }, 
        { content },
        { new: true }
    );

    if (!updatedComment) {
        throw new ApiError(404, "Comment not found or you do not have permission to update this comment");
    }

    return res.status(200).json(new ApiResponse(200, { comment: updatedComment }, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    await validateUser(req.user._id);

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    const deletedComment = await Comment.findOneAndDelete({
        _id: commentId,
        owner: req.user._id 
    });

    if (!deletedComment) {
        throw new ApiError(404, "Comment not found or you do not have permission to delete this comment");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
};