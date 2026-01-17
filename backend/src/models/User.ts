import mongoose, { Schema, Document } from "mongoose"
import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from 'uuid'

export interface IUserPreferences {
  theme: string
  isPublic: boolean
  wideScreenMode: boolean
  language: string
  enableConditionGrading: boolean
  hasSeenWelcome: boolean
}

export interface IUser extends Document {
  username: string
  email: string
  displayName?: string
  password?: string
  isAdmin: boolean
  preferences: IUserPreferences
  publicShareId: string
  createdAt: Date
  lastLogin?: Date
  authProvider: 'local' | 'oidc'
  authId?: string
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
  displayName: {
    type: String,
    default: '',
  },
  password: {
    type: String,
    required: function (this: IUser) {
      return this.authProvider === 'local'
    },
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  preferences: {
    theme: {
      type: String,
      default: 'dark'
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    wideScreenMode: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      default: 'en'
    },
    enableConditionGrading: {
      type: Boolean,
      default: false
    },
    hasSeenWelcome: {
      type: Boolean,
      default: false
    }
  },
  publicShareId: {
    type: String,
    unique: true,
    sparse: true,
    default: () => uuidv4()
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: null
  },
  authProvider: {
    type: String,
    enum: ['local', 'oidc'],
    default: 'local'
  },
  authId: {
    type: String,
    sparse: true,
    unique: true
  }
})

userSchema.pre<IUser>("save", async function (next) {
  // Skip password hashing for OIDC users or if password not modified
  if (!this.isModified("password") || !this.password) {
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
  if (!this.password) {
    return Promise.resolve(false)
  }
  return bcrypt.compare(candidatePassword, this.password)
}


const User = mongoose.model<IUser>("User", userSchema)

export default User