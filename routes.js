import { Router } from 'express';
import { addResult, getResultByCode } from './controllers/results.js';
import { checkAuth, createAccount, login, accountInfo } from './controllers/users.js';
const router = Router();

router.get('/results', getResultByCode);
router.post('/results', addResult);

router.post('/login', login);
router.post('/create-account', createAccount);

router.use(checkAuth);

router.get('/account', accountInfo);

export default router;
