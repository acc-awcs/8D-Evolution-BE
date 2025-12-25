import { Router } from 'express';
import { addResult, getResultByCode } from './controllers/results.js';
import { checkAuth, createAccount, login, accountInfo } from './controllers/users.js';
import { createGroup, deleteGroup, editGroup, getGroup, getGroups } from './controllers/groups.js';
const router = Router();

router.get('/results', getResultByCode);
router.post('/results', addResult);

router.post('/login', login);
router.post('/create-account', createAccount);

router.use(checkAuth);

router.get('/account', accountInfo);
router.post('/new-group', createGroup);
router.post('/edit-group', editGroup);
router.post('/delete-group', deleteGroup);
router.get('/groups', getGroups);
router.get('/group', getGroup);

export default router;
