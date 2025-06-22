import express from "express"
import dotenv from "dotenv"
import cors from "cors"

import usersRoute from "./routes/usersRoute"
import { connectDB } from "./config/db"



dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

app.use(cors({
    origin:"http://localhost:5173",
}))
app.use(express.json());
app.use("/api/users", usersRoute)



connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is running on PORT :",PORT)
    });
});