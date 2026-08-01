import mongoose from "mongoose"
import { logger } from './logger.config';


export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI!)
        logger.info("MongoDB connected successfully.");
    } catch (error) {
        logger.error({ err: error }, 'Error connecting to MONGODB');
        process.exit(1) //exit with failure
    }
}