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

    startingPointCode: String,
    endingPointCode: String,
    // collectiveStartData: [mongoose.ObjectId],
    // collectiveEndData: [mongoose.ObjectId],
    collectiveStartReady: [String],
    collectiveEndReady: [String],
  },
  {
    timestamps: true,
  }
);

export const Group = mongoose.model('Group', groupSchema);
