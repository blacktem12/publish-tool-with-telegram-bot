const PublishManager = require('./publish-manager');
const TelegramBot = require('node-telegram-bot-api');
const apiToken = 'Your Telegram Bot Token';
const bot = new TelegramBot(apiToken, { polling: true });
const branchItems = ['main', 'development'];
const folderNames = ['frontend', 'backend', 'both'];
const logger = require('./logger');

const inlineKeyboardMarkup = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: 'Publish Main', callback_data: '0' }
      ], [
        { text: 'Publish Backend', callback_data: '1' }
      ], [
        { text: 'Publish Frontend', callback_data: '2' }
      ], [
        { text: 'Publish Main Upgrade', callback_data: '3' }
      ], [
        { text: 'Publish Development Frontend', callback_data: '4' }
      ]
    ]
  }
};

module.exports = class TelegramUtil {
  constructor() {
    const regex = new RegExp(/publish/, 'g');

    bot.on('polling_error', (e) => {
      logger.log('error', e);

      throw e;
    });

    bot.on('callback_query', async (callbackQuery) => {
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const queryId = callbackQuery.id;

      if (this.isStart) {
        bot.answerCallbackQuery(queryId, { text: 'Publish가 진행중입니다.' });
  
        return false;
      }
  
      this.isStart = true;

      let publishManager = null;
      let responseMessage = null;

      if (data == '0') {
        responseMessage = 'Main Branch를 Publish 합니다.';

        publishManager = new PublishManager('main', 'both');
      } else if (data == '1') {
        responseMessage = 'API를 Publish 합니다.';

        publishManager = new PublishManager('main', 'backend');
      } else if (data == '2') {
        responseMessage = 'WebSite를 Publish 합니다.';

        publishManager = new PublishManager('main', 'frontend');
      } else if (data == '3') {
        responseMessage = 'WebSite를 Publish 합니다.';

        publishManager = new PublishManager('main', 'both', true);
      } else {
        responseMessage = '개발용 WebSite를 Publish 합니다.';

        publishManager = new PublishManager('release', 'frontend');
      }

      bot.sendMessage(chatId, responseMessage);

      const downloadResult = await publishManager.downloadBranch().catch((reason) => {
        bot.sendMessage(chatId, `Branch를 내려받는 도중 에러가 발생했습니다.\n${reason}`);

        this.isStart = false;

        return;
      });

      if (downloadResult != 'Done') {
        return;
      }

      let installResult = await publishManager.installProject().catch((reason) => {
        bot.sendMessage(chatId, `Project를 install 하는 도중 에러가 발생했습니다.\n${JSON.stringify(reason)}`);

        this.isStart = false;

        return;
      });

      if (installResult == 'Done') {
        bot.sendMessage(chatId, 'Publish가 완료 되었습니다.');

        this.isStart = false;
      }

      bot.answerCallbackQuery(queryId);
    });

    bot.onText(regex, async (message, match) => {
      const chatId = message.chat.id;

      if (!this.checkIfPublishStarted(chatId)) {
        return;
      }

      if (message == '/publish') {
        bot.sendMessage(chatId, '아래 버튼을 활용해서 배포하세요.', inlineKeyboardMarkup);

        this.isStart = false;

        return;
      }

      const inputText = match.input;
      const commands = inputText.split(' ');

      if (commands.length < 2) {
        bot.sendMessage(chatId, '명령어가 잘못 되었습니다.\n명령어는 /publish {Branch Name} {Folder Name or both}입니다.\n아래 버튼을 활용해서 배포하세요.', inlineKeyboardMarkup);

        this.isStart = false;

        return;
      }

      if (!this.isValidBranchName(commands)) {
        bot.sendMessage(chatId, `Branch 이름이 잘못되었습니다.\n사용 가능한 branch는 ${branchItems.join(', ')}입니다.\n아래 버튼을 활용해서 배포하세요.`, inlineKeyboardMarkup);

        this.isStart = false;

        return;
      }

      if (!this.isValidFolderName(commands)) {
        bot.sendMessage(chatId, `Folder 이름이 잘못되었습니다.\n사용 가능한 folder는 ${folderNames.join(', ')}입니다.\n아래 버튼을 활용해서 배포하세요.`, inlineKeyboardMarkup);

        this.isStart = false;

        return;
      }

      let responseMessage = null;

      if (commands[2] == 'both') {
        responseMessage = `${commands[1].charAt(0).toUpperCase()}${commands[1].slice(1)} branch를 publish합니다.`;
      } else {
        responseMessage = `${commands[1].charAt(0).toUpperCase()}${commands[1].slice(1)} > ${commands[2].charAt(0).toUpperCase()}${commands[2].slice(1)}를 publish합니다.`;
      }

      bot.sendMessage(chatId, responseMessage);

      const publishManager = new PublishManager(commands[1], commands[2]);

      const downloadResult = await publishManager.downloadBranch().catch((reason) => {
        bot.sendMessage(chatId, `Branch를 내려받는 도중 에러가 발생했습니다.\n${reason}`);

        this.isStart = false;

        return;
      });

      if (downloadResult != 'Done') {
        return;
      }

      let installResult = await publishManager.installProject().catch((reason) => {
        bot.sendMessage(chatId, `Project를 install 하는 도중 에러가 발생했습니다.\n${JSON.stringify(reason)}`);

        this.isStart = false;

        return;
      });

      if (installResult == 'Done') {
        bot.sendMessage(chatId, 'Publish가 완료 되었습니다.');

        this.isStart = false;
      }
    });
  }

  checkIfPublishStarted(chatId) {
    if (this.isStart) {
      bot.sendMessage(chatId, 'Publish가 진행중입니다.');

      return false;
    }

    this.isStart = true;

    return true;
  }

  isValidBranchName(commands) {
    return branchItems.includes(commands[1]);
  }

  isValidFolderName(commands) {
    return folderNames.includes(commands[2]);
  }
}