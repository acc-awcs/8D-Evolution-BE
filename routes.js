import { Router } from 'express';
import { addResult, getResultByCode } from './controllers/results.js';
import { checkAuth, createAccount, login, accountInfo } from './controllers/users.js';
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
} from './controllers/groups.js';
const router = Router();

router.get('/results', getResultByCode);
router.post('/results', addResult);

router.post('/login', login);
router.post('/create-account', createAccount);

router.get('/poll', getPoll);
router.post('/poll/ready', pollReady);
router.get('/poll/ready', checkReady);

router.use(checkAuth);

router.get('/account', accountInfo);
router.post('/new-group', createGroup);
router.post('/edit-group', editGroup);
router.post('/delete-group', deleteGroup);
router.get('/groups', getGroups);
router.get('/group', getGroup);
router.get('/poll-results', checkPoll);

export default router;
