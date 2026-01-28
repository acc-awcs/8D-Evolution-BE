import express from 'express';
import mongoose from 'mongoose';
import router from './routes.js';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8000;

// Set up database connection
main().catch(err => console.log(err));
async function main() {
  await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
  console.log('Connected to MongoDB');
}

// JSON body parsing
app.use(express.json());

app.use(cors());

app.use('/api', router);

app.get('/', (req, res) => {
  return res.status(200).send('Hello from Express!');
});

app.listen(PORT, error => {
  if (!error) console.log('Server is running, app is listening on port ' + PORT);
  else console.log("Error occurred, server can't start", error);
});
