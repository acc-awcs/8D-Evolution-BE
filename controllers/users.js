import { FACILITATOR, GROUP_LEAD } from '../helpers/constants.js';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ msg: 'User not found.' });

    // The "await" is necessary, it is a promise. Don't listen to the typescript note.
    const isMatch = await bcrypt.compare(req.body.password, user.hashedPassword);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Could not log in with the provided credentials' });
    }

    const payload = {
      id: user._id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'DEV_TOKEN_TODO_REMOVE', {
      expiresIn: '24h', // Token expires in 1 hour
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

    // TODO: Check to make sure a user with that email doesn't already exist
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

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'DEV_TOKEN_TODO_REMOVE', {
      expiresIn: '24h', // Token expires in 1 hour
    });

    return res.status(200).json({ token });
  } catch (e) {
    const msg = 'An error occurred while creating account';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const checkAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'DEV_TOKEN_TODO_REMOVE');
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

export const accountInfo = (req, res) => {
  console.log('REQ', req.user);
  const { email, role, firstName, lastName, organization } = req.user;
  return res.status(200).json({ email, role, firstName, lastName, organization });
};
