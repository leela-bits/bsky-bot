import process from 'node:process';
import {
  AppBskyFeedDefs,
  AppBskyFeedGetPostThread,
  AppBskyFeedPost,
  AppBskyNotificationUpdateSeen,
} from '@atcute/bluesky';
import { publishThread } from '@atcute/bluesky-threading';
import { Client, ClientResponseError, ClientValidationError, ok } from '@atcute/client';
import { is } from '@atcute/lexicons';
import { PasswordSession } from '@atcute/password-session';
import dotenv from 'dotenv';
import { NotificationService } from './notification-service.ts';

// log error information to the console
function logError(error: unknown) {
  if (error instanceof ClientValidationError) {
    console.error(`client validation error: ${error.message}`);
  } else if (error instanceof ClientResponseError) {
    console.error(`client response error: ${error.status} ${error.error} ${error.description}`);
  } else {
    console.error('unexpected error: ', error);
  }
}

// check to see if anyone mentioned us
// noinspection JSUnusedLocalSymbols
async function _checkMentions(session: PasswordSession) {
  // create a client with the authenticated session
  const client = new Client({
    handler: session,
  });

  let next: string | undefined;

  do {
    try {
      // get a list of all mention notifications
      console.log('getting list of all mention notifications');
      const { cursor, notifications } = await ok(
        client.get('app.bsky.notification.listNotifications', {
          params: {
            reasons: ['mention'],
            limit: 20,
            cursor: next,
          },
        }),
      );

      next = cursor;

      console.log(
        `${notifications.length} notification${notifications.length !== 1 ? 's' : ''} retrieved`,
      );

      // process each mention that hasn't been read yet
      for (const notif of notifications) {
        if (notif.reason !== 'mention') {
          continue;
        }

        // if the notification has been read then we are done reading
        if (notif.isRead) {
          console.log('all notifications have been read');
          next = '';
          break;
        }

        try {
          // get the post thread that we were mentioned in
          console.log('getting thread that we were mentioned in');
          const { thread } = await ok(
            client.call(AppBskyFeedGetPostThread, {
              params: { uri: notif.uri },
            }),
          );

          // if this is a valid post (i.e. not blocked or missing)
          if (
            is(AppBskyFeedDefs.threadViewPostSchema, thread) &&
            is(AppBskyFeedPost.mainSchema, thread.post.record)
          ) {
            const mentionText = thread.post.record.text;
            const createdAt = thread.post.record.createdAt;

            console.log(`@${notif.author.handle} mentioned us at ${createdAt}: "${mentionText}"`);

            // reply to the post that mentioned us!
            console.log('replying to the post that mentioned us');
            await publishThread(client, {
              author: session.did,
              reply: notif.uri,
              posts: [
                {
                  content: {
                    text: 'Hi!',
                  },
                },
              ],
            });

            try {
              // update the notifications seen time
              console.log('updating notifications seen time');
              const seenAt = new Date(createdAt);
              seenAt.setTime(seenAt.getTime() + 1);
              await ok(
                client.call(AppBskyNotificationUpdateSeen, {
                  input: {
                    seenAt: seenAt.toISOString(),
                  },
                }),
              );
            } catch (error) {
              logError(error);
            }
          }
        } catch (error) {
          logError(error);
        }
      }
    } catch (error) {
      logError(error);
    }
  } while (next && next !== '');
}

// main entry point for the bot
async function main() {
  console.log('started');

  // get the bot credentials from the environment variables
  const service = process.env.BOT_PDS ?? 'https://bsky.social';
  const identifier = process.env.BOT_HANDLE;
  const password = process.env.BOT_PASSWORD;

  // make sure we have an identifier
  if (!identifier) {
    console.error('BOT_HANDLE environment variable is missing');
    process.exit(1);
  }

  // make sure we have a password
  if (!password) {
    console.error('BOT_PASSWORD environment variable is missing');
    process.exit(1);
  }

  // authenticate using the credentials
  console.log('authenticating');
  const session = await PasswordSession.login(
    {
      service,
      identifier,
      password,
    },
    {
      onDelete: (data) => {
        console.log('session data deleted');
        console.debug(data);
      },
      onUpdate: (data) => {
        console.log('session data updated');
        console.debug(data);
      },
    },
  );

  const notifService = new NotificationService({
    handler: session,
    pollInterval: 10000,
  });

  // shutdown stops all the background tasks and logout of the session
  async function shutdown() {
    await notifService.stop();
    await session.logout();
    process.exit(0);
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  notifService.start();
}

console.log('starting');

// load .env file
dotenv.config({ quiet: true });

// run the bot
await main().catch((error) => {
  logError(error);
});

console.log('running');
