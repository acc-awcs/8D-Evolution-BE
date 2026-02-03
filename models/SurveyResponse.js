import mongoose from 'mongoose';

const surveyResponseSchema = new mongoose.Schema(
  {
    text: String,
    resultCode: String,
    pollCode: String,
  },
  {
    timestamps: true,
  }
);

export const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);
