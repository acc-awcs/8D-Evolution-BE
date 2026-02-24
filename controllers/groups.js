import { FACILITATOR, TABLE_PAGE_SIZE } from '../helpers/constants.js';
import { generateNumericCode, generateUniqueCookieId, getUniqueCode } from '../helpers/general.js';
import { Group } from '../models/Group.js';
import jwt from 'jsonwebtoken';
import { Result } from '../models/Result.js';
import { User } from '../models/User.js';
import { SurveyResponse } from '../models/SurveyResponse.js';
import {
  addMonths,
  addYears,
  differenceInCalendarMonths,
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  isValid,
  isWithinInterval,
  parse,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import csv from 'csvtojson';

export const importManualData = async (req, res) => {
  // CSVs downloaded from provided AWCS spreadsheet
  const csvFilePath = 'data/facilitator-data.csv'; // 'Complete + Running' tab
  const participantCsvFilePath = 'data/participant-data.csv'; // 'Complete Cohorts' tab
  const jsonArray = await csv().fromFile(csvFilePath);
  const participantJsonArray = await csv().fromFile(participantCsvFilePath);

  // Clear out old manual data
  await Group.deleteMany({ manualEntry: true });

  // Just pull the participant data
  const participantsByFacilitation = participantJsonArray.reduce((accum, row) => {
    const facilitationId = row['Cohort'];
    if (!accum[facilitationId]) {
      accum[facilitationId] = row['Participants'];
    }
    return accum;
  }, {});

  const valuesByFacilitation = jsonArray.reduce((accum, row) => {
    const facilitationId = row['Cohort'];
    if (!accum[facilitationId]) {
      let endPollDate = new Date(row['End Date']);
      let startPollDate = new Date(row['Start Date']);

      if (!isValid(endPollDate) || !row['Value after']) {
        endPollDate = null;
      }
      if (!isValid(startPollDate) || !row['Value before']) {
        startPollDate = null;
      }
      accum[facilitationId] = {
        manualEntry: true,
        name: facilitationId,
        creatorRole: FACILITATOR,
        creatorShortName: facilitationId?.split('-')?.[1],
        startPollInitiated: startPollDate ? true : false,
        startPollDate,
        endPollInitiated: endPollDate ? true : false,
        endPollDate,
        year: row['Year'],
        manualStartData: {},
        manualEndData: {},
        manualNumParticipants: participantsByFacilitation[facilitationId] || 0,
        initialManualImport: true,
      };
    }
    const dynamicKey = row['Dynamic']?.toLowerCase();
    accum[facilitationId] = {
      ...accum[facilitationId],
      manualStartData: {
        ...accum[facilitationId]?.manualStartData,
        [dynamicKey]: row['Value before'],
      },
      manualEndData: {
        ...accum[facilitationId]?.manualEndData,
        [dynamicKey]: row['Value after'],
      },
    };
    // accum[facilitationId]?.manualEndData?.[dynamicKey] = row['Value after'];
    return accum;
  }, {});

  // Once we have the completed group objects, let's add to the database!
  const resultsPromises = Object.values(valuesByFacilitation).map(async g => {
    const newGroup = new Group(g);
    const groupObj = await newGroup.save();
    return groupObj;
  });
  const stats = await Promise.all(resultsPromises);

  return res.status(200).json({ success: true, msg: 'Imported manual CSV data', stats });
};

export const createGroup = async (req, res) => {
  let name = req.body.name;
  let creatorShortName = '';

  if (req.user.role === FACILITATOR) {
    // Facilitator group names should be formatted as: Last Name + First Initial, Organization Name, Month, Year
    name = `${req.body.organization}, ${req.body.month}, ${req.body.year}`;
    creatorShortName = `${req.user.lastName} ${req.user.firstName?.[0]}`;
  }
  try {
    const newGroup = new Group({
      userId: req.user._id,
      creatorRole: req.user.role,
      name,
      creatorShortName,
      month: req.body.month, // This fields is only for generating names for trained facilitators
      year: req.body.year, // This fields is only for generating names for trained facilitators
      organization: req.body.organization, // This fields is only for generating names for trained facilitators
      startPollCode: null,
      endPollCode: null,
      startPollReadyParticipants: [],
      endPollReadyParticipants: [],
    });

    await newGroup.save();

    // Also return information for sending a new group notification to admin users (that are signed up for them)
    const adminUsersToEmail = await User.find({ receiveNewGroupEmails: true });
    const adminEmails = adminUsersToEmail.map(u => u.email);
    return res.status(200).json({
      group: newGroup,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userEmail: req.user.email,
      adminEmails,
    });
  } catch (e) {
    const msg = 'An error occurred while creating new group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const editGroup = async (req, res) => {
  let name = req.body.name;

  if (req.user.role === FACILITATOR) {
    name = `${req.body.organization}, ${req.body.month}, ${req.body.year}`;
  }
  try {
    const group = await Group.findById(req.body.groupId);

    group.name = name;
    if (req.user.role === FACILITATOR) {
      group.month = req.body.month;
      group.organization = req.body.organization;
      group.year = req.body.year;
    }
    await group.save();
    return res.status(200).json(group);
  } catch (e) {
    const msg = 'An error occurred while editing group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userGroups = await Group.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
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
    const startingPointGroup = await Group.findOne({
      startPollCode: req.query.pollCode,
    });
    const endingPointGroup = await Group.findOne({
      endPollCode: req.query.pollCode,
    });
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
      startMatchingResults = await Result.find({
        pollCode: group.startPollCode,
      });
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

const createPollToken = (group, pollCode) => {
  const payload = {
    cookieId: generateUniqueCookieId(),
    pollCode,
    groupId: group._id,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
};

// Check if user is already ready or has already submitted a poll response
export const checkReady = async (req, res) => {
  try {
    // Find the associated group
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

    // Check to see if this user has a pollToken. Use it to determine if they are ready or have already submitted.
    // If not, create a new pollToken.
    let decodedToken = null;
    let newPollToken = null;
    let submittedResult = null;
    let alreadySubmitted = false;
    try {
      decodedToken = jwt.verify(req.query.pollToken, process.env.JWT_SECRET);
    } catch (e) {
      console.log('Does not have a valid poll token, will create a new one');
    }

    const tokenMatchesPoll = pollCode === decodedToken?.pollCode;
    if (tokenMatchesPoll) {
      submittedResult = await Result.findOne({
        pollCode,
        pollToken: req.query.pollToken,
      });
      if (submittedResult) {
        alreadySubmitted = true;
      }
    } else {
      // Also create a new poll token if they have an old poll token
      newPollToken = createPollToken(group, pollCode);
    }

    return res.status(200).json({
      group,
      tokenMatchesPoll,
      alreadySubmitted,
      pollHasBeenInitiated: isStart ? group.startPollInitiated : group.endPollInitiated,
      newPollToken,
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
    const pollToken = createPollToken(group, pollCode);

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

const formatManualAnswers = answersObj => {
  return [
    parseFloat(answersObj['d1']),
    parseFloat(answersObj['d2']),
    parseFloat(answersObj['d3']),
    parseFloat(answersObj['d4']),
    parseFloat(answersObj['d5']),
    parseFloat(answersObj['d6']),
    parseFloat(answersObj['d7']),
    parseFloat(answersObj['d8']),
  ];
};

const isNonEmpty = v => v && !Array.isArray(v);

export const formatAnswers = resultsArray => {
  const formattedAnswers = resultsArray?.reduce(
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
  return formattedAnswers;
};

const getTotalAverage = (statsArray, key) => {
  const statsToCheck = statsArray?.filter(s => isNonEmpty(s[key]?.[0])) || [];
  const totalAverage = statsToCheck.reduce(
    (ans, stat, index) => {
      if (stat[key]?.[0] && !Array.isArray(stat[key]?.[0])) {
        ans[0].push(stat[key]?.[0]);
        ans[1].push(stat[key]?.[1]);
        ans[2].push(stat[key]?.[2]);
        ans[3].push(stat[key]?.[3]);
        ans[4].push(stat[key]?.[4]);
        ans[5].push(stat[key]?.[5]);
        ans[6].push(stat[key]?.[6]);
        ans[7].push(stat[key]?.[7]);
      }
      if (index === statsToCheck.length - 1) {
        return ans.map(getAverageValFromArray);
      }
      return ans;
    },
    [[], [], [], [], [], [], [], []]
  );
  return totalAverage;
};

const getGroupStats = async group => {
  let startResults = [];
  let endResults = [];
  let user = null;

  if (group.manualEntry) {
    return {
      startResults: [],
      endResults: [],
      averagedStartResults: group.manualStartData['d1']
        ? formatManualAnswers(group.manualStartData)
        : null,
      averagedEndResults: group.manualEndData['d1']
        ? formatManualAnswers(group.manualEndData)
        : null,
      group,
      user: {
        firstName: group.creatorShortName,
      },
    };
  }

  if (group.startPollInitiated) {
    startResults = await Result.find({ pollCode: group.startPollCode });
  }
  if (group.endPollInitiated) {
    endResults = await Result.find({ pollCode: group.endPollCode });
  }
  if (!group?.user?.[0] && group.userId) {
    user = await User.findById(group.userId).select('firstName lastName role email _id');
  }
  const averagedStartResults = formatAnswers(startResults);
  const averagedEndResults = formatAnswers(endResults);

  return {
    startResults,
    endResults,
    averagedStartResults,
    averagedEndResults,
    group,
    user: group?.user?.[0] || user,
  };
};

const getGroupResultsWithDate = async group => {
  if (group.manualEntry) {
    return {
      numParticipants: group.manualNumParticipants,
      startPollDate: group.startPollDate,
    };
  }
  const startResults = await Result.find({ pollCode: group.startPollCode });
  return {
    numParticipants: startResults.length,
    startPollDate: group.startPollDate,
  };
};

export const getGroupResultsPage = async (req, res) => {
  const page = req.query.page;
  const query = {
    creatorRole: req.query.role,
    startPollInitiated: true,
  };

  // if start and end dates are defined, and start date is bigger than the end date ...
  let startDate = new Date(`${req.query.s}`);
  let endDate = new Date(`${req.query.e}`);
  const usingCustomDates = req.query.tr === 'custom';
  const usingLastYear = req.query.tr === 'year';
  let allTime = true;
  if (usingCustomDates) {
    if (isValid(startDate) && isValid(endDate) && isAfter(endDate, startDate)) {
      startDate = new Date(`${req.query.s}T00:00:00-05:00`);
      endDate = new Date(`${req.query.e}T00:00:00-05:00`);
      startDate = startOfDay(startDate);
      endDate = endOfDay(endDate);
      query['startPollDate'] = { $gte: startDate, $lte: endDate };
      allTime = false;
    } else {
      return res.status(200).json({
        invalidTimes: true,
        msg:
          isValid(startDate) && isValid(endDate) && !isAfter(endDate, startDate)
            ? 'Please select an end date that occurs after the start date.'
            : 'Please select a start and end date.',
      });
    }
  }
  if (usingLastYear) {
    const today = new Date();
    endDate = today;
    startDate = addYears(today, -1);
    startDate = startOfDay(startDate);
    endDate = endOfDay(endDate);
    query['startPollDate'] = { $gte: startDate, $lte: endDate };
    allTime = false;
  }

  try {
    const groups = await Group.find(query);

    if (groups.length < 1) {
      return res.status(200).json({
        invalidTimes: true,
        msg: allTime
          ? 'Looks like there isn’t any data to show here yet.'
          : 'No data exists for this time range.',
      });
    }

    // Chart Data
    const groupsPromise = groups.map(group => getGroupResultsWithDate(group));
    const groupsWithParticipantCount = await Promise.all(groupsPromise);

    const today = new Date();
    const earliestStartDate = new Date('06/01/2022');
    const numMonthsToShow = allTime
      ? differenceInCalendarMonths(today, earliestStartDate) + 1
      : differenceInCalendarMonths(endDate, startDate) + 1;
    const participantsByMonth = Array.from({ length: numMonthsToShow }, (v, i) => {
      const targetDate = allTime
        ? addMonths(today, -(numMonthsToShow - i - 1))
        : addMonths(endDate, -(numMonthsToShow - i - 1));
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);
      const groupsInDateRange = groupsWithParticipantCount.filter(g =>
        isWithinInterval(g.startPollDate, { start, end })
      );
      let month = format(targetDate, 'MMM yy').split(' ').join(` '`);
      if (i === 0 && !allTime) {
        const startDateShort = format(startDate, 'MM/dd');
        month = `${month} (>=${startDateShort})`;
      } else if (i === numMonthsToShow - 1 && !allTime && !usingLastYear) {
        const endDateShort = format(endDate, 'MM/dd');
        month = `${month} (<=${endDateShort})`;
      }
      return {
        month,
        participants: groupsInDateRange.reduce((sum, g) => g.numParticipants + sum, 0),
        groups: groupsInDateRange.length,
      };
    });

    // Other Data
    const statsPromise = groups.map(group => getGroupStats(group));
    const stats = await Promise.all(statsPromise);
    const totalAverageStart = getTotalAverage(stats, 'averagedStartResults');
    const totalAverageEnd = getTotalAverage(stats, 'averagedEndResults');

    // Paginated Data
    const totalCount = groups.length;
    let validPage = page;
    const totalPages = Math.ceil(totalCount / TABLE_PAGE_SIZE);
    if (totalPages - 1 < parseInt(page, 10)) {
      validPage = totalPages - 1;
    }
    if (parseInt(page, 10) < 0) {
      validPage = 0;
    }
    const paginatedGroupsInit = await Group.find(query)
      .sort({ initialManualImport: 1, createdAt: -1, startPollDate: -1 })
      .skip(TABLE_PAGE_SIZE * validPage)
      .limit(TABLE_PAGE_SIZE);

    // Get the number of participants along with group object
    const paginatedGroupsPromise = paginatedGroupsInit.map(async group => {
      const numParticipants = await getGroupResultsWithDate(group);
      return {
        ...group.toJSON(),
        ...numParticipants,
      };
    });
    const paginatedGroups = await Promise.all(paginatedGroupsPromise);

    return res.status(200).json({
      stats,
      totalAverageStart,
      totalAverageEnd,
      participantsByMonth,
      paginatedGroups,
      totalPages,
      validPage,
      totalParticipants: groupsWithParticipantCount.reduce((a, g) => g.numParticipants + a, 0),
      totalNewGroups: groupsWithParticipantCount.length,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching group data';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const delay = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const getSingleGroupResults = async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.query.groupId,
    });
    if (!group) {
      return res.status(404).json({ msg: "Couldn't find that group" });
    }
    const surveyResponses = await SurveyResponse.find({
      pollCode: group.endPollCode,
    });
    const stats = await getGroupStats(group);
    return res.status(200).json({
      stats,
      surveyResponses,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching single group results';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};
