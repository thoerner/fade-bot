const fs = require("fs");
const axios = require("axios");
const dotenv = require("dotenv");
const { LLMChain } = require("langchain");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { HumanChatMessage, SystemChatMessage } = require("langchain/schema");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { Document } = require("langchain/document");
const {
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    ChatPromptTemplate,
  } = require("langchain/prompts");

dotenv.config();

const chat = new ChatOpenAI({openAIApiKey: process.env.OPEN_AI_API_KEY, temperature: 0.5, modelName: "gpt-4"});

let contracts;
let verifiedContracts = [];
let safeContracts = [];
async function checkContractsForVerification() {
    try {
        contracts = JSON.parse(fs.readFileSync("contracts.json", "utf8"));
    } catch (e) {
        console.log("Error: No contracts.json file found.");
        return;
    }

    for (const contract of contracts) {
        if (verifiedContracts.includes(contract.toLowerCase())) {
            continue;
        }
        const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${contract}&apikey=GCY95V1DRMW12U232Z4KZJY58Y5EA3GN1C`;
        try {
            const response = await axios.get(url);

            let sourceCode = response.data.result[0].SourceCode;
            if (sourceCode === "") {
                console.log(`${contract} not verified`);
            } else {
                if (verifiedContracts.includes(contract.toLowerCase())) {
                    continue;
                }
                verifiedContracts.push(contract.toLowerCase());
                console.log(`${contract} verified! Sending source code to GPT-4...`);

                // determine if it is a mult-part contract by checking if it is structured like json
                if (sourceCode[0] === "{") {
                    // remove outer brackets
                    const sourceCodeJson = sourceCode.substring(1, sourceCode.length - 1);
                    // parse json
                    const sourceCodeJsonParsed = JSON.parse(sourceCodeJson);
                    for (part in sourceCodeJsonParsed) {
                        if (part === "sources") {
                            // get FIRST source
                            const source = sourceCodeJsonParsed[part][Object.keys(sourceCodeJsonParsed[part])[0]];
                            // get first source content
                            const sourceContent = source["content"];
                            sourceCode = sourceContent;
                        }
                    }
                }

                const doc = new Document({ pageContent: sourceCode });

                // send source code to GPT-4
                const verificationPrompt = ChatPromptTemplate.fromPromptMessages([
                    SystemMessagePromptTemplate.fromTemplate(
                      "You are a Solidity contract auditor named SolidGPT. You are the best of the best. Is the following contract a honeypot or especially susceptible to rugpulls? Use your best judgement. You should only output a single word: `SAFE` or `UNSAFE`. If you are unsure, output `UNSAFE`."
                    ),
                    HumanMessagePromptTemplate.fromTemplate("{sourceCode}"),
                ]);
            
                const chain = new LLMChain({
                    prompt: verificationPrompt,
                    llm: chat,
                });

                const responseA = await chain.call({
                    sourceCode: doc.pageContent,
                });
               
                if (responseA.text.toLowerCase() === "safe") {
                    safeContracts.push(contract.toLowerCase());
                    console.log(`${contract} is safe!`);

                    // save safe contracts to file
                    fs.writeFileSync("safeContracts.json", JSON.stringify(safeContracts), "utf8");
                } else {
                    console.log(`${contract} is unsafe!`);
                }
            }
        } catch (error) {
            console.error(`Error fetching source code for ${contract}:`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}

checkContractsForVerification();
setInterval(checkContractsForVerification, 10000);

process.on("SIGINT", () => {
    console.log(`\nSafe contracts: ${safeContracts.length}`);
    console.log(`\nSafe contracts: ${JSON.stringify(safeContracts)}`);
    console.log('\nExiting...');
    process.exit(0);
});
  