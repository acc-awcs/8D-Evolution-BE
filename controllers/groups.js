import { FACILITATOR } from '../helpers/constants.js';
import { generateNumericCode, generateUniqueCookieId, getUniqueCode } from '../helpers/general.js';
import { Group } from '../models/Group.js';
import jwt from 'jsonwebtoken';

export const createGroup = async (req, res) => {
  let name = req.body.name;

  if (req.user.role === FACILITATOR) {
    // Facilitator group names should be formatted as: Last Name + First Initial, Organization Name, Season, Year
    name = `${req.body.organization}, ${req.body.season}, ${req.body.year}`;
  }
  try {
    const getUniqueNumericCode = async () => {
      await getUniqueCode(generateNumericCode, Group, 'startingPointCode', 'endingPointCode');
    };
    const initialStartingPointCode = getUniqueNumericCode();
    const initialEndingPointCode = getUniqueNumericCode();
    const newGroup = new Group({
      userId: req.user._id,
      creatorRole: req.user.role,
      creatorShortName: `${req.user.lastName} ${req.user.firstName?.[0]}`,
      name, // This field is only naming by group leads
      season: req.body.season, // This fields is only for generating names for trained facilitators
      year: req.body.year, // This fields is only for generating names for trained facilitators
      organization: req.body.organization, // This fields is only for generating names for trained facilitators
      startingPointCode: initialStartingPointCode,
      endingPointCode: initialEndingPointCode,
      // collectiveStartData: [mongoose.ObjectId],
      // collectiveEndData: [mongoose.ObjectId],
      // collectiveStartReady: [String],
      // collectiveEndReady: [String],
    });

    await newGroup.save();
    return res.status(200).json(newGroup);
  } catch (e) {
    const msg = 'An error occurred while creating new group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const editGroup = async (req, res) => {
  let name = req.body.name;

  if (req.user.role === FACILITATOR) {
    name = `${req.body.organization}, ${req.body.season}, ${req.body.year}`;
  }
  try {
    const group = await Group.findById(req.body.groupId);

    group.name = name;
    if (req.user.role === FACILITATOR) {
      group.season = req.body.season;
      group.organization = req.body.organization;
      group.year = req.body.year;
    }
    await group.save();
    // console.log('EDITING GROUP???', group);
    return res.status(200).json(group);
  } catch (e) {
    const msg = 'An error occurred while editing group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userGroups = await Group.find({ userId: req.user._id });
    return res.status(200).json({
      groups: userGroups,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching groups';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.query.groupId);
    return res.status(200).json({
      group,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const deletedGroup = await Group.deleteOne({ _id: req.body.groupId });
    return res.status(200).json({
      group: deletedGroup,
    });
  } catch (e) {
    const msg = 'An error occurred while deleting group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getPoll = async (req, res) => {
  try {
    const startingPointGroup = await Group.findOne({ startingPointCode: req.query.pollCode });
    const endingPointGroup = await Group.findOne({ endingPointCode: req.query.pollCode });
    if (!startingPointGroup && !endingPointGroup) {
      return res.status(404).json({
        msg: "Couldn't find a matching poll",
      });
    }
    return res.status(200).json({
      group: startingPointGroup || endingPointGroup,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const checkReady = async (req, res) => {
  try {
    const decodedToken = jwt.verify(req.query.pollToken, process.env.JWT_SECRET);
    const pollCode = decodedToken.pollCode;
    const startingPointGroup = await Group.findOne({ startingPointCode: pollCode });
    const endingPointGroup = await Group.findOne({ endingPointCode: pollCode });
    if (!startingPointGroup && !endingPointGroup) {
      return res.status(404).json({
        msg: "Couldn't find a matching poll",
      });
    }
    const group = startingPointGroup || endingPointGroup;
    return res.status(200).json({
      group,
      pollCode,
    });
  } catch (e) {
    const msg = 'An error occurred while ready status';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const pollReady = async (req, res) => {
  try {
    const pollCode = req.body.pollCode;
    const startingPointGroup = await Group.findOne({ startingPointCode: pollCode });
    const endingPointGroup = await Group.findOne({ endingPointCode: pollCode });
    if (!startingPointGroup && !endingPointGroup) {
      return res.status(404).json({
        msg: "Couldn't find a matching poll",
      });
    }
    const group = startingPointGroup || endingPointGroup;
    // Create a unique cookie token for a user's poll
    const payload = {
      cookieId: generateUniqueCookieId(),
      pollCode,
      groupId: group._id,
    };
    const pollToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });
    return res.status(200).json({
      pollToken,
      pollCode,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};
