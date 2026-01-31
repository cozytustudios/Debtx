// Local env config (gitignored). Fill in your own key.
// Loaded by index.html before app.js. Safe to keep blank values here.
window.__DEBTX_ENV = {
  // DeepSeek API key (DO NOT COMMIT)
  DEEPSEEK_API_KEY: "sk-754bb6539fad446eb7653fa44f68ec95",

  // Optional overrides
  DEEPSEEK_MODEL: "deepseek-chat",
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  DEEPSEEK_TIMEOUT_MS: 20000,
  DEEPSEEK_SYSTEM_PROMPT:
    "You are Debtx AI, a helpful assistant for Bangladeshi shopkeepers. " +
    "Keep replies short, clear, and practical. If the user asks to change data, " +
    "ask for missing details and confirm before saving.",
};
