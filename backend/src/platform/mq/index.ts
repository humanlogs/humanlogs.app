import { SQS } from "@aws-sdk/client-sqs";
import { captureException } from "@sentry/node";
import config from "config";
import { Context, createContext } from "../../types";

export default class MQService {
  private sqs: SQS;
  private prefix: string;
  private queueUrls = new Map<string, string>();

  async init() {
    this.sqs = new SQS({
      apiVersion: "2010-12-01",
      region: config.get<string>("aws.region"),
      credentials: {
        accessKeyId: config.get<string>("aws.id"),
        secretAccessKey: config.get<string>("aws.secret"),
      },
      ...(config.get<string>("mq.sqs.region")
        ? { region: config.get<string>("mq.sqs.region") }
        : {}),
    });
    this.prefix = config.get<string>("mq.sqs.prefix") || "";

    await this.ensureQueue(this.prefix + "images_async");
    await this.ensureQueue(this.prefix + "loras_async");

    return this;
  }

  async ensureQueue(queueName: string) {
    queueName = this.prefix + queueName.replace(this.prefix, "");
    try {
      const { QueueUrl } = await this.sqs.getQueueUrl({ QueueName: queueName });
      console.log(`Queue exists: ${QueueUrl}`);
      this.queueUrls.set(queueName, QueueUrl);
      return QueueUrl;
    } catch (error) {
      if (error.name === "QueueDoesNotExist") {
        const { QueueUrl } = await this.sqs.createQueue({
          QueueName: queueName,
        });
        console.log(`Queue created: ${QueueUrl}`);
        return QueueUrl;
      } else {
        throw error; // Handle other errors
      }
    }
  }

  // Add a task to the queue
  async addTask(queue: string, payload: any) {
    queue = this.prefix + queue.replace(this.prefix, "");
    console.log("[MQ] Adding task to queue", queue);
    await this.sqs.sendMessage({
      QueueUrl: this.queueUrls.get(queue) || (await this.ensureQueue(queue)),
      MessageBody: JSON.stringify(payload),
    });
  }

  // Consume tasks of a specific type concurrently
  async consumer(
    queue: string,
    handler: (ctx: Context, task: any) => Promise<void>,
    concurrently = 10,
    taskTimeoutSeconds = 120,
    messagesPerThread = 5
  ) {
    queue = this.prefix + queue.replace(this.prefix, "");

    // Calculate messages per thread (minimum 1)
    const numThreads = Math.max(
      1,
      Math.floor(concurrently / messagesPerThread)
    );

    console.log(
      `[MQ] Starting ${numThreads} consumer threads for queue ${queue}, each processing ${messagesPerThread} messages at a time`
    );

    // Start multiple worker threads
    const workerPromises = [];
    for (let i = 0; i < numThreads; i++) {
      const workerPromise = this.consumerWorker(
        queue,
        handler,
        messagesPerThread,
        taskTimeoutSeconds,
        i
      );
      workerPromises.push(workerPromise);
    }

    // Wait for all worker threads (they should never resolve as they run infinite loops)
    await Promise.all(workerPromises);
  }

  // Individual worker thread for consuming messages
  private async consumerWorker(
    queue: string,
    handler: (ctx: Context, task: any) => Promise<void>,
    messagesPerBatch: number,
    taskTimeoutSeconds: number,
    threadId: number
  ) {
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    console.log(`[MQ] Thread ${threadId}: Starting for queue ${queue}`);

    while (true) {
      try {
        const { Messages } = await this.sqs.receiveMessage({
          QueueUrl:
            this.queueUrls.get(queue) || (await this.ensureQueue(queue)),
          MaxNumberOfMessages: messagesPerBatch,
          WaitTimeSeconds: 10,
        });

        if (Messages && Messages.length > 0) {
          console.log(
            `[MQ] Thread ${threadId}: Received ${Messages.length} messages from queue ${queue}`
          );
          await Promise.all(
            Messages.map(async (message) => {
              console.log(
                `[MQ] Thread ${threadId}: Consuming task from queue`,
                queue,
                message.MessageId
              );
              let pushMessageVisibilityInterval = setInterval(() => {},
              1000000);
              try {
                const ctx = createContext("mq", "SYSTEM");
                const payload = JSON.parse(message.Body);

                if (taskTimeoutSeconds > 30) {
                  try {
                    await this.sqs.changeMessageVisibility({
                      QueueUrl:
                        this.queueUrls.get(queue) ||
                        (await this.ensureQueue(queue)),
                      ReceiptHandle: message.ReceiptHandle,
                      VisibilityTimeout: taskTimeoutSeconds,
                    });
                  } catch (error) {
                    console.error(
                      `[MQ] Thread ${threadId}: Error extending visibility for message ${message.MessageId} in queue ${queue}:`,
                      error
                    );
                    captureException(error);
                  }
                }

                // Create a timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => {
                    reject(
                      new Error(
                        `Task execution timed out after ${taskTimeoutSeconds} seconds`
                      )
                    );
                  }, taskTimeoutSeconds * 1000);
                });

                // Race between task execution and timeout
                try {
                  await Promise.race([handler(ctx, payload), timeoutPromise]);
                } catch (error) {
                  if (error.message?.includes("Task execution timed out")) {
                    console.warn(
                      `[MQ] Thread ${threadId}: WARNING: Task from queue ${queue} (${message.MessageId}) has exceeded the timeout of ${taskTimeoutSeconds}s but will continue processing in the background`
                    );
                    // We don't rethrow here to allow the task to continue in background
                  } else {
                    throw error; // Rethrow non-timeout errors
                  }
                }
              } catch (e) {
                console.log(
                  `[MQ] Thread ${threadId}: Error on task from queue`,
                  queue,
                  message.MessageId
                );
                console.error(e);
                captureException(e);
              } finally {
                console.log(
                  `[MQ] Thread ${threadId}: Deleting task from queue`,
                  queue,
                  message.MessageId
                );
                clearInterval(pushMessageVisibilityInterval);
                await this.sqs.deleteMessage({
                  QueueUrl:
                    this.queueUrls.get(queue) ||
                    (await this.ensureQueue(queue)),
                  ReceiptHandle: message.ReceiptHandle,
                });
              }
            })
          );
        } else {
          await sleep(1000); // 1 second delay when no messages are found
        }
      } catch (error) {
        console.error(
          `[MQ] Thread ${threadId}: Error receiving messages from queue ${queue}:`,
          error
        );
        captureException(error);
        // Add a delay before retrying after an error
        await sleep(5000); // 5 second delay on error
      }
    }
  }
}
