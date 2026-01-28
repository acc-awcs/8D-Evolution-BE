import { Router } from 'express';
import { addResult, getResultByCode } from './controllers/results.js';
import {
  checkAuth,
  createAccount,
  login,
  accountInfo,
  getResetPasswordToken,
  resetPassword,
  checkAdminAuth,
  adminLogin,
  getUsers,
  getUser,
  updateUser,
  upgradeAccount,
  deleteUser,
  deleteAccount,
} from './controllers/users.js';
import {
  checkPoll,
  checkReady,
  createGroup,
  deleteGroup,
  editGroup,
  getGroup,
  getGroups,
  getPoll,
  pollReady,
  beginPoll,
  updateGroup,
  getGroupResultsPage,
  getSingleGroupResults,
  getAggregatedGroupStats,
} from './controllers/groups.js';
const router = Router();

router.get('/results', getResultByCode);
router.post('/results', addResult);

router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/create-account', createAccount);
router.post('/reset-password-token', getResetPasswordToken);
router.post('/reset-password', resetPassword);

router.get('/poll', getPoll);
router.post('/poll/ready', pollReady);
router.get('/poll/ready', checkReady);

router.get('/poll/results', checkPoll);

// Routes following are admin/facilitator/lead access only
router.use(checkAuth);

router.get('/account', accountInfo);
router.post('/new-group', createGroup);
router.post('/edit-group', editGroup);
router.post('/update-group', updateGroup); // For updating group state during a presentation
router.post('/delete-group', deleteGroup);
router.get('/groups', getGroups);
router.get('/group', getGroup);
router.post('/poll/begin', beginPoll);
// router.post('/upgrade-account', upgradeAccount);
router.post('/delete-account', deleteAccount);

// Routes following are admin access only
router.use(checkAdminAuth);

router.get('/group-results-page', getGroupResultsPage);
router.get('/group-results-aggregate', getAggregatedGroupStats);
router.get('/group-results-single', getSingleGroupResults);
router.get('/users', getUsers);
router.get('/user', getUser);
router.post('/update-user', updateUser);
router.post('/delete-user', deleteUser);

export default router;
