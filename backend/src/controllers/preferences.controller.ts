import { Request, Response } from 'express';
import User from '../models/User';
import ExchangeRates from '../models/ExchangeRates';

export async function getExchangeRates(req: Request, res: Response) {
    try {
        let exchangeRates = await ExchangeRates.findOne({ baseCurrency: 'USD' });
        
        // If no rates are cached or they are older than 24 hours (86400000 ms), we could schedule a fetch, but let's just return what we have and let the admin task or startup script fetch it.
        // Actually, if we don't have rates, we should return a sensible default map containing at least USD: 1.
        
        if (!exchangeRates) {
            // Default basic scaffold if nothing has synced yet
            const defaultRates = new Map<string, number>();
            defaultRates.set("USD", 1);
            defaultRates.set("EUR", 0.92);
            defaultRates.set("GBP", 0.79);
            defaultRates.set("CAD", 1.35);

            res.status(200).json({
                baseCurrency: 'USD',
                rates: Object.fromEntries(defaultRates),
                lastUpdated: new Date()
            });
            return;
        }

        res.status(200).json({
            baseCurrency: exchangeRates.baseCurrency,
            rates: Object.fromEntries(exchangeRates.rates),
            lastUpdated: exchangeRates.lastUpdated
        });
    } catch (error) {
        console.error("Error in getExchangeRates:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getPreferences(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const user = await User.findById(req.user._id).select('preferences publicShareId');
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            ...user.preferences,
            publicShareId: user.preferences?.isPublic ? user.publicShareId : null
        });
    } catch (error) {
        console.error("Error in getPreferences controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function updatePreferences(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { theme, isPublic, wideScreenMode, language, enableConditionGrading, preferredCurrency } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Update preferences
        if (theme !== undefined) {
            user.preferences = { ...user.preferences, theme };
        }
        if (isPublic !== undefined) {
            user.preferences = { ...user.preferences, isPublic };
        }
        if (wideScreenMode !== undefined) {
            user.preferences = { ...user.preferences, wideScreenMode };
        }
        if (language !== undefined) {
            user.preferences = { ...user.preferences, language };
        }
        if (enableConditionGrading !== undefined) {
            user.preferences = { ...user.preferences, enableConditionGrading };
        }
        if (preferredCurrency !== undefined) {
            user.preferences = { ...user.preferences, preferredCurrency };
        }

        await user.save();

        res.status(200).json({
            message: "Preferences updated successfully",
            preferences: user.preferences,
            publicShareId: user.preferences.isPublic ? user.publicShareId : null
        });
    } catch (error) {
        console.error("Error in updatePreferences controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
