const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 WhatsApp Bot is running 24/7!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// --- WhatsApp Bot Code Starts Here ---
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const usersFile = './users.json';
if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({}));
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 Neeche diye gaye QR Code ko apne WhatsApp se scan karein:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot successfully WhatsApp se connect ho gaya hai!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const sender = m.key.remoteJid;
        const messageType = Object.keys(m.message)[0];
        
        let text = '';
        if (messageType === 'conversation') {
            text = m.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            text = m.message.extendedTextMessage.text;
        }

        const args = text.trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const query = args.join(' ');

        if (m.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([m.key]);
            console.log('👁️ Status dekha gaya aur auto-read ho gaya!');
            return;
        }

        if (command === '.setname') {
            if (!query) {
                await sock.sendMessage(sender, { text: '❌ Meherbani karke apna naam likhein. Misal ke tor par: `.setname Ali`' });
                return;
            }
            let users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            users[sender] = query;
            fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
            await sock.sendMessage(sender, { text: `✅ Naam successfully set ho gaya hai: *${query}*` });
            return;
        }

        if (command === 'menu' || command === '.menu') {
            let users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            let userName = users[sender] || 'Dost';

            let menuText = `╭━━━✦ *WELCOME TO ${userName.toUpperCase()}* ✦━━━╮\n\n`;
            menuText += `🤖 *Bot Commands List:*\n\n`;
            menuText += `👉 \`.setname [Aapka Naam]\` - Apna naam set karein\n`;
            menuText += `👉 \`.play [Song Name]\` - Song search karne ke liye\n`;
            menuText += `👉 \`.reminder [Time] [Task]\` - Reminder set karne ke liye\n\n`;
            menuText += `╰━━━━━━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(sender, { text: menuText });
            return;
        }

        if (command === '.play') {
            if (!query) {
                await sock.sendMessage(sender, { text: '❌ Song ka naam likhein. Misal ke tor par: `.play Atif Aslam`' });
                return;
            }
            await sock.sendMessage(sender, { text: `🔍 Searching for *"${query}"*...` });
            return;
        }

        if (command === '.reminder') {
            await sock.sendMessage(sender, { text: `⏰ Reminder feature jald hi fully active ho jaye ga!` });
            return;
        }
    });
}

connectToWhatsApp();