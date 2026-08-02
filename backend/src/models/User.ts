import mongoose, { Schema, Document } from "mongoose"
import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from 'uuid'

export interface IDiscoverLocation {
  lat: number
  lon: number
  /** Human-readable place name, shown so the user can tell where the results are centred. */
  label?: string
  source: 'browser' | 'ip' | 'manual'
}

export interface IUserPreferences {
  theme: string
  isPublic: boolean
  wideScreenMode: boolean
  language: string
  enableConditionGrading: boolean
  preferredCurrency: string
  /** Styles the user unchecked in Discover's upcoming releases. Empty = show all. */
  discoverExcludedStyles: string[]
  /** Last position used by the "near you" sections, so we don't re-prompt on every visit. */
  discoverLocation?: IDiscoverLocation
  /** Search radius shared by every "near you" section — shops and concerts alike. */
  discoverRadiusKm: number
}

export interface IUser extends Document<mongoose.Types.ObjectId> {
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
    preferredCurrency: {
      type: String,
      default: 'USD'
    },
    discoverExcludedStyles: {
      type: [String],
      default: []
    },
    discoverLocation: {
      type: new Schema<IDiscoverLocation>({
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
        label: { type: String },
        source: { type: String, enum: ['browser', 'ip', 'manual'], required: true }
      }, { _id: false }),
      default: undefined
    },
    discoverRadiusKm: {
      type: Number,
      default: 25
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