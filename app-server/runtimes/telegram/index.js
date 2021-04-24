const queue = require('async/queue');
const { get: getObjectProperty } = require('lodash/object');

const logger = require('../../logger');
const { callRasaApi } = require('../../utils/rasa');
const { sendMessage, copyMessage, leaveChat } = require('../../utils/telegram');

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

let admin_group_chat_id = -533125184;

const samples = [];
const sample_message_map = {};
const responses = {};
let labels = {};
function addSample(text) {
  samples.push(text);
  return samples.length - 1;
}
function linkSampleToMessage(message_id, sample_id) {
  sample_message_map[message_id] = sample_id;
}
function isIntent(text) {
  const re = new RegExp(/^#\w+$/);
  return re.test(text.trim())
}
function getIntent(text) {
  return text.trim();
}
async function onAdminGroupChatMessage(update) {
  if (isIntent(update.message.text)) {
    const intent = getIntent(update.message.text);
    if (update.message.reply_to_message) {
      const sample_id = sample_message_map[update.message.reply_to_message.message_id];
      if (sample_id) {
        // labeling
        labels[sample_id] = intent;
        await sendMessage({
          chat_id: update.message.chat.id, text: `Label changed to ${intent}`,
          reply_to_message_id: update.message.reply_to_message.message_id,
        }, process.env.TELEGRAM_ADMIN_BOT_TOKEN);
      } else {
        // response
        responses[intent] = update.message.reply_to_message.message_id;
        await sendMessage({
          chat_id: update.message.chat.id, text: `Response added for ${intent}`,
          reply_to_message_id: update.message.reply_to_message.message_id,
        }, process.env.TELEGRAM_ADMIN_BOT_TOKEN);
      }
    }
  } else if (update.message.text === "/train") {

  } else if (update.message.text === "/reset") {

  } else if (update.message.text === "/status") {

  } else if (update.message.text === "/predict") {

  }
}

async function onSupportGroupChatMessage(update) {
  let apiResponse;
  // tbd - filter out messages from admins

  // tbd - use Rasa to predict the intent
  apiResponse = await callRasaApi("model/parse", "post", {
    text: update.message.text,
  });

  const predicted_intent = (getObjectProperty(apiResponse, "data.response_selector.default.response.intent_response_key") || "").slice(4);
  const confidence = getObjectProperty(apiResponse, "data.response_selector.default.response.confidence") || 0;
  const CONFIDENCE_THRESHOLD = 0.5;

  const action_taken = predicted_intent ? confidence >= CONFIDENCE_THRESHOLD ? responses[predicted_intent] ? "Answered" : "Skipped - No response defined" : "Skipped - Low confidence" : "Skipped - No prediction";

  if (predicted_intent && confidence >= CONFIDENCE_THRESHOLD && responses[predicted_intent]) {
    await copyMessage({ from_chat_id: admin_group_chat_id, chat_id: update.message.chat.id, message_id: responses[predicted_intent], reply_to_message_id: update.message.message_id },
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  }

  const sample_id = addSample(update.message.text);

  // sending notification to admin group
  const admin_message = `New query from ${update.message.from.username || update.message.from.first_name}
Text: ${update.message.text}
Prediction: ${predicted_intent}
Confidence: ${confidence}
Action: ${action_taken}`;

  //apiResponse = await forwardMessage({ from_chat_id: update.message.chat.id, chat_id: admin_group_chat_id, message_id: update.message.message_id },
  //  process.env.TELEGRAM_ADMIN_BOT_TOKEN);

  //linkSampleToMessage(apiResponse.data.result.message_id, sample_id);

  apiResponse = await sendMessage({
    chat_id: admin_group_chat_id, text: admin_message,
    //reply_to_message_id: apiResponse.data.result.message_id,
    /*reply_markup: {
      inline_keyboard: [
        [{ text: "👍", callback_data: JSON.stringify({ action: "correct" }) }, { text: "👎", callback_data: JSON.stringify({ action: "wrong" }) }],
      ]
    }*/
  }, process.env.TELEGRAM_ADMIN_BOT_TOKEN);

  linkSampleToMessage(apiResponse.data.result.message_id, sample_id);
}

function isAdminGroupChat(update) {
  return (update.message.chat.username && update.message.chat.username === process.env.TELEGRAM_ADMIN_GROUP_USERNAME) ||
    (update.message.chat.title && update.message.chat.title === process.env.TELEGRAM_ADMIN_GROUP_TITLE);
}

function isSupportGroupChat(update) {
  return (update.message.chat.username && update.message.chat.username === process.env.TELEGRAM_SUPPORT_GROUP_USERNAME) ||
    (update.message.chat.title && update.message.chat.title === process.env.TELEGRAM_SUPPORT_GROUP_TITLE);
}

addBot(process.env.TELEGRAM_ADMIN_BOT_USERNAME, process.env.TELEGRAM_ADMIN_BOT_SECRET, {
  onPMChatJoin: async function (update) {
    await sendMessage({
      chat_id: update.message.chat.id,
      text: 'This bot is meant to be used only in a specific group. Messages sent here will be ignored.'
    },
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
    await leaveChat({ chat_id: update.message.chat.id }, process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onPMChatMessage: async function (update) {
    logger.warn(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} used in PM chat with ${update.message.chat.username} | ${update.message.chat.id}`)
  },
  onPMChatBlocked: async function (update) {
    logger.info(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} blocked by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
  onGroupChatJoin: async function (update) {
    logger.info(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} added to group ${update.message.chat.title} | ${update.message.chat.id} by ${update.message.from.first_name} | ${update.message.from.username} | ${update.message.from.id}`);
    if (isAdminGroupChat(update)) {
      admin_group_chat_id = update.message.chat.id;
    }
  },
  onGroupChatMessage: async function (update) {
    if (isAdminGroupChat(update)) {
      onAdminGroupChatMessage(update);
    } else if (isSupportGroupChat(update)) {
      onSupportGroupChatMessage(update);
    }
  },
  onGroupChatLeave: async function (update) {
    logger.info(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} kicked in group ${update.my_chat_member.chat.title} | ${update.my_chat_member.chat.id} by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
  onChannelJoin: async function (update) {
    await sendMessage({ chat_id: update.my_chat_member.chat.id, text: 'This bot is not designed to be used in a channel and will leave the channel shortly.' },
      process.env.TELEGRAM_ADMIN_BOT_TOKEN);
    await leaveChat({ chat_id: update.my_chat_member.chat.id }, process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  },
  onChannelMessage: async function (update) {
    logger.warn(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} used in channel ${update.my_chat_member.chat.title} | ${update.my_chat_member.chat.id}`)
  },
  onChannelLeave: async function (update) {
    logger.info(`@${process.env.TELEGRAM_ADMIN_BOT_USERNAME} kicked in channel ${update.my_chat_member.chat.title} | ${update.my_chat_member.chat.id} by ${update.my_chat_member.from.first_name} | ${update.my_chat_member.from.username} | ${update.my_chat_member.from.id}`);
  },
});

module.exports = {
  getChatQueue,
};
