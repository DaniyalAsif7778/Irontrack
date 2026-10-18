import { WellnessLog } from "../../models/wellness/wellness.model.js";

function recentDates(through: string, days: number) {
  const last = new Date(`${through}T12:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(last);
    date.setUTCDate(date.getUTCDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

export async function listWellness(ownerId: string, through: string, days: number) {
  const dates = recentDates(through, days);
  const records = await WellnessLog.find({ ownerId, date: { $in: dates } }).sort({ date: 1 }).lean();
  const byDate = new Map(records.map(record => [record.date, record]));
  return dates.map(date => {
    const record = byDate.get(date);
    return { date, waterGlasses: record?.waterGlasses ?? 0, movementBreaks: record?.movementBreaks ?? 0 };
  });
}

export function saveWellness(ownerId: string, date: string, data: { waterGlasses: number; movementBreaks: number }) {
  return WellnessLog.findOneAndUpdate({ ownerId, date }, { ...data, ownerId, date }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).select("date waterGlasses movementBreaks");
}
