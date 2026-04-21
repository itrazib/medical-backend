import { askGroq } from "../config/aiService.js";

export const chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        reply: "Message required",
        emergency: false,
      });
    }

    const result = await askGroq(message);

    res.json(result);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      reply: "Server error",
      emergency: false,
    });
  }
};