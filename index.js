const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

// Web service active rakhne ke liye endpoint
app.get('/', (req, res) => {
    res.send('WhatsApp Bot Active Ho Gaya!');
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// 10-Minute Cooldown Map
const cooldowns = new Map();
const COOLDOWN_TIME = 10 * 60 * 1000; // 10 minutes

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        keepAliveIntervalMs: 10000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Connection closed (${statusCode}). Reconnecting...`, shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Session Logged Out! Please scan QR code again.');
            }
        } else if (connection === 'open') {
            console.log('WhatsApp Bot Active Ho Gaya!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];

            if (!msg || !msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') {
                return;
            }

            const sender = msg.key.remoteJid;
            const currentTime = Date.now();
            const lastReplyTime = cooldowns.get(sender) || 0;

            if (currentTime - lastReplyTime >= COOLDOWN_TIME) {
                cooldowns.set(sender, currentTime);

                const autoReplyText = 
`🤖 Hello! Main Boss ka personal bot hoon.
📩 Aapka message mil gaya hai.
👨‍💼 Mera Boss abhi online hai to woh aapko jaldi reply karega.
⏳ Agar abhi reply na mile, thoda wait kijiye.
🙏 Thank you for contacting us!`;

                await sock.sendMessage(sender, { text: autoReplyText });
                console.log(`[REPLY SENT] Auto reply sent to ${sender}`);
            } else {
                const remainingSec = Math.ceil((COOLDOWN_TIME - (currentTime - lastReplyTime)) / 1000);
                console.log(`[COOLDOWN ACTIVE] ${sender} ke liye ${remainingSec}s baki hain.`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
}

connectToWhatsApp();
              
