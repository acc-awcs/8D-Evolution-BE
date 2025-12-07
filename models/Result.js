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

    groupCode: String,
    sessionId: String,

    resultCode: String,
    isStart: Boolean,

    startResultId: mongoose.ObjectId, // only for end timestamps, to associate them
    startResultCode: String, // redundant, but just for easy verification
  },
  {
    timestamps: true,
  }
);

export const Result = mongoose.model('Result', resultSchema);
