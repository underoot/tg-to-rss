import { Airgram, Auth, prompt, toObject } from 'airgram'
import { readFileSync } from 'fs';
import express from 'express';
import RSS from 'rss-generator';

const app = express();

const airgram = new Airgram({
  apiId: process.env.API_ID,
  apiHash: process.env.API_HASH,
  command: 'td/build/libtdjson.dylib',
  logVerbosityLevel: 1,
  useChatInfoDatabase: false
});

airgram.use(new Auth({
  code: () => prompt(`Please enter the secret code:\n`),
  phoneNumber: () => prompt(`Please enter your phone number:\n`),
  password: () => prompt(`Password:\n`) 
}))

void (async () => {
  const me = toObject(await airgram.api.getMe())
  console.log(`[Me] `, me)
});

app.get('/feed/:name', async (req, res) => {
  const { response: { chatIds } } = await airgram.api.searchPublicChats({
    query: req.params.name,
    limit: 1
  });

  if (!chatIds.length) {
    res.send(404);
    return;
  }

  let chat;

  for (const chatId of chatIds) {
    chat = await airgram.api.getChat({
      chatId: chatId
    });

    if (!chat.response.type.isChannel) {
      chat = null;
    } else {
      break;
    }
  }

  if (!chat) {
    res.send(404);
    return;
  }

  const { response: chatInfo } = chat;

  const { response: fullInfo } = await airgram.api.getSupergroupFullInfo({
    supergroupId: chat.response.type.supergroupId
  });


  let imageUrl = null;

  if (chat.response.photo?.big.id) {
    const { response: photoFile } = await airgram.api.downloadFile({
      fileId: chat.response.photo?.big.id,
      priority: 1,
      synchronous: true
    });

    const image = readFileSync(photoFile.local.path);

    imageUrl = `data:image/jpeg;base64,${image.toString('base64')}`;
  }


  const feed = new RSS({
    title: chatInfo.title,
    description: fullInfo.description,
    feed_url: `https://t.me/${req.params.name}`,
    site_url: req.params.name,
    image_url: imageUrl ?? undefined
  });

  const { response: { messages: [ lastMessage ] } } = await airgram.api.getChatHistory({
    chatId: chatInfo.id,
    limit: 1
  });

  const { response: historyInfo } = await airgram.api.getChatHistory({
    chatId: chatInfo.id,
    limit: 5,
    offset: 0,
    fromMessageId: lastMessage.id
  });

  for (const message of [lastMessage, ...historyInfo.messages] ?? []) {
    let image = null;

    if (message.content?.photo) {
      const [{ photo }] = message.content.photo.sizes;
      const { response: photoFile } = await airgram.api.downloadFile({
        fileId: photo.id,
        priority: 1,
        synchronous: true
      });

      image = readFileSync(photoFile.local.path);
    }

    const text = message.content?.text?.text ?? message.content?.caption?.text ?? '';
    const description = [
      image ? `<img src="data:image/jpeg;base64,${image.toString('base64')}" />` : '',
      text ? `<p>${text}</p>` : ''
    ].filter(Boolean).join('<br />')
    const title = (/(^.*?[.!?:])\s+\W*.*/.exec(text.replace(/\n/g, '')) || [])[1];
    const { response: urlResponse } = await airgram.api.getMessageLink({
      chatId: chat.response.id,
      messageId: message.id
    });

    feed.item({
      title: title ?? text.slice(0, 30) ?? 'Новый пост',
      description,
      url: urlResponse.link,
      guid: message.id,
      date: new Date(message.date * 1000).toISOString()
    })
  }

  res.set('Content-Type', 'text/xml')

  res.send(feed.xml());
});

app.listen(3000);