import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    username: string;
    passwordHash: string;
    friends: mongoose.Types.ObjectId[];
    friendRequests: {
        incoming: mongoose.Types.ObjectId[];
        outgoing: mongoose.Types.ObjectId[];
    };
    stats: {
        wins: number;
        losses: number;
        draws: number;
    };
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    passwordHash: {
        type: String,
        required: true
    },
    friends: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    friendRequests: {
        incoming: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        outgoing: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    stats: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Avoid OverwriteModelError in hot-reload environments
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
