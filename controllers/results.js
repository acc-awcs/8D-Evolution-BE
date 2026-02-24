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
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { generateCode, getUniqueCode } from '../helpers/general.js';
import { Group } from '../models/Group.js';
import { Result } from '../models/Result.js';
import { SurveyResponse } from '../models/SurveyResponse.js';
import { formatAnswers } from './groups.js';
import { TABLE_PAGE_SIZE } from '../helpers/constants.js';

export const getResults = async (req, res) => {
  const results = await Result.find();
  return res.json({ results });
};

export const getResultById = async (req, res) => {
  try {
    const result = await Result.findById(req.query.resultId);
    return res.status(200).json({ result });
  } catch (e) {
    const msg = 'An error occurred while fetching results';
    console.error(msg);
    return res.status(500).json({ msg });
  }
};

export const getResultByCode = async (req, res) => {
  try {
    let query = { resultCode: req.query.resultCode };
    if (req.query.startOnly === 'true') {
      query.isStart = true;
    }
    const result = await Result.findOne(query);
    if (!result) {
      return res.status(404).json({ msg: "Couldn't find a result with that code" });
    }

    // if it's an ending point code, pull the starting point data too and return it!
    if (!result.isStart && result.startCode) {
      const startingPointResults = await Result.findOne({ resultCode: result.startCode });
      return res.status(200).json({
        currentResults: result,
        startingPointResults,
      });
    }

    // if the users's passing an end code and we can find a start code, hook it up???
    if (req.query.startOnly === 'true') {
      const endingPointResult = await Result.findOne({ resultCode: req.query.endCode });
      if (!endingPointResult?.startCode) {
        endingPointResult.startCode = req.query.resultCode;
        await endingPointResult.save();
      }
    }

    // If there's a poll code, also fetch that
    let showEndingSurvey = false;
    if (req.query.pollCode) {
      const endingPointGroup = await Group.findOne({ endPollCode: req.query.pollCode });
      if (endingPointGroup) {
        showEndingSurvey = true;
      }
    }

    return res.status(200).json({
      currentResults: result,
      showEndingSurvey,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching results';
    console.error(msg);
    return res.status(500).json({ msg });
  }
};

export const addResult = async (req, res) => {
  // On posting a result, generate a unique six digit code
  const resultCode = await getUniqueCode(generateCode, Result, 'resultCode');
  const result = new Result({
    ...req.body,
    resultCode,
  });

  await result.save();

  return res.status(200).json(result);
};

// Get individual responses
export const getIndividualResults = async (req, res) => {
  const results = await Result.find({ pollCode: null });
  return res.json({ results });
};

export const deleteResult = async (req, res) => {
  const deletedResult = await Result.findByIdAndDelete(req.body.resultId);
  return res.json({ deletedResult });
};

export const addSurveyResponse = async (req, res) => {
  const response = new SurveyResponse({
    ...req.body,
  });
  await response.save();
  return res.status(200).json(response);
};

const getFacilitationData = async surveyResponse => {
  const facilitation = await Group.findOne({ endPollCode: surveyResponse.pollCode });
  if (!facilitation) {
    return {
      ...surveyResponse.toJSON(),
      createdDate: format(surveyResponse.createdAt, 'MMMM dd, yyyy'),
    };
  }
  return {
    ...surveyResponse.toJSON(),
    facilitationId: facilitation._id,
    creatorRole: facilitation.creatorRole,
    creatorShortName: facilitation.creatorShortName,
    facilitationName: facilitation.name,
    createdDate: format(surveyResponse.createdAt, 'MMMM dd, yyyy'),
  };
};

export const getSurveyResponses = async (req, res) => {
  const page = req.query.page;
  const query = {};

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
      query['createdAt'] = { $gte: startDate, $lte: endDate };
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
    query['createdAt'] = { $gte: startDate, $lte: endDate };
    allTime = false;
  }

  try {
    const surveys = await SurveyResponse.find(query);

    if (surveys.length < 1) {
      return res.status(200).json({
        invalidTimes: true,
        msg: allTime
          ? 'Looks like there isn’t any data to show here yet.'
          : 'No data exists for this time range.',
      });
    }

    // Paginated Data
    const totalCount = surveys.length;
    let validPage = page;
    const totalPages = Math.ceil(totalCount / TABLE_PAGE_SIZE);
    if (totalPages - 1 < parseInt(page, 10)) {
      validPage = totalPages - 1;
    }
    if (parseInt(page, 10) < 0) {
      validPage = 0;
    }

    const paginatedSurveysInit = await SurveyResponse.find(query)
      .sort({ createdAt: -1 })
      .skip(TABLE_PAGE_SIZE * validPage)
      .limit(TABLE_PAGE_SIZE);

    // Add facilitation data
    const surveysPromise = paginatedSurveysInit.map(resp => getFacilitationData(resp));
    const paginatedSurveys = await Promise.all(surveysPromise);

    return res.status(200).json({
      paginatedSurveys,
      totalSurveys: surveys.length,
      totalPages,
      validPage,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching individual user results page data';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

// Data for page of individual user results, time based (admin)
export const getIndividualUserResults = async (req, res) => {
  const page = req.query.page;
  const query = {
    individual: true,
    quizOnly: false,
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
      query['createdAt'] = { $gte: startDate, $lte: endDate };
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
    query['createdAt'] = { $gte: startDate, $lte: endDate };
    allTime = false;
  }

  try {
    const results = await Result.find(query);

    if (results.length < 1) {
      return res.status(200).json({
        invalidTimes: true,
        msg: allTime
          ? 'Looks like there isn’t any data to show here yet.'
          : 'No data exists for this time range.',
      });
    }

    // startData
    const startResults = results.filter(r => r.isStart);
    const endResults = results.filter(r => !r.isStart);
    const pairedEndResults = endResults.filter(r => r.startCode);

    const today = new Date();
    const earliestStartDate = new Date('06/01/2022');
    const numMonthsToShow = allTime
      ? differenceInCalendarMonths(today, earliestStartDate) + 1
      : differenceInCalendarMonths(endDate, startDate) + 1;
    const resultsByMonth = Array.from({ length: numMonthsToShow }, (v, i) => {
      const targetDate = allTime
        ? addMonths(today, -(numMonthsToShow - i - 1))
        : addMonths(endDate, -(numMonthsToShow - i - 1));
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);
      const startResultsInDateRange = startResults.filter(g =>
        isWithinInterval(g.createdAt, { start, end })
      );
      const endResultsInDateRange = endResults.filter(g =>
        isWithinInterval(g.createdAt, { start, end })
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
        numStartResults: startResultsInDateRange.length,
        numEndResults: endResultsInDateRange.length,
      };
    });

    // Paginated Data
    const totalCount = results.length;
    let validPage = page;
    const totalPages = Math.ceil(totalCount / TABLE_PAGE_SIZE);
    if (totalPages - 1 < parseInt(page, 10)) {
      validPage = totalPages - 1;
    }
    if (parseInt(page, 10) < 0) {
      validPage = 0;
    }
    const paginatedResults = await Result.find(query)
      .sort({ createdAt: -1 })
      .skip(TABLE_PAGE_SIZE * validPage)
      .limit(TABLE_PAGE_SIZE);

    return res.status(200).json({
      averagedStartResults: formatAnswers(startResults),
      averagedEndResults: formatAnswers(endResults),
      resultsByMonth,
      paginatedResults,
      totalPages,
      validPage,
      totalStartResults: startResults.length,
      totalEndResults: endResults.length,
      totalPairedResults: pairedEndResults.length,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching individual user results page data';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};
