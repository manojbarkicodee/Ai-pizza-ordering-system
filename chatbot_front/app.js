let userMessage;
let botResponse;

const sendChatButton = document.querySelector(".btn-send");
const inputValue = document.querySelector(".user_text");
const chatBody = document.querySelector(".chatbody");
const form=document.querySelector("form");

const createUserElement = (message) => {
  const client = document.createElement("div");
  const userEl = document.createElement("div");
  client.classList.add("user-chat");
  userEl.classList.add("user-message");
  userEl.innerText = message;
  client.appendChild(userEl);
  return client;
};

const createBotElement = (message) => {
  const botElem = document.createElement("div");
  const botRes = document.createElement("div");
  const botText = document.createElement("p");
  botText.classList.add("bot-response");
  botText.innerText = message;
  botElem.classList.add("bot-chat");
  botRes.classList.add("bot-message");
  botRes.appendChild(botText);
  botElem.appendChild(botRes);
  return botElem;
};

const handleClick = () => {
  userMessage = inputValue.value.trim();
  if (!userMessage) return;
  inputValue.value = "";
  console.log(userMessage);

  chatBody.appendChild(createUserElement(userMessage));

  setTimeout(() => {
    const clientChat = createBotElement("Thinking...");
    chatBody.appendChild(clientChat);
    chatBody.scrollTo(0, chatBody.scrollHeight);
    getResponse(clientChat);
  }, 600);
};

form.addEventListener("submit", (e) => {

  e.preventDefault();
  console.log(e)
  handleClick();
});

inputValue.addEventListener("keypress",(e)=>{

  if(e.key==="Enter"&&!e.shiftKey){
    e.preventDefault()
    handleClick()
  }
  console.log(e.key,"evebt==========>")
})

const getResponse = (clientElem) => {
  const API_URL = "http://localhost:3000/api/chat";
  const messageElem = clientElem.querySelector("p");
  const requestHeaders = {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: userMessage,
    }),
  };
  fetch(API_URL, requestHeaders)
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      messageElem.textContent="";
      let messages=data.message.split("\n")
      console.log(messages)
      let ul=document.createElement("ul")

      messages.forEach((message)=>{
        if(message){
          let li=document.createElement("li")
          li.style.lineHeight="20px"
          li.textContent=message;
          ul.append(li)
        }else{
          let br=document.createElement("br")
          ul.append(br);
        }

      })
      messageElem.append(ul)
      // messageElem.textContent = data.message;
    })
    .catch((error) => {
      messageElem.textContent = "Something wrong happen, try again";
    })
    .finally(() => chatBody.scrollTo(0, chatBody.scrollHeight));
};
