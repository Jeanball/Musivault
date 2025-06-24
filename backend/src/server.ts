import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from 'cookie-parser';

import { connectDB } from "./config/db"

import usersRoute from "./routes/users.route"
import discogsRoute from './routes/discogs.route'
import authRoute from './routes/auth.route'
import collectionRoute from './routes/collection.route'
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

app.use(cors({
    origin:"http://localhost:5173",
    credentials: true
}))
app.use(express.json());
app.use(cookieParser())

app.use('/api/users', usersRoute);
app.use('/api/discogs', discogsRoute);
app.use('/api/auth', authRoute);
app.use('/api/collection', collectionRoute)


connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is running on PORT :",PORT)
    });
});