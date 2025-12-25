import { FACILITATOR } from '../helpers/constants.js';
import { Group } from '../models/Group.js';

export const createGroup = async (req, res) => {
  let name = req.body.name;

  if (req.user.role === FACILITATOR) {
    // Facilitator group names should be formatted as: Last Name + First Initial, Organization Name, Season, Year
    name = `${req.body.organization}, ${req.body.season}, ${req.body.year}`;
  }
  try {
    const newGroup = new Group({
      userId: req.user._id,
      creatorRole: req.user.role,
      creatorShortName: `${req.user.lastName} ${req.user.firstName?.[0]}`,
      name, // This field is only naming by group leads
      season: req.body.season, // This fields is only for generating names for trained facilitators
      year: req.body.year, // This fields is only for generating names for trained facilitators
      organization: req.body.organization, // This fields is only for generating names for trained facilitators
      // startingPointCode: String,
      // endingPointCode: String,
      // collectiveStartData: [mongoose.ObjectId],
      // collectiveEndData: [mongoose.ObjectId],
      // collectiveStartReady: [String],
      // collectiveEndReady: [String],
    });

    await newGroup.save();
    return res.status(200).json(newGroup);
  } catch (e) {
    const msg = 'An error occurred while creating new group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const editGroup = async (req, res) => {
  let name = req.body.name;

  if (req.user.role === FACILITATOR) {
    name = `${req.body.organization}, ${req.body.season}, ${req.body.year}`;
  }
  try {
    const group = await Group.findById(req.body.groupId);

    group.name = name;
    if (req.user.role === FACILITATOR) {
      group.season = req.body.season;
      group.organization = req.body.organization;
      group.year = req.body.year;
    }
    await group.save();
    // console.log('EDITING GROUP???', group);
    return res.status(200).json(group);
  } catch (e) {
    const msg = 'An error occurred while editing group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userGroups = await Group.find({ userId: req.user._id });
    return res.status(200).json({
      groups: userGroups,
    });
  } catch (e) {
    const msg = 'An error occurred while fetching groups';
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
    const msg = 'An error occurred while fetching group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const deletedGroup = await Group.deleteOne({ _id: req.body.groupId });
    console.log('DELETE??', deletedGroup, req.body.groupId);
    return res.status(200).json({
      group: deletedGroup,
    });
  } catch (e) {
    const msg = 'An error occurred while deleting group';
    console.error(msg, e);
    return res.status(500).json({ msg });
  }
};
