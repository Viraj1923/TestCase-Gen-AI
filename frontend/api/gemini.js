
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateTestSummaries(fileContents) {
    const prompt = `
You are an AI Test Case Generator.
Given these code files, suggest concise summaries of possible test cases.
Focus on unit testing with a common framework (like Jest for JS, PyTest for Python).
Return the result as a numbered list, each item short and clear.

Code Files:
${fileContents.map(f => `File: ${f.file}\n${f.content}`).join("\n\n")}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

async function generateTestCode(summary) {
    const prompt = `
You are an AI Test Case Generator.
Generate the full test case code for the following summary:
"${summary}"

Write clean, runnable code with explanations as comments.
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

module.exports = {
    generateTestSummaries,
    generateTestCode,
};
