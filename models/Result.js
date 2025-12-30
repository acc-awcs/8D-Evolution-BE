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

    startCode: String,
  },
  {
    timestamps: true,
  }
);

export const Result = mongoose.model('Result', resultSchema);
