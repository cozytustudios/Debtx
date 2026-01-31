import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: 'sk-754bb6539fad446eb7653fa44f68ec95',
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: "You are a helpful assistant." }],
    model: "deepseek-chat",
  });

  console.log(completion.choices[0].message.content);
}

main().catch((error) => {
  console.error("DeepSeek request failed:", error?.message || error);
  process.exitCode = 1;
});
