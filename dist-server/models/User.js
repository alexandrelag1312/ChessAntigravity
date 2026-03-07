import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
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
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
