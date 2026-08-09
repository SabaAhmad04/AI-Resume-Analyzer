/**********************************************************************
 * Conversational Resume RAG
 * Groq + HuggingFace Embeddings + Pinecone
 **********************************************************************/

import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import fs from "fs";
import readline from "readline";
import pdf from "pdf-parse-new";

import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { ChatGroq } from "@langchain/groq";

/* =========================
1️⃣ Load Resume
========================= */

const pdfBuffer = fs.readFileSync("./Arsh_cv_R1.pdf");
const pdfData = await pdf(pdfBuffer);
const resumeText = pdfData.text;

/* =========================
2️⃣ Split Resume
========================= */

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

const docs = await splitter.createDocuments([resumeText]);

/* =========================
3️⃣ HuggingFace Embeddings (384 Dimensions)
========================= */

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HUGGINGFACE_API_KEY,
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

const testVector = await embeddings.embedQuery("hello world");
console.log("Embedding Dimension:", testVector.length);

/* =========================
4️⃣ Pinecone Setup
========================= */

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

console.log("✅ Pinecone Connected");

const indexes = await pinecone.listIndexes();
console.log(indexes);

const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex: index,
  namespace: "test-user",
});

let stats;

try {
  stats = await index.describeIndexStats();
} catch (err) {
  console.error("❌ Pinecone Connection Failed");
  process.exit(1);
}

if (!stats.namespaces?.["test-user"]) {
  console.log("Uploading Resume...");

  await PineconeStore.fromDocuments(docs, embeddings, {
    pineconeIndex: index,
    namespace: "test-user",
  });

  console.log("✅ Resume Uploaded");
}

const retriever = vectorStore.asRetriever({
  k: 5,
});

/* =========================
5️⃣ Groq Models
========================= */

const memoryModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0,
});

const answerModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
});

let conversationSummary = "";

/* =========================
6️⃣ CLI Chat
========================= */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n🎓 Resume Assistant Ready!");
console.log("Type 'exit' to quit.\n");

async function askQuestion() {
  rl.question("You: ", async (question) => {
    if (question.toLowerCase() === "exit") {
      rl.close();
      process.exit(0);
    }

    try {
      let relevantDocs;

      try {
        relevantDocs = await retriever.invoke(question);
      } catch (err) {
        console.log("⚠️ Pinecone temporarily unavailable. Retrying...");

        await new Promise((resolve) => setTimeout(resolve, 3000));

        relevantDocs = await retriever.invoke(question);
      }

      const resumeContext = relevantDocs
        .map((doc) => doc.pageContent)
        .join("\n");

      const answerPrompt = `
You are an intelligent AI career assistant.

Conversation Summary:
${conversationSummary}

Resume Context:
${resumeContext}

User Question:
${question}

Rules:
- If the question is about the resume, answer strictly using the resume context.
- If it is a study-related question, explain clearly and relate it to the resume if possible.
- If it is unrelated, answer normally.
- Keep answers structured and concise.
`;

      const answerResponse = await answerModel.invoke(answerPrompt);

      const answer = answerResponse.content;

      console.log("\nAssistant:\n");
      console.log(answer);
      console.log();

      const summaryPrompt = `
Update the conversation summary.

Previous Summary:
${conversationSummary}

User:
${question}

Assistant:
${answer}

Return only the updated summary.
`;

      const summaryResponse = await memoryModel.invoke(summaryPrompt);

      conversationSummary = summaryResponse.content;
    } catch (err) {
      console.error("❌ Error:", err.message);
    }

    askQuestion();
  });
}

askQuestion();