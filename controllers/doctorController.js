import DutyRosterDoctor from "../models/dutyRosterDoctor.js";

export const getAvailableDoctors = async (req, res) => {
  try {
    const now = new Date();

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const today = days[now.getDay()];

    // convert current time to minutes
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr) => {
      const [time, modifier] = timeStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);

      if (modifier === "pm" && hours !== 12) hours += 12;
      if (modifier === "am" && hours === 12) hours = 0;

      return hours * 60 + minutes;
    };

    const doctors = await DutyRosterDoctor.find({
      day: today,
    }).populate("doctor");

    // filter by real time
    const availableDoctors = doctors.filter((doc) => {
      const start = parseTime(doc.startTime);
      const end = parseTime(doc.endTime);

      return currentTime >= start && currentTime <= end;
    });

    res.json(availableDoctors);
  } catch (err) {
    // console.log(err);
    res.status(500).json({ msg: "Error fetching doctors" });
  }
};