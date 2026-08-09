import { initChatModel } from "langchain";
import dotenv from "dotenv";

dotenv.config();

const model = await initChatModel(
  "groq:llama-3.3-70b-versatile",
  {
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0.2,
  }
);

export default model;