import { Request, Response } from 'express'
import User from '../models/User';

export async function getAllUsers(req: Request, res: Response) { 
    try {
        const users = await User.find().sort({createdAt: -1}) //Newest first
        res.status(200).json(users)
    } catch (error) {
        console.error("Error in getAllUsers controller", error)
        res.status(500).json({message: "Internal server error"});
    }
}

export async function getUserById(req: Request, res: Response) {
    try {
        const user = await User.findById(req.params.id)
        res.json(user)
    } catch (error) {
        console.error("Error in getUserById controller", error)
        res.status(500).json({message: "Internal server error"});
    }
}

export async function createUser(req: Request, res: Response) { 
    try {
        const { name, email, password, createdAt } = req.body;
        const newUser = new User({ name, email, password, createdAt})

        await newUser.save();
        res.status(201).json({message: "User created successfully."})
    } catch (error) {
        console.error("Error in createUser controller", error)
        res.status(500).json({message: "Internal server error"});
    }
}

export async function updateUser(req: Request, res: Response) { 
    try {
         const { name, email, password } = req.body;
         await User.findByIdAndUpdate(req.params.id, {name, email, password})
         res.status(200).json({message: "User modified"});
        
    } catch (error) {
        console.error("Error in updateUser controller", error)
        res.status(500).json({message: "Internal server error"});
    }
}

export async function deleteUser(req: Request, res: Response) { 
    try {
        await User.findByIdAndDelete(req.params.id)
        res.json({message:"User deleted successfully"});
    } catch (error) {
        console.error("Error in deleteNote controller");
        res.status(500).json({message: "Internal server error"});
    }
}