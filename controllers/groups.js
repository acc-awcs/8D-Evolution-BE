import { FACILITATOR, TABLE_PAGE_SIZE } from "../helpers/constants.js";
import {
  generateNumericCode,
  generateUniqueCookieId,
  getUniqueCode,
} from "../helpers/general.js";
import { Group } from "../models/Group.js";
import jwt from "jsonwebtoken";
import { Result } from "../models/Result.js";
import { User } from "../models/User.js";
import { SurveyResponse } from "../models/SurveyResponse.js";
import {
  addMonths,
  endOfMonth,
  format,
  isWithinInterval,
  startOfMonth,
} from "date-fns";

export const createGroup = async (req, res) => {
  let name = req.body.name;
  let creatorShortName = "";

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
    const adminEmails = adminUsersToEmail.map((u) => u.email);
    return res.status(200).json({
      group: newGroup,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userEmail: req.user.email,
      adminEmails,
    });
  } catch (e) {
    const msg = "An error occurred while creating new group";
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
    const msg = "An error occurred while editing group";
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
    const msg = "An error occurred while fetching groups";
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
    const msg = "An error occurred while fetching group";
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
    const msg = "An error occurred while deleting group";
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

    if (key === "startPollInitiated") {
      group.startPollInitiated = value === "true" ? true : false;
      group.startPollDate = new Date();
    } else if (key === "endPollInitiated") {
      group.endPollInitiated = value === "true" ? true : false;
      group.endPollDate = new Date();
    }

    await group.save();
    return res.status(200).json({
      group,
    });
  } catch (e) {
    const msg = "An error occurred while fetching group";
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

    const isStart = req.body.isStart === "true";
    const startOrEnd = isStart ? "start" : "end";
    const initiatedField = `${startOrEnd}PollInitiated`;
    const readyParticipantsField = `${startOrEnd}PollReadyParticipants`;
    const pollCodeField = `${startOrEnd}PollCode`;
    const pollDateField = `${startOrEnd}PollDate`;

    // Create a unique code for poll
    const newPollCode = await getUniqueCode(
      generateNumericCode,
      Group,
      "startPollCode",
      "endPollCode",
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
    const msg = "An error occurred while starting poll";
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
      pollHasBeenInitiated: isStart
        ? group.startPollInitiated
        : group.endPollInitiated,
    });
  } catch (e) {
    p;
    const msg = "An error occurred while fetching group";
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const checkPoll = async (req, res) => {
  try {
    const groupId = req.query.groupId;
    const isStart = req.query.isStart === "true";
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
    const msg = "An error occurred while fetching poll data";
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
    expiresIn: "24h",
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
      console.log("Does not have a valid poll token, will create a new one");
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
      pollHasBeenInitiated: isStart
        ? group.startPollInitiated
        : group.endPollInitiated,
      newPollToken,
    });
  } catch (e) {
    const msg = "An error occurred while ready status";
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
      group.startPollReadyParticipants = [
        ...(group.startPollReadyParticipants || []),
        pollToken,
      ];
    } else {
      group.endPollReadyParticipants = [
        ...(group.endPollReadyParticipants || []),
        pollToken,
      ];
    }
    await group.save();
    return res.status(200).json({
      pollToken,
      pollCode,
    });
  } catch (e) {
    const msg = "An error occurred while fetching group";
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

const getAverageValFromArray = (arr) => {
  const sum = arr.reduce((total, num) => num + total, 0);
  return sum / arr.length;
};

const formatAnswers = (resultsArray) => {
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
    [[], [], [], [], [], [], [], []],
  );
};

const getTotalAverage = (statsArray, key) => {
  return statsArray?.reduce(
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
      if (index === statsArray.length - 1) {
        return ans.map(getAverageValFromArray);
      }
      return ans;
    },
    [[], [], [], [], [], [], [], []],
  );
};

