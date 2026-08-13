import dotenv from 'dotenv';
import { Client, ClientResponseError, ClientValidationError, ok } from '@atcute/client';
import { PasswordSession } from '@atcute/password-session';
import { is } from '@atcute/lexicons';
import { mainSchema as NotifUpdateSeen } from '@atcute/bluesky/types/app/notification/updateSeen';
import { mainSchema as FeedGetPostThread } from '@atcute/bluesky/types/app/feed/getPostThread';
import { mainSchema as Post } from '@atcute/bluesky/types/app/feed/post';
import { threadViewPostSchema as ThreadViewPost } from '@atcute/bluesky/types/app/feed/defs';
import { publishThread } from '@atcute/bluesky-threading';

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
async function checkMentions(session: PasswordSession) {
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
                `${notifications.length} notification${notifications.length != 1 ? 's' : ''} retrieved`,
            );

            // process each mention that hasn't been read yet
            for (const notif of notifications) {
                if (notif.reason !== 'mention' || notif.isRead) {
                    continue;
                }

                try {
                    // get the post thread that we were mentioned in
                    console.log('getting thread that we were mentioned in');
                    const { thread } = await ok(
                        client.call(FeedGetPostThread, {
                            params: { uri: notif.uri },
                        }),
                    );

                    // if this is a valid post (i.e. not blocked or missing)
                    if (is(ThreadViewPost, thread) && is(Post, thread.post.record)) {
                        const mentionText = thread.post.record.text;
                        const createdAt = thread.post.record.createdAt;

                        console.log(
                            `@${notif.author.handle} mentioned us at ${createdAt}: "${mentionText}"`,
                        );

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
                    }
                } catch (error) {
                    logError(error);
                }
            }
        } catch (error) {
            logError(error);
        }
    } while (next);

    try {
        // update the notifications seen time
        console.log('updating notifications seen time');
        await ok(
            client.call(NotifUpdateSeen, {
                input: {
                    seenAt: new Date().toISOString(),
                },
            }),
        );
    } catch (error) {
        logError(error);
    }
}

// main entry point for the bot
async function main() {
    console.log('started');

    // get the bot credentials from the environment variables
    const service = process.env.BOT_PDS!;
    const identifier = process.env.BOT_HANDLE!;
    const password = process.env.BOT_PASSWORD!;

    // authenticate using the credentials
    console.log('authenticating');
    await using session = await PasswordSession.login({
        service,
        identifier,
        password,
    });

    // check to see if anyone has mentioned us
    console.log('checking for mentions');
    await checkMentions(session);

    console.log('stopping');
}

console.log('starting');

// load .env file
dotenv.config({ quiet: true });

// run the bot
await main().catch((error) => {
    logError(error);
});

console.log('stopped');
