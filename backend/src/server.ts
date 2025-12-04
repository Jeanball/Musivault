import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { connectDB } from "./config/db"

import usersRoute from "./routes/users.route"
import discogsRoute from './routes/discogs.route'
import authRoute from './routes/auth.route'
import collectionRoute from './routes/collection.route'
dotenv.config()

const app = express()
const PORT = parseInt(process.env.PORT || '5001', 10);
const allowedOrigins = ['http://localhost:5173', `http://10.0.0.153:5173`];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}))
app.use(express.json());
app.use(cookieParser())
app.use(helmet());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}));

app.use('/api/users', usersRoute);
app.use('/api/discogs', discogsRoute);
app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}), authRoute);
app.use('/api/collection', collectionRoute)


connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log("Server is running on PORT :",PORT)
    });
});