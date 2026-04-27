module.exports = {
    name: 'whoareyou',
    execute(message) {
        return message.reply("I am a Discord-based bot created by Adam Abo Atieh that automatically monitors live sessions, tracks attendance through voice channel activity, and evaluates engagement using message-based participation signals. At the end of each session, I may generate a structured summary highlighting attendance, engagement levels, and top contributors, providing instructors with a clear and immediate overview of session dynamics.");
    }
};