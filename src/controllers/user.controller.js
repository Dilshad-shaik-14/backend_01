import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import { mongoose } from 'mongoose';
import { Subscription } from "../models/subscription.model.js"; 
import { sendEmail } from "../utils/sendEmail.js";

export const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId).select("+refreshToken");
    if (!user) throw new ApiError(404, "User not found");

    const accessToken = user.generateAccessToken(); // keep payload minimal
    const refreshToken = user.generateRefreshToken();

    // Update refreshToken in DB
    await User.findByIdAndUpdate(
      userId,
      { refreshToken },
      { validateBeforeSave: false }
    );

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Token generation failed");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { userName, fullName, email, password } = req.body;

  if ([fullName, email, password, userName].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Please provide all details");
  }

  const existedUser = await User.findOne({
    $or: [{ userName }, { email }]
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  let coverImageLocalPath;
  if (req.files?.coverImage?.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase()
  });

  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, "User is not created");
  }

  // ✅ Generate tokens after registration
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax"
  };

  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: createdUser, accessToken, refreshToken },
        "User is created successfully"
      )
    );
});
//req.body,username or email,if user exists login or else register user,
// password check,access and refresh token generation,send cookies,response 

const loginUser = asyncHandler(async (req, res) => {
  console.log("📩 Incoming login request body:", req.body);

  const { userName, password, email } = req.body;

  if (!(userName || email)) {
    console.log("❌ Missing username or email");
    throw new ApiError(400, "Please provide username or email");
  }
  if (!password) {
    console.log("❌ Missing password");
    throw new ApiError(400, "Please provide password");
  }

  // Lookup user
  console.log("🔍 Looking up user...");
  const user = await User.findOne({ $or: [{ userName }, { email }] }).select("+password +refreshToken");
  console.log("👤 User lookup result:", user ? "Found" : "Not Found");

  if (!user) throw new ApiError(404, "User not found");

  // Validate password
  console.log("🔑 Checking password...");
  const isPasswordValid = await user.isPasswordCorrect(password);
  console.log("✅ Password valid?", isPasswordValid);

  if (!isPasswordValid) throw new ApiError(401, "Invalid credentials");

  // Generate tokens
  console.log("🔐 Generating tokens...");
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  // Fetch user without sensitive fields
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
  console.log("📦 Final user object prepared");

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  console.log("🍪 Setting cookies and sending response...");
  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully"));

  console.log("✅ Login flow completed successfully");
});


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: 1 } //removes the feild from the document
        },
        { new: true }
    )

    const options = {
        httpOnly: true,
        secure: true
    };

    return res.status(200)
        .cookie("accessToken", options)
        .cookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User is logged out successfully"));



});

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
        console.log("Body: ", req.body);

        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized access");
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Expired refresh token");
        }

        const options = {
            httpOnly: true,
            secure: true
        };

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token is refreshed successfully"));
    } catch (error) {
        throw new ApiError(401, error?.message || "Unauthorized refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if ([currentPassword, newPassword, confirmPassword].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "Please provide all details");
    }

    if (newPassword !== confirmPassword) {
        throw new ApiError(400, "Password and confirm password should be the same");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.password) {
        throw new ApiError(400, "Current password is not set");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Current password is incorrect");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password is changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("-password"); // exclude only password

    if (!user) {
        return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User details fetched successfully"));
});


const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All Fields are required");
    }

    // Check if email is taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: req.user?._id } });
    if (existingUser) {
        throw new ApiError(409, "Email is already in use by another account");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { fullName, email } },
        { new: true }
    ).select("-password");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details are updated successfully"));
});


const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading the avatar");
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: { avatar: avatar.url }
    },
        {
            new: true
        }).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "Avatar is updated successfully"));

}) // get user,check avatar,upload to cloudinary,update user,send response

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading the cover image");
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: { coverImage: coverImage.url }
    }, {
        new: true
    }).select("-password");

    return res.status(200).json(new ApiResponse(200, { user }, "Cover image is updated successfully"));
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { userName } = req.params;

  if (!userName?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

 const cleanUserName = userName.trim().startsWith("@")
    ? userName.trim().slice(1).toLowerCase()
    : userName.trim().toLowerCase();

  const channel = await User.aggregate([
    {
      $match: {
        userName: normalizedUserName
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $lookup: {
        from: "tweets",
        localField: "_id",
        foreignField: "owner",
        as: "tweets"
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos"
      }
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        subscribedToCount: { $size: "$subscribedTo" },
        tweetsCount: { $size: "$tweets" },
        videosCount: { $size: "$videos" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        subscribersCount: 1,
        subscribedToCount: 1,
        tweetsCount: 1,
        videosCount: 1,
        tweets: 1,
        videos: 1,
        fullName: 1,
        userName: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        createdAt: 1
      }
    }
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel details fetched successfully"));
});



const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(req.user._id) }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users", // owner field points to User
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner"
                        }
                    },
                    {
                        $addFields: {
                            owner: { $arrayElemAt: ["$owner", 0] } // only return 1 owner object
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            thumbnail: 1,
                            duration: 1,
                            views: 1,
                            createdAt: 1,
                            owner: {
                                fullName: 1,
                                userName: 1,
                                avatar: 1
                            }
                        }
                    }
                ]
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            user[0]?.watchHistory || [],
            "Watch history fetched successfully"
        )
    );
});

const deleteWatchHistory = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { watchHistory: [] } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, {}, "Watch history deleted successfully")
    );
});


const suggestUsers = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;

    // Find all user IDs the current user is subscribed to
    const subscriptions = await Subscription.find({ subscriber: currentUserId }).select("channel");
    const subscribedChannelIds = subscriptions.map(sub => sub.channel);

    // Add current user's own ID to the exclusion list
    subscribedChannelIds.push(currentUserId);

    // Suggest users not in the subscribed list and not the current user
    const suggestions = await User.find({
        _id: { $nin: subscribedChannelIds }
    }).select("fullName userName email avatar coverImage createdAt");


    return res.status(200).json(
        new ApiResponse(200, suggestions, "Suggested users fetched successfully")
    );
});

const getRegisteredUsers = asyncHandler(async (req, res) => {
    const users = await User.find({})
        .select("fullName userName email avatar createdAt"); // Add/remove fields as needed

    return res.status(200).json(
        new ApiResponse(200, users, "Registered users fetched successfully")
    );
});

const forgetPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const resetToken = jwt.sign(
    { id: user._id },
    process.env.RESET_PASSWORD_SECRET,
    { expiresIn: "15m" }
  );

  const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
  // Optional for production: use process.env.CLIENT_URL instead

  await sendEmail(
    user.email,
    "Reset Your Password",
    `
    <p>Hello ${user.fullName || "User"},</p>
    <p>Click here to reset your password:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>This link is valid for 15 minutes.</p>
    `
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset email sent"));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    throw new ApiError(400, "All fields are required");
  }

  if (password !== confirmPassword) {
    throw new ApiError(400, "Passwords do not match");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(400, "Reset token has expired. Please try again.");
    }
    throw new ApiError(400, "Invalid or malformed token");
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = password;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

const deleteAvatar = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { avatar: 1 } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar deleted successfully"));
});

const deleteCoverImage = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { coverImage: 1 } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image deleted successfully"));
});



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
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
    deleteAvatar,
    deleteCoverImage,
    resetPassword

};