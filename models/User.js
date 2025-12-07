import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: String,
    role: String, // "admin", "groupLead", or "trainedFacilitator"
    hashedPassword: String,
    // Following fields are only for trained facilitator naming conventions
    firstName: String,
    lastName: String,
    organization: String,
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model('User', userSchema);
