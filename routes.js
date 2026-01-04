import { Router } from 'express';
import { addResult, getResultByCode } from './controllers/results.js';
import {
  checkAuth,
  createAccount,
  login,
  accountInfo,
  getResetPasswordToken,
  resetPassword,
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
} from './controllers/groups.js';
const router = Router();

router.get('/results', getResultByCode);
router.post('/results', addResult);

router.post('/login', login);
router.post('/create-account', createAccount);
router.post('/reset-password-token', getResetPasswordToken);
router.post('/reset-password', resetPassword);

router.get('/poll', getPoll);
router.post('/poll/ready', pollReady);
router.get('/poll/ready', checkReady);

// Routes following are admin/facilitator/lead access only
router.use(checkAuth);

router.get('/account', accountInfo);
router.post('/new-group', createGroup);
router.post('/edit-group', editGroup);
router.post('/update-group', updateGroup); // For updating group state during a presentation
router.post('/delete-group', deleteGroup);
router.get('/groups', getGroups);
router.get('/group', getGroup);
router.get('/poll/results', checkPoll);
router.post('/poll/begin', beginPoll);

export default router;
