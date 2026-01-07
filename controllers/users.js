import { ADMIN, FACILITATOR, GROUP_LEAD } from '../helpers/constants.js';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import jwt from 'jsonwebtoken';

// Login for non-admin users (if an admin logs in using this method, redirect to admin home on frontend)
export const login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ msg: 'User not found.' });
    if (user.role === ADMIN) return res.status(401).json({ msg: 'User is an admin.', admin: true });

    // The "await" is necessary, it is a promise. Don't listen to the typescript note.
    const isMatch = await bcrypt.compare(req.body.password, user.hashedPassword);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Could not log in with the provided credentials' });
    }

    const payload = {
      id: user._id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    return res.status(200).json({ success: true, msg: 'Successfully logged in!', token });
  } catch (e) {
    const msg = 'An error occurred while logging in';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Login for admins specifically
export const adminLogin = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ msg: 'User not found.' });
    if (user.role !== ADMIN)
      return res.status(401).json({ msg: 'User is not an admin.', presenter: true });

    // The "await" is necessary, it is a promise. Don't listen to the typescript note.
    const isMatch = await bcrypt.compare(req.body.password, user.hashedPassword);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Could not log in with the provided credentials' });
    }

    const payload = {
      id: user._id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    return res.status(200).json({ success: true, msg: 'Successfully logged in!', token });
  } catch (e) {
    const msg = 'An error occurred while logging in';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const createAccount = async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10); // Generate a salt with a cost factor (e.g., 10)
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({
        msg: 'An account already exists for the provided email',
      });
    }

    const newUser = new User({
      email: req.body.email,
      hashedPassword,
      role: req.body.accountType === FACILITATOR ? FACILITATOR : GROUP_LEAD,
      firstName: req.body.firstName || null,
      lastName: req.body.lastName || null,
      organization: req.body.organization || null,
    });

    await newUser.save();

    const payload = {
      id: newUser._id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    return res.status(200).json({ token });
  } catch (e) {
    const msg = 'An error occurred while creating account';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Generate a token for a reset password email
export const getResetPasswordToken = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({
        msg: "Couldn't find an existing account with that email.",
      });
    }

    const payload = {
      id: user._id,
      type: 'password-reset',
    };

    // Have the token expire in one hour
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    return res.status(200).json({ token, role: user.role });
  } catch (e) {
    const msg = 'An error occurred while generating reset password token';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Complete password reset
export const resetPassword = async (req, res) => {
  try {
    let decodedToken = null;
    try {
      decodedToken = jwt.verify(req.body.resetToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(500).json({
        msg: 'Token is invalid',
      });
    }
    const user = await User.findOne({ _id: decodedToken.id });
    if (!user || decodedToken.type !== 'password-reset') {
      return res.status(400).json({
        msg: 'Token is invalid',
      });
    }

    // Reset user's password to new password
    const salt = await bcrypt.genSalt(10); // Generate a salt with a cost factor (e.g., 10)
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    user.hashedPassword = hashedPassword;

    await user.save();

    // Return user role for correct routing to login
    return res.status(200).json({
      role: user.role,
    });
  } catch (e) {
    const msg = 'An error occurred while generating reset password token';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Validate that user is logged in
export const checkAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decodedToken.id });
    req.user = user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Could not find user for given token',
      });
    }
    return next();
  } catch (e) {
    const msg = 'An error occurred while checking authentication';
    console.error(msg, e);
    return res.status(401).json({ msg });
  }
};

// Validate that user is an admin
export const checkAdminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decodedToken.id });
    req.user = user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Could not find user for given token',
      });
    }
    if (user.role !== ADMIN) {
      res.status(401).json({
        success: false,
        message: 'User is not an admin',
      });
    }
    return next();
  } catch (e) {
    const msg = 'An error occurred while checking admin authentication';
    console.error(msg, e);
    return res.status(401).json({ msg });
  }
};

export const accountInfo = (req, res) => {
  const { email, role, firstName, lastName, organization } = req.user;
  return res.status(200).json({ email, role, firstName, lastName, organization });
};

// Fetch all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-hashedPassword');
    return res.status(200).json({ users });
  } catch (e) {
    const msg = 'An error occurred while fetching users';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.query.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Could not find associated user',
      });
    }
    return res.status(200).json({ user });
  } catch (e) {
    const msg = 'An error occurred while fetching user';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);
    const role = req.body.role;

    if (!user) {
      return res.status(404).json({
        msg: "Couldn't find a matching user",
      });
    }

    if (role === ADMIN || role === GROUP_LEAD || role === FACILITATOR) {
      user.role = role;
    }

    await user.save();
    return res.status(200).json({
      user,
    });
  } catch (e) {
    const msg = 'An error occurred while updating user';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const deletedUser = await User.deleteOne({ _id: req.user._id });
    return res.status(200).json({
      user: deletedUser,
    });
  } catch (e) {
    const msg = 'An error occurred while deleting account';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.deleteOne({ _id: req.body.userId });
    return res.status(200).json({
      user: deletedUser,
    });
  } catch (e) {
    const msg = 'An error occurred while deleting user';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const upgradeAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        msg: "Couldn't find a matching user",
      });
    }

    user.role = ADMIN;

    await user.save();
    return res.status(200).json({
      user,
    });
  } catch (e) {
    const msg = 'An error occurred while updating user';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};
