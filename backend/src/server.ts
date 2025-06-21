import express from "express"
import usersRoute from "./routes/usersRoute"
import { connectDB } from "./config/db"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

app.use(express.json());
app.use("/api/users", usersRoute)

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is running on PORT :",PORT)
    });
});