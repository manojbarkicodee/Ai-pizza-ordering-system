const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { config } = dotenv;
const {
  ConversationChain,
  ConversationalRetrievalQAChain,
} = require("langchain/chains");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder,
} = require("langchain/prompts");
const flatted = require("flatted"); // Import flatted
const {
  BufferMemory,
  ChatMessageHistory,
  ConversationTokenBufferMemory,
} = require("langchain/memory");
const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { CharacterTextSplitter } = require("langchain/text_splitter");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const {
  createStuffDocumentsChain,
} = require("langchain/chains/combine_documents");
config();
const fs = require("fs");
const { formatDocumentsAsString } = require("langchain/util/document");
const {
  RunnablePassthrough,
  RunnableSequence,
} = require("langchain/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { HumanMessage, AIMessage } = require("langchain/schema");

const app = express();
app.use(express.json());
app.use(cors());

const chat = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know."
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

// let vectorStore=new Chroma(new OpenAIEmbeddings(),{
//   collectionName: "new-pizza-data",
//     url: "http://localhost:9000", // Optional, will default to this value
//     collectionMetadata: {
//       "hnsw:space": "cosine",
//     }
// })


let vectorStore;
(async function () {
  vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
    collectionName: "new-pizza-data",
    url: "http://localhost:9000", // Optional, will default to this value
    collectionMetadata: {
      "hnsw:space": "cosine",
    }, // Optional, can be used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
  });
})();

async function askQuestionWithcreateRetrievalChain() {
  // await addTovectorStore()

  // const qaSystemPromptAi = `You are an assistant for pizza ordering system.
  // Use the following pieces of retrieved context stored in vector store and keep in chainning with chatHistory.
  // {context}`;
  // const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  //   ["system", qaSystemPromptAi],
  //   new MessagesPlaceholder("chat_history"),
  //   ["human", "{input}"],
  // ]);

  const qaSystemPromptAi = `You are an assistant for a pizza ordering system.Given a chat history and the latest user question which might reference context in the chat history, formulate a standalone question which can be understood without the chat history. Do NOT answer the question, just reformulate it if needed and otherwise return it as is.
  : {context}`;
  const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
    ["system", qaSystemPromptAi],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const setContext = [new HumanMessage("question"), new AIMessage(`output`)];
  // let datahistory = (await readData()) || [];
  // let memory = new BufferMemory({
  //   chatHistory: new ChatMessageHistory(datahistory),
  //   returnMessages: true,
  //   memoryKey: "history",
  //   inputKey: "question",
  //   outputKey: "output",
  // });

  let memory = new BufferMemory({
    memoryKey: "chat_history",
    inputKey: "question",
    outputKey: "output",
    returnMessages: true,
  });

  const combineDocsChain = await createStuffDocumentsChain({
    llm: chat,
    prompt: questionAnsweringPrompt,
    memory,
    outputParser: new StringOutputParser(),
  });
  // console.log(await memory.loadMemoryVariables({}));
  console.log(await memory.chatHistory.getMessages());
  // const response = await vectorStore.similaritySearch("what is the price of Hawaiian Pizza?", 1);

  // console.log(datahistory)
  // const chain = await createRetrievalChain({
  //   retriever: vectorStore.asRetriever(),
  //   // llm:chat,
  //   // chat_history: datahistory,
  //   memory,
  //   combineDocsChain,
  //   outputParser: new StringOutputParser(),
  //   returnDocuments: false,
  // });
  let newCahin = ConversationalRetrievalQAChain.fromLLM(
    (llm = chat),
    (retriever = vectorStore.asRetriever()),
    // llm:chat,
    // chat_history=datahistory,
    // memory,
    combineDocsChain,
    // outputParser=new StringOutputParser(),
    // returnDocuments=false
    {
      memory: memory,
    }
  );

  //   const result = await newCahin.invoke({
  //     question,chat_history:datahistory,
  // })
  // console.log(result,"result");
  // console.log( await memory.chatHistory.getMessages(),"chat history=====>")
  // // let question = "can you order this pizza for me";
  // let res = await chain.invoke({ input: question });
  // if (res) {
  //   // saveMemoryToFile()
  // }
  // console.log("results========>",result)

  // console.log("model==========>",memory)
  return [newCahin, memory];
  // // console.log((await memory.loadMemoryVariables())['history'])
  // let newdatahistory = await memory.chatHistory.getMessages();
  // datahistory.push(newdatahistory);
  // await writeData(datahistory);
  // return result;
  //  console.log(await memory.chatHistory.getMessages())
  // console.log(res,"response")
}

// const chain = new ConversationChain({
//   memory: new BufferMemory({ returnMessages: true, memoryKey: "history" }),
//   prompt: chatPrompt,
//   llm: chat,
// });
let caChain;
let caMemory;
(async () => {
  [caChain, caMemory] = await askQuestionWithcreateRetrievalChain();
})();
app.post("/api/chat", async (req, res) => {
  try {
    console.log("before", await caMemory.chatHistory.getMessages());
    let chat_history = await caMemory.chatHistory.getMessages();
    const question = req.body.input;
    // const response = await chain.call({ input: userInput });
    // let response = await askQuestionWithcreateRetrievalChain();
    const response = await caChain.call({ question, chat_history });
    console.log(response, "answer==========>");
    console.log(caMemory, "memory==========>");
    await caMemory.saveContext(
      { question: question },
      { output: response.text }
    );
    console.log("chat history=====>", await caMemory.chatHistory.getMessages());
    res.json({ message: response });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const readData = async () => {
  try {
    const jsonString = fs.readFileSync("conversation_history.json", "utf8");
    // console.log(jsonString);
    if (jsonString) {
      const data = JSON.parse(jsonString);
      return data;
      console.log("Array of objects:", data);
    } else {
      return [];
    }
  } catch (err) {
    console.error("Error reading file:", err);
    return [];
  }
};
const writeData = async (data) => {
  try {
    // console.log(data)
    const jsonData = flatted.stringify(data);
    fs.writeFileSync("conversation_history.json", jsonData);

    console.log("File has been written successfully.");
  } catch (err) {
    console.error("Error writing file:", err);
  }
};

app.use(express.static("frontend"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

//   const memoryFilePath = 'memory.json';
//   let memoryData = {};
// if (fs.existsSync(memoryFilePath)) {
//   memoryData = JSON.parse(fs.readFileSync(memoryFilePath, 'utf-8'));
// }

// const memory = new BufferMemory({
//   returnMessages: true,
//   memoryKey: "history",
//   initialMemory: memoryData.history || [],
// });

// // Save memory to file
// const saveMemoryToFile =async () => {
//   const currentMemory = await memory.loadMemoryVariables({});
//   console.log(currentMemory)
//   // fs.writeFileSync(memoryFilePath, JSON.stringify({ history: memory.chatHistory() }));
// };



// const { ChatAnthropic } = require( "@langchain/anthropic");