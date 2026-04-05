// === helper/timeSlots.js ===

/**
 * Converts a time string like "2:30 PM" into a Date object for a given baseDate
 */
function toDate(timeStr, baseDate = new Date()) {
  if (!timeStr) throw new Error("timeStr is required");

  const [timePart, modifier] = timeStr.trim().split(/\s+/);
  let [hours, minutes] = timePart.split(":").map(Number);

  if (modifier.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (modifier.toUpperCase() === "AM" && hours === 12) hours = 0;

  const date = new Date(baseDate);
  date.setHours(hours, minutes || 0, 0, 0); // Reset seconds and ms
  return date;
}

/**
 * Formats a Date object to 12-hour format with AM/PM
 */
function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const modifier = hours >= 12 ? "PM" : "AM";

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${hours}:${paddedMinutes} ${modifier}`;
}

/**
 * Generate time slots between startTimeStr and endTimeStr with interval in minutes
 * Example: generateTimeSlots("9:00 AM", "12:00 PM", 15)
 */
export const generateTimeSlots = (
  startTimeStr,
  endTimeStr,
  intervalMinutes = 10,
  baseDate = new Date()
) => {
  if (!startTimeStr || !endTimeStr)
    throw new Error("startTimeStr and endTimeStr are required");

  const slots = [];
  let current = toDate(startTimeStr, baseDate);
  const end = toDate(endTimeStr, baseDate);

  if (current >= end) return slots; // no slots if start >= end

  while (current < end) {
    slots.push(formatTime(new Date(current)));
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }

  return slots;
}

/**
 * Converts a time string like "2:30 PM" to total minutes since midnight
 */
export const convertToMinutes = (timeStr) =>     {
  if (!timeStr) throw new Error("timeStr is required");

  const [timePart, meridian] = timeStr.trim().split(/\s+/);
  let [hour, minute] = timePart.split(":").map(Number);

  if (meridian.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (meridian.toUpperCase() === "AM" && hour === 12) hour = 0;

  return hour * 60 + (minute || 0);
}

export default { generateTimeSlots, convertToMinutes, toDate, formatTime };