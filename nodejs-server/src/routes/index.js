// index.js

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { SessionsClient } = require('@google-cloud/dialogflow-cx');

// Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Dialogflow CX Setup
const dfClient = new SessionsClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }
});

const projectId = process.env.GOOGLE_PROJECT_ID;
const location = process.env.DIALOGFLOW_LOCATION;
const agentId = process.env.DIALOGFLOW_AGENT_ID;
const languageCode = 'en';

// Util: Detect intent from Dialogflow
async function detectIntentFromDialogflowCX(sessionId, text) {
  const sessionPath = dfClient.projectLocationAgentSessionPath(
    projectId,
    location,
    agentId,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: text
      },
      languageCode: languageCode
    }
  };

  const [response] = await dfClient.detectIntent(request);

  const messages = response.queryResult.responseMessages
    .filter(m => m.text?.text?.length > 0)
    .map(m => m.text.text[0]);

  return messages.join('\n');
}

// Bot Event: When Ready
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Bot Event: On Message
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore other bots

  try {
    const sessionId = message.author.id; // Unique session per user
    const userText = message.content;

    // Send user message to Dialogflow CX
    const botReply = await detectIntentFromDialogflowCX(sessionId, userText);

    // Send the agent's response back to Discord
    if (botReply) {
      await message.channel.send(botReply);
    } else {
      await message.channel.send("I'm not sure how to respond to that.");
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await message.channel.send("Sorry, something went wrong talking to my brain.");
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
