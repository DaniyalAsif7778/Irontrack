import { WeightLog } from "../../models/weight/weight.model.js";

export const listWeights = (ownerId: string) => WeightLog.find({ ownerId }).sort({ date: -1 });

export function saveWeight(ownerId: string, data: { date: string; weight: number; unit: string }) {
  return WeightLog.findOneAndUpdate({ ownerId, date: data.date }, { ...data, ownerId }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
}

export function updateWeight(ownerId: string, id: string, data: { date: string; weight: number; unit: string }) {
  return WeightLog.findOneAndUpdate({ _id: id, ownerId }, data, { new: true, runValidators: true });
}

export const deleteWeight = (ownerId: string, id: string) => WeightLog.findOneAndDelete({ _id: id, ownerId });
