import { Model, Types, UpdateQuery } from 'mongoose';

// GEN-01, FLT-05, FLT-06: each user gets exactly one notification per event, even when the code that
// sends it can run twice (finishFlightCancellation() called again, or the Stripe reply and the
// webhook reporting the same refund status at the same moment). The first caller adds `key` to the
// document's `notified` list and gets true; every later caller finds it already there and gets
// false. MongoDB applies the update to one document atomically, so only one caller can win.
export async function claimNotification<T extends { notified: string[] }>(
  model: Model<T>,
  id: Types.ObjectId | string,
  key: string,
): Promise<boolean> {
  const result = await model.updateOne({ _id: id, notified: { $ne: key } }, {
    $addToSet: { notified: key },
  } as UpdateQuery<T>);
  return result.modifiedCount === 1;
}
