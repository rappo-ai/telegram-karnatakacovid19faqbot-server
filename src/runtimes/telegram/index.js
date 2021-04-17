const queue = require('async/queue');
const { get: getObjectProperty } = require('lodash/object');
const logger = require('../../logger');

const { callTelegramApi } = require('../../utils/telegram');

const bots = {};

function addBot(username, secret, callbacks) {
  bots[username] = {
    secret,
    callbacks,
    queue: {}
  };
}

function getChatQueue(botUsername, botSecret, chatId) {
  return bots[botUsername] && bots[botUsername].secret === botSecret &&
    (bots[botUsername].queue[chatId] || (bots[botUsername].queue[chatId] = queue(processUpdate, 1)));
}

async function processUpdate(task, callback) {
  try {
    const chat_type = getObjectProperty(task, "update.message.chat.type") ||
      getObjectProperty(task, "update.my_chat_member.chat.type") ||
      getObjectProperty(task, "update.channel_post.chat.type");
    const chat_text = getObjectProperty(task, "update.message.text");
    const channel_text = getObjectProperty(task, "update.channel_post.text");
    const new_chat_members = getObjectProperty(task, "update.message.new_chat_members");
    const my_chat_member_new_status = getObjectProperty(task, "update.my_chat_member.new_chat_member.status");
    switch (chat_type) {
      case "private":
        if (chat_text === "/start") {
          await bots[task.botUsername].callbacks.onPMChatJoin(task.update);
        } else if (my_chat_member_new_status === "kicked") {
          await bots[task.botUsername].callbacks.onPMChatBlocked(task.update);
        } else if (chat_text) {
          await bots[task.botUsername].callbacks.onPMChatMessage(task.update);
        }
        break;

      case "group":
      case "supergroup":
        if (new_chat_members && new_chat_members.find(m => m.username === task.botUsername)) {
          await bots[task.botUsername].callbacks.onGroupChatJoin(task.update);
        } else if (my_chat_member_new_status === "left") {
          await bots[task.botUsername].callbacks.onGroupChatLeave(task.update);
        } else if (chat_text) {
          await bots[task.botUsername].callbacks.onGroupChatMessage(task.update);
        }
        break;

      case "channel":
        if (my_chat_member_new_status === "administrator") {
          await bots[task.botUsername].callbacks.onChannelJoin(task.update);
        } else if (my_chat_member_new_status === "left") {
          await bots[task.botUsername].callbacks.onChannelLeave(task.update);
        } else if (channel_text) {
          await bots[task.botUsername].callbacks.onChannelMessage(task.update);
        }
        break;

      default:
        break;
    }

  } catch (err) {
    if (callback) {
      callback(err);
    }
  }
}

async function sendMessage(chatId, messageText, botToken) {
  return callTelegramApi(
    'sendMessage',
    botToken,
    {
      chat_id: chatId,
      text: messageText,
    },
  );
}

addBot(process.env.TELEGRAM_WORKER_BOT_USERNAME, process.env.TELEGRAM_WORKER_BOT_SECRET, {
  onPMChatJoin: async function (update) {
    await sendMessage(update.message.chat.id, `begin private message chat with ${process.env.TELEGRAM_WORKER_BOT_USERNAME}`,
      process.env.TELEGRAM_WORKER_BOT_TOKEN);
  },
  onPMChatMessage: async function (update) {
    await sendMessage(update.message.chat.id, update.message.text,
      process.env.TELEGRAM_WORKER_BOT_TOKEN);
  },
  onPMChatBlocked: async function (update) {
    logger.info(`@${process.env.TELEGRAM_WORKER_BOT_USERNAME} blocked by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
  onGroupChatJoin: async function (update) {
    await sendMessage(update.message.chat.id, `begin group message chat with ${process.env.TELEGRAM_WORKER_BOT_USERNAME}`,
      process.env.TELEGRAM_WORKER_BOT_TOKEN);
  },
  onGroupChatMessage: async function (update) {
    await sendMessage(update.message.chat.id, update.message.text,
      process.env.TELEGRAM_WORKER_BOT_TOKEN);
  },
  onGroupChatLeave: async function (update) {
    logger.info(`@${process.env.TELEGRAM_WORKER_BOT_USERNAME} kicked in group ${update.my_chat_member.chat.title} | ${update.my_chat_member.chat.id} by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
  onChannelJoin: async function (update) {
    await sendMessage(update.my_chat_member.chat.id, `begin channel with ${process.env.TELEGRAM_WORKER_BOT_USERNAME}`,
      process.env.TELEGRAM_WORKER_BOT_TOKEN);
  },
  onChannelMessage: async function (update) {
    await sendMessage(update.channel_post.chat.id, `@${process.env.TELEGRAM_WORKER_BOT_USERNAME} says ${update.channel_post.text}`,
      process.env.TELEGRAM_WORKER_BOT_TOKEN);
  },
  onChannelLeave: async function (update) {
    logger.info(`@${process.env.TELEGRAM_WORKER_BOT_USERNAME} kicked in channel ${update.my_chat_member.chat.title} | ${update.my_chat_member.chat.id} by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
});

addBot(process.env.TELEGRAM_ADMIN_BOT_USERNAME, process.env.TELEGRAM_ADMIN_BOT_SECRET, {
  onPMChatJoin: async function (update) {
    await sendMessage(update.message.chat.id, `begin private message chat with ${process.env.TELEGRAM_ADMIN_BOT_USERNAME}`,
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onPMChatMessage: async function (update) {
    await sendMessage(update.message.chat.id, 'ADMIN! ' + update.message.text,
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onPMChatBlocked: async function (update) {
    logger.info(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} blocked by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
  onGroupChatJoin: async function (update) {
    await sendMessage(update.message.chat.id, `begin group message chat with ${process.env.TELEGRAM_ADMIN_BOT_USERNAME}`,
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onGroupChatMessage: async function (update) {
    await sendMessage(update.message.chat.id, 'ADMIN! ' + update.message.text,
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onGroupChatLeave: async function (update) {
    logger.info(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} kicked in group ${update.my_chat_member.chat.title} | ${update.my_chat_member.chat.id} by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
  onChannelJoin: async function (update) {
    await sendMessage(update.my_chat_member.chat.id, `begin channel with ${process.env.TELEGRAM_ADMIN_BOT_USERNAME}`,
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onChannelMessage: async function (update) {
    await sendMessage(update.channel_post.chat.id, `@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} says ${update.channel_post.text}`,
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onChannelLeave: async function (update) {
    logger.info(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} kicked in channel ${update.my_chat_member.chat.title} | ${update.my_chat_member.chat.id} by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
});

module.exports = {
  getChatQueue,
};
