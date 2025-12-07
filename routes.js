import { Router } from 'express';
import { addResult, getResultByCode } from './controllers/results.js';
const router = Router();

router.get('/results', getResultByCode);
router.post('/results', addResult);

export default router;
