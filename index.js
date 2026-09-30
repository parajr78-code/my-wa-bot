const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

// Render Web Service keeping alive
app.get('/', (req, res) => {
    res.send('WhatsApp Bot Active Ho Gaya!');
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Cooldown Track Map (10 Minutes)
const cooldowns = new Map();
const COOLDOWN_TIME = 10 * 60 * 1000; // 10 Minutes in ms

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        keepAliveIntervalMs: 10000, // Socket freeze hone se bachane ke liye (10s ping)
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
    });

    // Save session credentials
    sock.ev.on('creds.update', saveCreds);

    // Connection Status Monitor
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Connection closed (Reason: ${statusCode}). Reconnecting...`, shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Session Logged Out! Please scan QR code again.');
            }
        } else if (connection === 'open') {
            console.log('WhatsApp Bot Active Ho Gaya!');
        }
    });

    // Message Event Listener
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];

            // Ignore empty messages, status broadcasts, or messages sent by the bot itself
            if (!msg || !msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') {
                return;
            }

            const sender = msg.key.remoteJid;
            const currentTime = Date.now();
            const lastReplyTime = cooldowns.get(sender) || 0;

            // 10-Minute Cooldown Check
            if (currentTime - lastReplyTime >= COOLDOWN_TIME) {
                // Cooldown update
                cooldowns.set(sender, currentTime);

                // Aapka Custom Auto-Reply Message
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
                console.log(`[COOLDOWN ACTIVE] ${sender} ke liye ${remainingSec}s baki hain. Reply skip kiya.`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
}

// Start Bot Connection
connectToWhatsApp();
            
