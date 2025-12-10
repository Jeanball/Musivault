import mongoose, { Schema, Document } from "mongoose"
import bcrypt from "bcryptjs"

export interface IUserPreferences {
  theme: string
}

export interface IUser extends Document {
  username: string
  email: string
  password: string
  isAdmin: boolean
  preferences: IUserPreferences
  createdAt: Date
  lastLogin?: Date
  comparePassword(password: string): Promise<boolean>
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  preferences: {
    theme: {
      type: String,
      default: 'dark'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: null
  }
})

userSchema.pre<IUser>("save", async function (next) {

  if (!this.isModified("password")) {
    return next()
  }

  try {

    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {

    if (error instanceof Error) {
      next(error);
    } else {
      next(new Error('An unknown error occurred during password hashing'));
    }
  }
})

userSchema.methods.comparePassword = function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}


const User = mongoose.model<IUser>("User", userSchema)

export default User