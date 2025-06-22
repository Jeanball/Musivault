import express from "express"
import dotenv from "dotenv"
import cors from "cors"

import { connectDB } from "./config/db"

import usersRoute from "./routes/users.route"
import discogsRoute from './routes/discogs.route'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

app.use(cors({
    origin:"http://localhost:5173",
}))
app.use(express.json());
app.use("/api/users", usersRoute)
app.use('/api/discogs', discogsRoute);


connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is running on PORT :",PORT)
    });
});