import { FACILITATOR } from '../helpers/constants.js';
import { generateNumericCode, generateUniqueCookieId, getUniqueCode } from '../helpers/general.js';
import { Group } from '../models/Group.js';
import jwt from 'jsonwebtoken';
import { Result } from '../models/Result.js';

export const createGroup = async (req, res) => {
  let name = req.body.name;
  let creatorShortName = '';

  if (req.user.role === FACILITATOR) {
    // Facilitator group names should be formatted as: Last Name + First Initial, Organization Name, Season, Year
    name = `${req.body.organization}, ${req.body.season}, ${req.body.year}`;
    creatorShortName = `${req.user.lastName} ${req.user.firstName?.[0]}`;
  }
  try {
    const newGroup = new Group({
      userId: req.user._id,
      creatorRole: req.user.role,
      name,
      creatorShortName,
      season: req.body.season, // This fields is only for generating names for trained facilitators
      year: req.body.year, // This fields is only for generating names for trained facilitators
      organization: req.body.organization, // This fields is only for generating names for trained facilitators
      startPollCode: null,
      endPollCode: null,
      startPollReadyParticipants: [],
      endPollReadyParticipants: [],
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
    const userGroups = await Group.find({ userId: req.user._id }).sort({ createdAt: -1 });
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

export const updateGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.body.groupId);
    const key = req.body.key;
    const value = req.body.value;

    if (!group) {
      return res.status(404).json({
        msg: "Couldn't find a matching group",
      });
    }

    if (key === 'startPollInitiated') {
      group.startPollInitiated = value === 'true' ? true : false;
      group.startPollDate = new Date();
    } else if (key === 'endPollInitiated') {
      group.endPollInitiated = value === 'true' ? true : false;
      group.endPollDate = new Date();
    }

    await group.save();
    return res.status(200).json({
      group,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Begin a new poll by creating a pollCode and resetting any existing poll data for the group
export const beginPoll = async (req, res) => {
  try {
    const group = await Group.findById(req.body.groupId);

    if (!group) {
      return res.status(404).json({
        msg: "Couldn't find a matching group",
      });
    }

    const isStart = req.body.isStart === 'true';
    const startOrEnd = isStart ? 'start' : 'end';
    const initiatedField = `${startOrEnd}PollInitiated`;
    const readyParticipantsField = `${startOrEnd}PollReadyParticipants`;
    const pollCodeField = `${startOrEnd}PollCode`;
    const pollDateField = `${startOrEnd}PollDate`;

    // Create a unique code for poll
    const newPollCode = await getUniqueCode(
      generateNumericCode,
      Group,
      'startPollCode',
      'endPollCode'
    );
    group[pollCodeField] = newPollCode;

    // Reset the participant fields and initated fields
    group[readyParticipantsField] = [];
    group[initiatedField] = false;
    group[pollDateField] = null;

    // Also clear end poll data if start data is cleared
    if (isStart) {
      group.endPollInitiated = false;
      group.endPollReadyParticipants = [];
      group.endPollCode = null;
      group.endPollDate = null;
    }

    await group.save();
    return res.status(200).json({
      group,
    });
  } catch (e) {
    const msg = 'An error occurred while starting poll';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getPoll = async (req, res) => {
  try {
    const startingPointGroup = await Group.findOne({ startPollCode: req.query.pollCode });
    const endingPointGroup = await Group.findOne({ endPollCode: req.query.pollCode });
    let isStart = false;
    if (startingPointGroup) {
      isStart = true;
    }
    const group = startingPointGroup || endingPointGroup;

    if (!group) {
      return res.status(404).json({
        msg: "Couldn't find a matching poll",
      });
    }
    return res.status(200).json({
      group,
      isStart,
      pollHasBeenInitiated: isStart ? group.startPollInitiated : group.endPollInitiated,
    });
  } catch (e) {
    p;
    const msg = 'An error occurred while fetching group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const checkPoll = async (req, res) => {
  try {
    const groupId = req.query.groupId;
    const isStart = req.query.isStart === 'true';
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        msg: "Couldn't find a matching group",
      });
    }
    const pollCode = isStart ? group.startPollCode : group.endPollCode;
    const matchingResults = await Result.find({ pollCode });
    let startMatchingResults = null;
    if (!isStart) {
      startMatchingResults = await Result.find({ pollCode: group.startPollCode });
    }
    return res.status(200).json({
      matchingResults,
      startMatchingResults,
      group,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching poll data';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Check if user is already ready or has already submitted a poll response
export const checkReady = async (req, res) => {
  try {
    let decodedToken = null;
    try {
      decodedToken = jwt.verify(req.query.pollToken, process.env.JWT_SECRET);
    } catch (e) {
      console.log('Not a valid token', e);
    }
    const pollCode = req.query.pollCode;
    const startingPointGroup = await Group.findOne({ startPollCode: pollCode });
    const endingPointGroup = await Group.findOne({ endPollCode: pollCode });
    if (!startingPointGroup && !endingPointGroup) {
      return res.status(404).json({
        msg: "Couldn't find a matching poll",
      });
    }
    const group = startingPointGroup || endingPointGroup;
    let isStart = false;
    if (startingPointGroup) {
      isStart = true;
    }
    const submittedResult = await Result.findOne({ pollCode, pollToken: req.query.pollToken });
    let alreadySubmitted = false;
    if (submittedResult) {
      alreadySubmitted = true;
    }
    return res.status(200).json({
      group,
      tokenMatchesPoll: pollCode === decodedToken?.pollCode,
      alreadySubmitted,
      pollHasBeenInitiated: isStart ? group.startPollInitiated : group.endPollInitiated,
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
    const startingPointGroup = await Group.findOne({ startPollCode: pollCode });
    const endingPointGroup = await Group.findOne({ endPollCode: pollCode });
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

    // Add token to group ready data
    if (startingPointGroup) {
      group.startPollReadyParticipants = [...(group.startPollReadyParticipants || []), pollToken];
    } else {
      group.endPollReadyParticipants = [...(group.endPollReadyParticipants || []), pollToken];
    }
    await group.save();
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

const getAverageValFromArray = arr => {
  const sum = arr.reduce((total, num) => num + total, 0);
  return sum / arr.length;
};

export const formatAnswers = resultsArray => {
  return resultsArray?.reduce(
    (ans, res, index) => {
      ans[0].push(res.d1);
      ans[1].push(res.d2);
      ans[2].push(res.d3);
      ans[3].push(res.d4);
      ans[4].push(res.d5);
      ans[5].push(res.d6);
      ans[6].push(res.d7);
      ans[7].push(res.d8);
      if (index === resultsArray.length - 1) {
        return ans.map(getAverageValFromArray);
      }
      return ans;
    },
    [[], [], [], [], [], [], [], []]
  );
};

//
export const getGroupResults = async (req, res) => {
  // Return group responses for facilitated groups
  try {
    const finishedGroups = await Group.find({ creatorRole: FACILITATOR })
      // .limit(20)
      .exec();
    const resultsPromises = finishedGroups.map(group => {
      return new Promise(async resolve => {
        let startResults = [];
        let endResults = [];
        if (group.startPollInitiated) {
          startResults = await Result.find({ pollCode: group.startPollCode });
        }
        if (group.endPollInitiated) {
          endResults = await Result.find({ pollCode: group.endPollCode });
        }
        const averagedStartResults = formatAnswers(startResults);
        const averagedEndResults = formatAnswers(endResults);
        const singleValueAverageStart =
          startResults.length > 0 ? getAverageValFromArray(averagedStartResults) : '';
        const singleValueAverageEnd =
          endResults.length > 0 ? getAverageValFromArray(averagedEndResults) : '';
        resolve({
          startResults,
          endResults,
          averagedStartResults,
          averagedEndResults,
          singleValueAverageEnd,
          singleValueAverageStart,
          group,
        });
      });
    });

    const stats = await Promise.all(resultsPromises);
    return res.status(200).json({
      stats,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching results';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};
