import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import fs from "fs";
import pdf from "pdf-parse-new";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatGroq } from "@langchain/groq";
import { HfInference } from "@huggingface/inference";
import { Embeddings } from "@langchain/core/embeddings";

/* ================================
1️⃣ Load + Split Resume
================================ */

export async function loadResume(filePath) {
  const pdfBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(pdfBuffer);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  return await splitter.createDocuments([pdfData.text]);
}

/* ================================
2️⃣ Hugging Face Embeddings
================================ */

class HuggingFaceEmbeddings extends Embeddings {
  constructor() {
    super();

    this.client = new HfInference(process.env.HUGGINGFACE_API_KEY);
    this.model = "sentence-transformers/all-MiniLM-L6-v2";
  }

  async embedQuery(text) {
    const embedding = await this.client.featureExtraction({
      model: this.model,
      inputs: text,
    });

    return Array.isArray(embedding[0]) ? embedding[0] : embedding;
  }

  async embedDocuments(texts) {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}

function getEmbeddings() {
  return new HuggingFaceEmbeddings();
}

/* ================================
3️⃣ Pinecone Init
================================ */

export async function initVectorStore(namespace, docs = null) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  const embeddings = getEmbeddings();

  if (docs) {
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace,
    });
  }

  return PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace,
  });
}

/* ================================
4️⃣ Groq Models
================================ */

export function getAnswerModel() {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
  });
}

export function getMemoryModel() {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });
}