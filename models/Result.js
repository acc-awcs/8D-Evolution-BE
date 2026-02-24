import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema(
  {
    d1: Number,
    d2: Number,
    d3: Number,
    d4: Number,
    d5: Number,
    d6: Number,
    d7: Number,
    d8: Number,

    pollCode: String,
    pollToken: String,

    resultCode: String,
    isStart: Boolean,

    startCode: String, // Match the result with the starting point code (for individual users)

    individual: Boolean, // Whether we should show it in the individual user dashboard
    quizOnly: Boolean, // An individual user result that's not part of a start or an end poll
  },
  {
    timestamps: true,
  }
);

export const Result = mongoose.model('Result', resultSchema);
