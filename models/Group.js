import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    userId: mongoose.ObjectId,
    creatorRole: String, // "admin", "groupLead", or "trainedFacilitator"
    creatorShortName: String,
    name: String,
    season: String, // This fields is only for generating names for trained facilitators
    year: String, // This fields is only for generating names for trained facilitators
    organization: String, // This fields is only for generating names for trained facilitators

    startPollCode: String,
    endPollCode: String,
    startPollInitiated: Boolean, // Poll start triggered by facilitator/lead
    endPollInitiated: Boolean, // Poll start triggered by facilitator/lead
    startPollDate: Date,
    endPollDate: Date,
    startPollReadyParticipants: [String],
    endPollReadyParticipants: [String],
  },
  {
    timestamps: true,
  }
);

export const Group = mongoose.model('Group', groupSchema);
