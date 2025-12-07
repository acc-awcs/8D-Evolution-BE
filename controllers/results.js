import { generateCode } from '../helpers/general.js';
import { Result } from '../models/Result.js';

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
    const result = await Result.findOne({ resultCode: req.query.resultCode });
    return res.status(200).json(result);
  } catch (e) {
    const msg = 'An error occurred while fetching results';
    console.error(msg);
    return res.status(500).json({ msg });
  }
};

export const addResult = async (req, res) => {
  // On posting a result, generate a unique six digit code
  let resultCode = generateCode();
  let resultCodeIsUnique = false;

  // Check to make sure there aren't any other results with that code out there.
  // If there is, regenerate it.
  while (!resultCodeIsUnique) {
    const matchingResults = await Result.find({ resultCode });
    resultCodeIsUnique = matchingResults.length < 1;
    resultCode = generateCode();
  }

  const result = new Result({
    ...req.body,
    resultCode,
  });

  await result.save();
  return res.json(result);
};

export const deleteResult = async (req, res) => {
  const deletedResult = await Result.findByIdAndDelete(req.body.resultId);
  return res.json({ deletedResult });
};
