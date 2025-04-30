// server.js

require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const app = express();

// === Your website stuff (pages, APIs, etc.) ===
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Website Home Page!');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
});

// === Start the Discord Bot ===
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

const dfClient = new SessionsClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  apiEndpoint: 'europe-west2-dialogflow.googleapis.com'
});

const projectId = process.env.GOOGLE_PROJECT_ID;
const location = process.env.DIALOGFLOW_LOCATION;
const agentId = process.env.DIALOGFLOW_AGENT_ID;
const languageCode = 'en';

// Detect Intent from Dialogflow CX
async function detectIntent(sessionId, text) {
  const sessionPath = dfClient.projectLocationAgentSessionPath(
    projectId,
    location,
    agentId,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: { text: text },
      languageCode: languageCode
    }
  };

  const [response] = await dfClient.detectIntent(request);

  const messages = response.queryResult.responseMessages
    .filter(m => m.text?.text?.length > 0)
    .map(m => m.text.text[0]);

  return messages.join('\n');
}

discordClient.once('ready', () => {
  console.log(`🤖 Discord bot logged in as ${discordClient.user.tag}`);
});

discordClient.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    const userText = message.content;
    const sessionId = message.author.id;

    // Add credential check logging
    console.log('Checking credentials...');
    console.log('Project ID:', projectId ? 'Set' : 'Missing');
    console.log('Location:', location ? 'Set' : 'Missing');
    console.log('Agent ID:', agentId ? 'Set' : 'Missing');
    
    const botReply = await detectIntent(sessionId, userText);

    if (botReply) {
      await message.channel.send(botReply);
    } else {
      await message.channel.send("🤔 I didn't quite catch that. Could you rephrase?");
    }
  } catch (error) {
    console.error('Discord Bot Error Details:', {
      message: error.message,
      stack: error.stack,
      projectId,
      location,
      agentId
    });
    await message.channel.send("⚡ Oops, something went wrong on my end.");
  }
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Bot shutting down...');
  
  try {
    // Set status to invisible before disconnecting
    await discordClient.user?.setStatus('invisible');
    
    // Destroy the client connection
    await discordClient.destroy();
    
    console.log('Bot successfully disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Modify the login to handle errors
discordClient.login(process.env.DISCORD_TOKEN)
  .catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
  });
