const asyncHandler = require("../utils/asyncHandler");
const { BadRequestError, NotFoundError } = require("../utils/error");
const userService = require('../services/user.service');
const logger = require("../config/logger");

const clearCookieOptions = {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',
     sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
     path: '/',
};


exports.getProfile = asyncHandler(async(req, res) =>{
     const userId = req.user.id;
     if(!userId){
          throw new BadRequestError("User Id is missing");
     }

     const user = await userService.getProfile(userId);
     return res.status(200).json({
          success: true,
          message: "Fetched user details",
          data: {
               user
          }
     })
})

exports.updateProfile = asyncHandler(async(req, res) =>{
     const user = await userService.updateProfile(req.user.id, req.body || {});
     return res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user } });
})

exports.deleteProfile = asyncHandler(async(req, res) =>{
     await userService.deleteProfile(req.user.id);
     res.clearCookie('accessToken', clearCookieOptions);
     res.clearCookie('refreshToken', clearCookieOptions);
     return res.status(200).json({ success: true, message: 'Profile deleted successfully' });
})

exports.getUserInternal = asyncHandler(async(req, res) =>{
     const { userId } = req.params;
     if(!userId){
          throw new BadRequestError("User Id is missing");
     }

     const user = await userService.getProfile(userId);
     if(!user){
          throw new NotFoundError("User not found");
     }

     return res.status(200).json({
          success: true,
          data: {
               id: user.id,
               firstName: user.firstName,
               lastName: user.lastName,
               email: user.email,
               emailVerified: user.emailVerified,
               role: user.role,
          }
     });
})
