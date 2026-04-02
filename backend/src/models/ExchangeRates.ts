import mongoose, { Schema, Document } from "mongoose";

export interface IExchangeRates extends Document {
  baseCurrency: string;
  rates: Map<string, number>;
  lastUpdated: Date;
}

const exchangeRatesSchema = new Schema<IExchangeRates>({
  baseCurrency: {
    type: String,
    required: true,
    default: "USD",
  },
  rates: {
    type: Map,
    of: Number,
    required: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

const ExchangeRates = mongoose.model<IExchangeRates>("ExchangeRates", exchangeRatesSchema);

export default ExchangeRates;
