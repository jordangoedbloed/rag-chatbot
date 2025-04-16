import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { AzureChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { FaissStore } from "@langchain/community/vectorstores/faiss";


// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "..", "public"))); // Fr ontend

// Setup model + embeddings
const model = new AzureChatOpenAI({
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  temperature: 0.7,
});

const embeddings = new OpenAIEmbeddings({
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
});

// Prepare vectorstore
async function prepareData() {
  const loader = new TextLoader(path.resolve(__dirname, "documents", "voorbeeld.txt"));
  const rawDocs = await loader.load();
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
  const splitDocs = await splitter.splitDocuments(rawDocs);
  const vectorstore = await FaissStore.fromDocuments(splitDocs, embeddings);
  await vectorstore.save(path.resolve(__dirname, "..", "faiss_index"));
}

// Vraag stellen aan RAG
async function askQuestion(question) {
  const indexPath = path.resolve(__dirname, "..", "faiss_index");

  if (!fs.existsSync(indexPath)) {
    await prepareData();
  }

  const vectorstore = await FaissStore.load(indexPath, embeddings);
  const relevantDocs = await vectorstore.similaritySearch(question, 3);
  const context = relevantDocs.map(d => d.pageContent).join("\n---\n");

  const prompt = `
Je bent een behulpzame expert. Gebruik deze informatie om de vraag te beantwoorden:
${context}

Vraag: ${question}
Antwoord in het Nederlands.
`;

  const response = await model.invoke(prompt);
  return response.content;
}

// API route
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    const answer = await askQuestion(question);
    res.json({ answer });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Er ging iets mis." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server draait op http://localhost:${PORT}`));
