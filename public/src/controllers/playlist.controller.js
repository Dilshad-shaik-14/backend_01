import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary} from "../utils/cloudinary.js";

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const userPlaylists = await Playlist.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    { $skip: skip },
    { $limit: parseInt(limit) },

    // Lookup owner details
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [{ $project: { userName: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$ownerDetails" },

    // Lookup video details
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },

    // Project video fields that exist
    {
      $project: {
        name: 1,
        description: 1,
        coverImage: 1,
        videos: {
          $map: {
            input: "$videos",
            as: "video",
            in: {
              _id: "$$video._id",
              title: "$$video.title",
              description: "$$video.description",
              thumbnail: "$$video.thumbnail",
              duration: "$$video.duration",
              channelName: "$$video.channelName",
            },
          },
        },
        owner: "$ownerDetails",
      },
    },
  ]);

  if (userPlaylists.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No playlists found for this user"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { playlists: userPlaylists },
        "User playlists fetched successfully"
      )
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  const playlist = await Playlist.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },

    // Owner details
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [{ $project: { userName: 1, avatar: 1 } }],
      },
    },
    { $unwind: { path: "$ownerDetails", preserveNullAndEmptyArrays: true } },

    // Video details
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videosDetails",
      },
    },

    // Project video fields that exist
    {
      $project: {
        name: 1,
        description: 1,
        coverImage: 1,
        videos: {
          $map: {
            input: "$videosDetails",
            as: "video",
            in: {
              _id: "$$video._id",
              title: "$$video.title",
              description: "$$video.description",
              thumbnail: "$$video.thumbnail",
              duration: "$$video.duration",
              channelName: "$$video.channelName",
            },
          },
        },
        owner: "$ownerDetails",
      },
    },
    { $limit: 1 },
  ]);

  if (!playlist || playlist.length === 0) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { playlist: playlist[0] },
        "Playlist fetched successfully"
      )
    );
});


const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not Found");
    }


    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Playlist ID or Video ID");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (!playlist.videos.includes(videoId)) {
        playlist.videos.push(videoId);
        await playlist.save();
    }

    return res.status(200).json(new ApiResponse(200, { playlist }, "Video added to the playlist successfully"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const owner = req.user?._id;

  if (
    !mongoose.Types.ObjectId.isValid(playlistId) ||
    !mongoose.Types.ObjectId.isValid(videoId)
  ) {
    throw new ApiError(400, "Invalid playlist or video ID");
  }

  const playlist = await Playlist.findOne({ _id: playlistId, owner });

  if (!playlist) {
    throw new ApiError(403, "Playlist not found or access denied");
  }

  // ✅ Use ObjectId when pulling
const updatedPlaylist = await Playlist.findByIdAndUpdate(
  playlistId,
  { $pull: { videos: new mongoose.Types.ObjectId(videoId) } },
  { new: true }
).populate("videos", "_id title thumbnail");


  return res
    .status(200)
    .json(new ApiResponse(200, updatedPlaylist, "✅ Video removed from playlist"));
});



const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const owner = req.user._id;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) throw new ApiError(400, "Playlist not found");

    if (owner.toString() != playlist.owner.toString()) {
        throw new ApiError(400, "Unauthorized user");
    }

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

    if (!deletedPlaylist) throw new ApiError(400, "Playlist not found");

    return res.status(200).json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description, videos } = req.body;

  if (!name) throw new ApiError(400, "Playlist name is required");

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");

  if (videos && !Array.isArray(videos)) {
    throw new ApiError(400, "Videos must be an array");
  }

  const existingPlaylist = await Playlist.findOne({ name, owner: req.user._id });
  if (existingPlaylist) {
    throw new ApiError(400, "A playlist with the same name already exists");
  }

  let coverImageUrl = "";
  if (req.files?.coverImage?.[0]?.path) {
    const uploadedImage = await uploadOnCloudinary(req.files.coverImage[0].path);
    if (!uploadedImage?.url) throw new ApiError(500, "Cover image upload failed");
    coverImageUrl = uploadedImage.url;
  }

  const playlistData = await Playlist.create({
    name,
    description,
    videos: videos || [],
    owner: req.user._id,
    coverImage: coverImageUrl,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { playlist: playlistData }, "Playlist created successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!mongoose.isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");

  playlist.name = name || playlist.name;
  playlist.description = description || playlist.description;

  if (req.files?.coverImage?.[0]?.path) {
    const uploadedImage = await uploadOnCloudinary(req.files.coverImage[0].path);
    if (!uploadedImage?.url) throw new ApiError(500, "Cover image upload failed");
    playlist.coverImage = uploadedImage.url;
  }

  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { playlist }, "Playlist updated successfully"));
});


export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
};