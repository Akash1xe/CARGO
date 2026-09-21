const { BadRequestError, UnauthorizedError } = require("../utils/error");
const asyncHandler = require('../utils/asyncHandler');
const {config} = require('../config');
const authService = require('../services/auth.service');
const getDeviceFingerprint = require("../utils/deviceFingerPrint");

const isProd = process.env.NODE_ENV === 'production';

const cookieOptions = (maxAge) => ({
     httpOnly: true,
     secure: isProd,
     sameSite: isProd ? 'strict' : 'lax',
     path: '/',
     maxAge,
});

const clearCookieOptions = () => {
     const { maxAge: _maxAge, ...options } = cookieOptions(0);
     return options;
};

exports.sendOTP = asyncHandler(async(req, res) =>{
     const {firstName, lastName, email, password, confirmPassword, accountType = 'CUSTOMER'} = req.body;
     if(!firstName || !lastName || !email || !password || !confirmPassword){
          throw new BadRequestError("All fields are mandatory");
     }

     if(password !== confirmPassword){
          throw new BadRequestError("Password mismatch");
     }

     if(!['CUSTOMER', 'ADMIN'].includes(accountType)){
          throw new BadRequestError("Invalid account type");
     }

     if(accountType === 'ADMIN' && !config.ALLOW_DEMO_ADMIN_SIGNUP){
          throw new BadRequestError("Administrator self-registration is disabled");
     }

     const {otpSessionId} = await authService.sendOTP(firstName, lastName, email, password, accountType);
     res.cookie("otp_session", otpSessionId, cookieOptions(config.OTP_TTL * 1000)).status(200).json({
          success: true,
          message: "OTP sent successfully"
     })
})

exports.verifyOTP = asyncHandler(async(req, res) =>{
     const {otp} = req.body;
     const otpSessionId = req.cookies.otp_session;

     if(!otp || !otpSessionId){
          throw new BadRequestError("OTP or OTPSession is missing")
     }

     const user = await authService.verifyOTP(otp, otpSessionId);
     res.clearCookie("otp_session", clearCookieOptions());
     return res.status(201).json({
          success: true,
          message: "User Account created successfully",
          data: user
     })
})


exports.login = asyncHandler(async(req, res) =>{
     const {email, password} = req.body;
     if(!email || !password){
          throw new BadRequestError("Email and Password are required")
     }
     const deviceId = getDeviceFingerprint(req);
     const {accessToken, refreshToken, loggedInUser} = await authService.login(email, password, deviceId);
     res.cookie("accessToken", accessToken, cookieOptions(config.ACCESS_TOKEN_EXP_SEC * 1000))
     res.cookie("refreshToken", refreshToken, cookieOptions(config.REFRESH_TOKEN_EXP_SEC * 1000))
     .status(200).json({
          success: true,
          message: "Logged in successfully",
          loggedInUser
     })
})

exports.rotateRefreshToken = asyncHandler(async(req, res) =>{
     const refreshToken = req.cookies.refreshToken;
     if(!refreshToken){
          throw new UnauthorizedError("Refresh token is missing", "LOGIN AGAIN")
     }
     const deviceId = getDeviceFingerprint(req);
     const {newAccessToken, newRefreshToken} = await authService.rotateRefreshToken(refreshToken, deviceId);
     res.cookie("accessToken", newAccessToken, cookieOptions(config.ACCESS_TOKEN_EXP_SEC * 1000))
     res.cookie("refreshToken", newRefreshToken, cookieOptions(config.REFRESH_TOKEN_EXP_SEC * 1000))
     .status(200).json({
          success: true,
          message: "Access and Refresh token reissued"
     })
})


exports.verifyGoogleIdToken = asyncHandler(async(req, res) =>{
     const {idToken} = req.body;
     if(!idToken){
          throw new BadRequestError("Invalid Google ID Token", "INVALID TOKEN")
     }

     const deviceId = getDeviceFingerprint(req);

     const {accessToken, refreshToken, loggedInUser} = await authService.verifyGoogleIdToken(idToken, deviceId);

     res.cookie("accessToken", accessToken, cookieOptions(config.ACCESS_TOKEN_EXP_SEC * 1000))
     res.cookie("refreshToken", refreshToken, cookieOptions(config.REFRESH_TOKEN_EXP_SEC * 1000))
     .status(200).json({
          success: true,
          message: "Logged in successfully",
          loggedInUser
     })
})

exports.logout = asyncHandler(async(req, res) => {
     const deviceId = getDeviceFingerprint(req);
     await authService.logout(req.user?.id, deviceId);
     res.clearCookie('accessToken', clearCookieOptions());
     res.clearCookie('refreshToken', clearCookieOptions());
     return res.status(200).json({ success: true, message: 'Logged out successfully' });
});
