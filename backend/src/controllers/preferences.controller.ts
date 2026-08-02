import { Request, Response } from 'express';
import User from '../models/User';
import ExchangeRates from '../models/ExchangeRates';
import { logger } from '../config/logger.config';

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
        logger.error({ err: error }, "Error in getExchangeRates");
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
        logger.error({ err: error }, "Error in getPreferences controller");
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function updatePreferences(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { theme, isPublic, wideScreenMode, language, enableConditionGrading, preferredCurrency, discoverExcludedStyles, discoverLocation, discoverShopRadiusKm } = req.body;

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
        if (discoverExcludedStyles !== undefined) {
            if (!Array.isArray(discoverExcludedStyles) || discoverExcludedStyles.some((s) => typeof s !== 'string')) {
                res.status(400).json({ message: "discoverExcludedStyles must be an array of strings" });
                return;
            }
            user.preferences = { ...user.preferences, discoverExcludedStyles };
        }
        if (discoverLocation !== undefined) {
            // null clears a stored position (e.g. the user revokes the browser permission).
            if (discoverLocation === null) {
                user.preferences = { ...user.preferences, discoverLocation: undefined };
            } else {
                const { lat, lon, label, source } = discoverLocation || {};
                const validCoords = typeof lat === 'number' && lat >= -90 && lat <= 90
                    && typeof lon === 'number' && lon >= -180 && lon <= 180;
                if (!validCoords || !['browser', 'ip', 'manual'].includes(source)) {
                    res.status(400).json({ message: "discoverLocation must have valid lat, lon and source" });
                    return;
                }
                user.preferences = {
                    ...user.preferences,
                    discoverLocation: { lat, lon, label: typeof label === 'string' ? label : undefined, source }
                };
            }
        }
        if (discoverShopRadiusKm !== undefined) {
            if (!Number.isInteger(discoverShopRadiusKm) || discoverShopRadiusKm < 1 || discoverShopRadiusKm > 1000) {
                res.status(400).json({ message: "discoverShopRadiusKm must be an integer between 1 and 1000" });
                return;
            }
            user.preferences = { ...user.preferences, discoverShopRadiusKm };
        }

        await user.save();

        res.status(200).json({
            message: "Preferences updated successfully",
            preferences: user.preferences,
            publicShareId: user.preferences.isPublic ? user.publicShareId : null
        });
    } catch (error) {
        logger.error({ err: error }, "Error in updatePreferences controller");
        res.status(500).json({ message: "Internal server error" });
    }
}
