const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");
const {
  createStuffDocumentsChain,
} = require("langchain/chains/combine_documents");
const {
  createHistoryAwareRetriever,
} = require("langchain/chains/history_aware_retriever");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const path = require('path');
const {
  BufferMemory,
  ChatMessageHistory,
} = require("langchain/memory");
const flatted = require("flatted");
const dotenv = require("dotenv");
const cors = require("cors");
const express = require("express");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { config } = dotenv;
config();

const app = express();
app.use(express.json());
app.use(cors());
let vectorStrore = new Chroma(new OpenAIEmbeddings(), {
  collectionName: "new-pizza-data",
  url: "http://0.0.0.0:8000", // Optional, will default to this value
  collectionMetadata: {
    "hnsw:space": "cosine",
  }
});

let retriever;
let ragChain;
let memory = new BufferMemory({
  chatHistory: new ChatMessageHistory([]),
  memoryKey: "chat_history",
  inputKey: "question",
  outputKey: "output",
  returnMessages: true,
});
let chat_history;



const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});


async function addTovectorStore() {
  const loader = new DirectoryLoader("pizza_data", {
    ".txt": (path) => new TextLoader(path),
  });
  const pages = await loader.load();

  let text_splitter = new RecursiveCharacterTextSplitter(
    (separator = "\n"),
    (chunk_size = 1000),
    (chunk_overlap = 50)
  );

  let docs = await text_splitter.splitDocuments(pages);

  // let docs = [
  //   {
  //     pageContent: `Extra Toppings Available: Mushrooms at $1.00, Onions at $0.75, Green Peppers at $1.00, Extra Cheese at $1.50.`,
  //     metadata: {
  //       speaker: "Extra Toppings",
  //     },
  //   },
  //   {
  //     pageContent: `Juices Available: Apple Juice at $2.00, Orange Juice at $2.00, Grape Juice at $2.50, Pineapple Juice at $2.50.
  //     `,
  //     metadata: {
  //       speaker: "Juices",
  //     },
  //   },
  //   {
  //     pageContent: `Offers are: For small (S) and medium (M) sizes, buy 2 and get 1 pizza free. For large (L) and extra-large (XL) sizes, buy 2 and get 2 pizzas free.
  //     `,
  //     metadata: {
  //       speaker: "Offers",
  //     },
  //   },
  // ];
  await vectorStrore.addDocuments(docs);

}

(async () => {
  vectorStrore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
    collectionName: "new-pizza-data",
    url: "http://0.0.0.0:8000",
    collectionMetadata: {
      "hnsw:space": "cosine",
    },
  });
  console.log((await vectorStrore.collection.get()).ids.length);
  retriever = vectorStrore.asRetriever();
  // Contextualize question
  const contextualizeQSystemPrompt = `
Given a chat history and the latest user question
which might reference context in the chat history,
formulate a standalone question which can be understood
without the chat history. Do NOT answer the question, just
reformulate it if needed and otherwise return it as is.`;
  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    ["system", contextualizeQSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);
  const historyAwareRetriever = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: contextualizeQPrompt,
  });
  // const qaSystemPrompt = `
  // You are an question and answering assistant for pizza ordering system. Use
  // the following pieces of retrieved context to answer the
  // question. If you don't know the answer, just say that you
  // don't know. and don't answer unrelated to pieces of retrieved context.
  // \n\n
  // {context}`;
  // Answer question
  const qaSystemPrompt = `
  You are an assistant for a pizza ordering system, and your goal is to use the provided context to ask relevant questions and provide accurate responses to pizza-related queries. If you don't know the answer, say
  so clearly and avoid providing unrelated information, Your task is to gather all necessary details for a pizza order accurately and efficiently. Here's how to proceed:

  Greeting and Pizza Size Selection:
  
  Warmly greet the customer and inquire about their desired pizza size. Offer options: Small, Medium, Large, or Extra-Large.
  Crust Selection:
  
  Once the size is selected, ask the customer about their preferred type of crust. Options include Thin, Thick, Stuffed, or Gluten-Free.
  Category Selection:

  Once the crust selected, ask the customer about their preferred type category or show available categories.
  Quantity and Specials:
  
  After selecting the category, inquire about the quantity of pizzas the customer wants.
  Pizza Selection:
  
  Ask if the customer has a specific pizza in mind or if they prefer one of our specialties like Margherita or Pepperoni.
  Extra Toppings, Cheese, and Sauce Selection:
  
  Confirm the pizza selection and inquire about extra toppings desired and available. Also, ask about cheese preference (Mozzarella, Cheddar, Parmesan, Vegan) and sauce choice (Tomato, Alfredo, BBQ, Pesto).
  Additional Items:
  
  Offer additional items such as sides, drinks, juices, extra origins, extra cheese if available and also inquire about the quantity of items the customer wants and charge extra money for that items.
  Confirmation:
  
  Summarize the order for confirmation. Ensure all details are accurate and display a detailed order summary with accurate calcualtions of order before proceeding and confirmation by customer.
  Delivery and Payment Details:
  
  Collect delivery address and contact number. Confirm the preferred payment method (cash, card, online).
  Payment Method Confirmation:
  
  Confirm the payment method provided by the customer.
  Estimated Delivery/Pickup Time:
  
  Provide an estimated delivery/pickup time based on the customer's location.
  Bill Generation:
  
  Generate a bill for the order. Offer to share it with the customer if requested.
  Thanking the Customer:
  
  Finally, thank the customer for their order and wish them a great day.
  Ensure to avoid providing unrelated information and to be polite, patient, and clear in your language throughout the interaction. Note any allergies or dietary restrictions mentioned by the customer and handle any uncertainties by informing them that you'll check with a manager. If any requested item is not available or unclear, politely inform the customer.
\n\n
{context}`;
  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", qaSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

 
  const questionAnswerChain = await createStuffDocumentsChain({
    llm,
    prompt: qaPrompt,
    outputParser: new StringOutputParser(),
  });

  ragChain = await createRetrievalChain({
    retriever: historyAwareRetriever,
    combineDocsChain: questionAnswerChain,
  });
})();

app.use(express.static(path.join(__dirname, 'chatbot_front')));

app.get("/",async(req,res)=>{
  try{
    res.sendFile(path.join(__dirname, 'chatbot_front', 'index.html'));
  }catch(error){
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
})

app.post("/api/chat", async (req, res) => {
  try {
    const question = req.body.input;
    chat_history = await memory.chatHistory.getMessages();
    const response = await ragChain.invoke({
      chat_history,
      input: question,
    });
    const jsonData = flatted.stringify(response);
    const newres = JSON.parse(jsonData);

    await memory.saveContext({ question: question }, { output: newres[4] });
    console.log(newres);
    res.json({ message: newres[4] });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/addDoc", async (req, res) => {
  try {
    await addTovectorStore();
    res.status(200).json({ message: "Added to vector store" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
    console.log(error);
  }
});

app.use(express.static("frontend"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