const getGroupStats = async (group) => {
  let startResults = [];
  let endResults = [];
  let user = null;
  if (group.startPollInitiated) {
    startResults = await Result.find({ pollCode: group.startPollCode });
  }
  if (group.endPollInitiated) {
    endResults = await Result.find({ pollCode: group.endPollCode });
  }
  if (!group?.user?.[0] && group.userId) {
    user = await User.findById(group.userId).select(
      "firstName lastName role email _id",
    );
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

const getGroupResultsWithDate = async (group) => {
  const startResults = await Result.find({ pollCode: group.startPollCode });
  return {
    numParticipants: startResults.length,
    startPollDate: group.startPollDate,
  };
};

// Return table of unique, paginated groups
export const getGroupResultsPage = async (req, res) => {
  const page = req.query.page;

  // TODO - clarify if we should include data by user type at the moment or at the time of facilitation (probably the latter ...)
  // Confirm that we'd still want to have data from users that were removed?
  const aggregateQuery = [
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $match: {
        "user.role": req.query.role,
      },
    },
  ];

  try {
    // Get group ids to display
    const totalPaginatedCount = await Group.aggregate([
      ...aggregateQuery,
      { $count: "totalDocuments" },
    ]);
    const totalCount = totalPaginatedCount?.[0]?.totalDocuments;
    let validPage = page;
    const totalPages = Math.ceil(totalCount / TABLE_PAGE_SIZE);
    if (totalPages - 1 < parseInt(page, 10)) {
      validPage = totalPages - 1;
    }
    if (parseInt(page, 10) < 0) {
      validPage = 0;
    }
    const paginatedGroups = await Group.aggregate(aggregateQuery)
      .sort({ createdAt: -1 })
      .skip(TABLE_PAGE_SIZE * validPage)
      .limit(TABLE_PAGE_SIZE);

    return res.status(200).json({
      paginatedGroups,
      totalPages,
      validPage,
    });
  } catch (e) {
    const msg = "An error occurred while fetching group results page";
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Return chart data for the last 12 months on new groups and participating users
export const getChartData = async (req, res) => {
  const aggregateQuery = [
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $match: {
        "user.role": req.query.role,
        startPollInitiated: true,
      },
    },
  ];

  try {
    // Groups for stats
    const statGroups = await Group.aggregate(aggregateQuery);
    const groupsPromise = statGroups.map((group) =>
      getGroupResultsWithDate(group),
    );
    const groupsWithParticipantCount = await Promise.all(groupsPromise);

    const numMonthsToShow = 12;
    const today = new Date();
    const participantsByMonth = Array.from(
      { length: numMonthsToShow },
      (v, i) => {
        const targetDate = addMonths(today, -(12 - i - 1));
        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);
        const groupsInDateRange = groupsWithParticipantCount.filter((g) =>
          isWithinInterval(g.startPollDate, { start, end }),
        );
        return {
          // month: format(targetDate, "MMM yyyy"),
          month: format(targetDate, "MMMM yy").split(" ").join(` '`),
          participants: groupsInDateRange.reduce(
            (sum, g) => g.numParticipants + sum,
            0,
          ),
          groups: groupsInDateRange.length,
        };
      },
    );

    return res.status(200).json(participantsByMonth);
  } catch (e) {
    const msg = "An error occurred while fetching chart data";
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getAggregatedGroupStats = async (req, res) => {
  const aggregateQuery = [
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $match: {
        "user.role": req.query.role,
      },
    },
  ];

  try {
    // Groups for stats
    const statGroups = await Group.aggregate(aggregateQuery);
    const resultsPromises = statGroups.map((group) => getGroupStats(group));
    const stats = await Promise.all(resultsPromises);

    const isValid = (v) => v && !Array.isArray(v);

    // Only calculate total average for fully complete groups
    const finishedStats = stats.filter(
      (s) =>
        isValid(s.averagedStartResults?.[0]) &&
        isValid(s.averagedEndResults?.[0]),
    );
    const totalAverageStart = getTotalAverage(
      finishedStats,
      "averagedStartResults",
    );
    const totalAverageEnd = getTotalAverage(
      finishedStats,
      "averagedEndResults",
    );

    // Get survey data
    const surveys = await SurveyResponse.find();

    return res.status(200).json({
      stats,
      totalAverageStart,
      totalAverageEnd,
      surveys,
    });
  } catch (e) {
    const msg = "An error occurred while fetching group results page";
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getSingleGroupResults = async (req, res) => {
  try {
    const group = await Group.findOne({
      creatorRole: req.query.role,
      _id: req.query.groupId,
    });
    const stats = await getGroupStats(group);
    return res.status(200).json({
      stats,
    });
  } catch (e) {
    const msg = "An error occurred while fetching single group results";
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};
