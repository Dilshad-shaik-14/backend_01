import mongoose, { Schema } from 'mongoose';

const subscriptionSchema = new Schema(
    {
        subscriber: {
            type: Schema.Types.ObjectId, // The user who is subscribing
            ref: 'User',
            required: true,
        },
        channel: {
            type: Schema.Types.ObjectId, // The channel being subscribed to
            ref: 'User',
            required: true,
        },
        isSubscribed: {
            type: Boolean, // Indicates if the subscription is active
            default: true,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

// Ensure a user can only subscribe to a channel once
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);