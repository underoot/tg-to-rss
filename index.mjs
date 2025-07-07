import { Feed } from "feed";
import { load } from "cheerio";

async function getFeed({ channelName }) {
  let channelHTML;

  try {
    channelHTML = await fetch(`https://t.me/s/${channelName}`).then((res) =>
      res.text()
    );
  } catch (error) {
    return {
      error: {
        code: 400,
        message: error.message,
      },
    };
  }

  if (!channelHTML.includes("tgme_channel_info")) {
    return {
      error: {
        code: 404,
        message: "Channel not found",
      },
    };
  }

  const $ = load(channelHTML);
  const title = $(".tgme_channel_info_header_title").text();
  const description = $(".tgme_channel_info_description").text();
  const link = `https://t.me/s/${channelName}`;

  const feed = new Feed({
    title,
    description,
    image: $("meta[property='og:image']").attr("content"),
    id: link,
    link,
  });

  const items = [];

  $(".tgme_widget_message").each((_, el) => {
    const $el = $(el);
    const $content = $el.find(".tgme_widget_message_bubble");
    const link = `https://t.me/${$el.attr("data-post")}`;
    const date = new Date(
      $el.find(".tgme_widget_message_date time").attr("datetime")
    );
    let image = null;

    $content.find(".tgme_widget_message_photo_wrap").each((_, el) => {
      const $el = $(el);
      const style = $el.attr("style");
      const match = style.match(/url\(['"](.*?)['"]\)/);

      if (match) {
        if (!image) {
          image = match[1];
        }
        $el.replaceWith(`<img src="${match[1]}">`);
      }
    });

    $content.find("*").each((_, el) => {
      $(el).attr("style", null);
    });

    $content.find(".tgme_widget_message_bubble_tail").remove();
    $content.find(".tgme_widget_message_owner_name").remove();
    $content.find(".tgme_widget_message_date").remove();
    $content.find(".tgme_widget_message_link_preview").remove();
    $content.find(".tgme_widget_message_author").remove();
    $content.find(".tgme_widget_message_footer").remove();

    const forwardedFrom = $content
      .find(".tgme_widget_message_forwarded_from")
      .html()
      ?.trim();

    const messageText = $content.find(".tgme_widget_message_text");

    const text = messageText.html()?.trim();

    const images = [];
    const videos = [];

    $content.find("img").each((_, el) => {
      const $el = $(el);
      images.push(`<img src="${$el.attr("src")}">`);
    });

    $content.find("video").each((_, el) => {
      const $el = $(el);
      const videoSrc = $el.attr("src");
      if (videoSrc) {
        videos.push(`<video controls><source src="${videoSrc}"></video>`);
      }
    });

    const someMedia = images.length || videos.length;

    const item = {
      id: link,
      link,
      content: [
        ...images,
        ...videos,
        forwardedFrom ? `${forwardedFrom}<br><br>` : "",
        text ? text : someMedia ? "" : "Unsupported content",
      ].join(""),
      date,
      image,
    };

    if (messageText.get(0)?.children?.[0].name === "b") {
      item.title = messageText.get(0).children[0].children?.[0]?.data;
    }

    if (messageText.get(0)?.children?.[0].name === "a") {
      item.title = messageText.get(0).children[0].children?.[0]?.data;
    }

    if (!item.title) {
      const firstSentence = text?.split(/(?<=[.!?])\s+/)[0];
      if (firstSentence) {
        item.title = firstSentence;
      }
    }

    items.push(item);
  });

  items.reverse().forEach((item) => {
    feed.addItem(item);
  });

  return feed;
}

export async function main({ channelName }) {
  if (!channelName) {
    return {
      headers: {
        "content-type": "application/json",
      },
      body: {
        error: "Channel name is required",
      },
    };
  }

  return getFeed({ channelName }).then((feed) => {
    if (feed.error) {
      return {
        headers: {
          "content-type": "application/xml",
        },
        body: `
          <xml version="1.0" encoding="UTF-8">
            <error>
              <code>${feed.error.code}</code>
              <message>${feed.error.message}</message>
            </error>
          </xml>
        `,
      };
    }

    return {
      headers: {
        "content-type": "application/xml",
      },
      body: feed.rss2(),
    };
  });
}
