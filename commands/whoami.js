module.exports = {
    name: 'whoami',
    execute(message) {
        return message.reply(`You are ${message.author}`);
    }
};