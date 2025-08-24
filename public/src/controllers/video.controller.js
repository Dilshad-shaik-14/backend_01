import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Comment } from "../models/comments.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFileByUrl } from "../utils/cloudinary.js";


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = 'createdAt', sortType = 'desc', userId } = req.query;

    const match = { isPublished: true };

    if (query) {
        match.title = { $regex: query, $options: 'i' };
    }

    if (userId) {
        const user = await User.findOne({ userName: userId.toLowerCase() });
        if (!user) return res.status(200).json(new ApiResponse(200, {}, "No videos available"));
        match.owner = user._id;
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;
    const sort = { [sortBy]: sortType === 'asc' ? 1 : -1 };

    const totalDocuments = await Video.countDocuments(match);
    const videos = await Video.find(match)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .select('thumbnail title duration views createdAt');

    if (videos.length === 0) {
        return res.status(200).json(new ApiResponse(200, {
            videos: [],
            pagination: {
                totalDocuments: 0,
                totalPages: 0,
                currentPage: pageNumber
            }
        }, "No videos available"));
    }

    res.status(200).json(new ApiResponse(200, {
        videos,
        pagination: {
            totalDocuments,
            totalPages: Math.ceil(totalDocuments / limitNumber),
            currentPage: pageNumber
        }
    }, "Videos fetched successfully"));
});

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description, isPublished = true } = req.body;

  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "Unauthorized user");
  }

  const owner = req.user._id;

  const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoFileLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "Video and thumbnail files are required");
  }

  // Upload files to Cloudinary
  const videoFile = await uploadOnCloudinary(videoFileLocalPath, "video");
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile || !thumbnail) {
    throw new ApiError(500, "Error while uploading files to Cloudinary");
  }

  if (!videoFile.duration) {
    throw new ApiError(400, "Video duration is required but missing");
  }

  const uploadedVideo = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    description,
    title,
    duration: videoFile.duration,
    owner,
    isPublished,
  });

  res.status(201).json(new ApiResponse(201, uploadedVideo, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const videoExists = await Video.findById(videoId);
  if (!videoExists) {
    throw new ApiError(404, "Video not found");
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let watchHistory = user.watchHistory || [];
  watchHistory = [videoId, ...new Set(watchHistory)].slice(0, 10);
  await User.findByIdAndUpdate(req.user._id, { $set: { watchHistory } });

  await Video.findByIdAndUpdate(videoId, { $inc: { views: 0.5 } });

  const [totalComments, totalLikes, isLiked] = await Promise.all([
    Comment.countDocuments({ video: videoId }),
    Like.countDocuments({ video: videoId }),
    Like.exists({ user: user._id, video: videoId }),
  ]);

  const videoDetails = await Video.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { userName: 1, avatar: 1, fullName: 1 } }],
      },
    },
    {
      $addFields: {
        owner: { $arrayElemAt: ["$owner", 0] },
      },
    },
  ]);

  if (!videoDetails.length) {
    throw new ApiError(404, "Video details not found");
  }

  const video = videoDetails[0];
  video.watchHistory = watchHistory;
  video.totalLikes = totalLikes;
  video.totalComments = totalComments;
  video.isLiked = !!isLiked;

  res.status(200).json(
    new ApiResponse(200, video, "Video fetched successfully")
  );
});


const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  // Validate ID
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // ✅ Handle thumbnail replacement
  if (req.files?.thumbnail?.[0]) {
    // delete old thumbnail if exists
    if (video.thumbnail) {
      await deleteFileByUrl(video.thumbnail, "image");
    }

    const thumbUpload = await uploadOnCloudinary(
      req.files.thumbnail[0].path,
      "image"
    );
    if (!thumbUpload?.url) {
      throw new ApiError(500, "Thumbnail upload failed");
    }
    video.thumbnail = thumbUpload.url;
  }

  // ✅ Handle video replacement
  if (req.files?.videoFile?.[0]) {
    // delete old video if exists
    if (video.videoFile) {
      await deleteFileByUrl(video.videoFile, "video");
    }

    const videoUpload = await uploadOnCloudinary(
      req.files.videoFile[0].path,
      "video"
    );
    if (!videoUpload?.url) {
      throw new ApiError(500, "Video upload failed");
    }

    video.videoFile = videoUpload.url;
    if (videoUpload.duration) {
      video.duration = videoUpload.duration;
    }
  }

  // ✅ Update text fields
  if (title?.trim()) video.title = title.trim();
  if (description?.trim()) video.description = description.trim();

  const updatedVideo = await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo.toObject(), "Video updated successfully")
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

    // Find the video document
    const video = await Video.findById(videoId);
    console.log("Video:", video); // Debugging log
    if (!video) throw new ApiError(404, "Video not found");

    // Delete related data
    await Comment.deleteMany({ video: videoId });
    await Like.updateMany({ video: videoId }, { $set: { video: null } });
    await Playlist.updateMany({ videos: videoId }, { $pull: { videos: videoId } });
    await User.updateMany({ watchHistory: videoId }, { $pull: { watchHistory: videoId } });

    // Delete associated files
    await deleteFileByUrl(video.videoFile, "video");
    await deleteFileByUrl(video.thumbnail, "image");

    // Delete the video document
    await video.deleteOne(); // Correctly delete the document instance

    res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");

    if (video.owner.toString() !== req.user._id.toString()) throw new ApiError(403, "Unauthorized");

    video.isPublished = !video.isPublished;
    await video.save();

    res.status(200).json(new ApiResponse(200, video.isPublished, "Publish status updated successfully"));
});

const getVideoDetails = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId).populate("owner", "_id userName");
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner?._id.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized access to video details");
    }

    res.status(200).json(new ApiResponse(200, video, "Video details fetched successfully"));
});

const getVideoByTitle = asyncHandler(async (req, res) => {
  const { title } = req.params;

  if (!title?.trim()) {
    throw new ApiError(400, "Invalid video title");
  }

  // First, try to find videos whose title starts with the search term
  let videos = await Video.find({
    title: { $regex: `^${title.trim()}`, $options: "i" },
  });

  // Fallback: if no starts-with match, search anywhere in the title
  if (!videos.length) {
    videos = await Video.find({
      title: { $regex: title.trim(), $options: "i" },
    });
  }

  if (!videos.length) {
    throw new ApiError(404, "No videos found");
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Update watch history (limit 10) using the first matched video
  let watchHistory = user.watchHistory || [];
  watchHistory = [videos[0]._id.toString(), ...new Set(watchHistory)].slice(0, 10);
  await User.findByIdAndUpdate(req.user._id, { $set: { watchHistory } });

  // Aggregate details for each video
  const videoDetails = await Promise.all(
    videos.map(async (video) => {
      await Video.findByIdAndUpdate(video._id, { $inc: { views: 0.5 } });

      const [totalComments, totalLikes, isLiked] = await Promise.all([
        Comment.countDocuments({ video: video._id }),
        Like.countDocuments({ video: video._id }),
        Like.exists({ user: user._id, video: video._id }),
      ]);

      const ownerInfo = await User.findById(video.owner, {
        userName: 1,
        avatar: 1,
        fullName: 1,
      });

      return {
        ...video.toObject(),
        watchHistory,
        totalComments,
        totalLikes,
        isLiked: !!isLiked,
        owner: ownerInfo,
      };
    })
  );

  res
    .status(200)
    .json(new ApiResponse(200, videoDetails, "Videos fetched successfully by title"));
});



export {
    getAllVideos,
    publishVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    getVideoDetails,
    getVideoByTitle
};