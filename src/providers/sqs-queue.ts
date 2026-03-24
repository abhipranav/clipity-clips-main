import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import type { QueueProvider, QueueMessage } from "./queue";

interface InFlightMessage extends QueueMessage {
  receiptHandle: string;
}

export class SqsQueueProvider implements QueueProvider {
  private client: SQSClient;
  private queueUrl: string;
  private inFlightMessages: Map<string, InFlightMessage> = new Map();

  constructor(region: string, queueUrl: string) {
    this.client = new SQSClient({ region });
    this.queueUrl = queueUrl;
  }

  async enqueue(runId: string): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify({ runId, attempts: 0 }),
      MessageAttributes: {
        runId: {
          DataType: "String",
          StringValue: runId,
        },
      },
    });

    await this.client.send(command);
  }

  async claimNext(): Promise<QueueMessage | null> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 0,
      MessageAttributeNames: ["All"],
    });

    const response = await this.client.send(command);

    if (!response.Messages || response.Messages.length === 0) {
      return null;
    }

    const message = response.Messages[0];
    const body = JSON.parse(message.Body ?? "{}") as { runId: string; attempts?: number };
    const receiptHandle = message.ReceiptHandle;

    if (!receiptHandle) {
      return null;
    }

    const queueMessage: QueueMessage = {
      runId: body.runId,
      attempts: body.attempts ?? 0,
    };

    // Track the in-flight message for later ack/release
    this.inFlightMessages.set(body.runId, {
      ...queueMessage,
      receiptHandle,
    });

    return queueMessage;
  }

  async ack(runId: string): Promise<void> {
    const message = this.inFlightMessages.get(runId);
    if (!message) {
      throw new Error(`No in-flight message found for run ${runId}`);
    }

    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.receiptHandle,
    });

    await this.client.send(command);
    this.inFlightMessages.delete(runId);
  }

  async release(runId: string, error?: string): Promise<void> {
    const message = this.inFlightMessages.get(runId);
    if (!message) {
      throw new Error(`No in-flight message found for run ${runId}`);
    }

    // Delete the original message first
    const deleteCommand = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.receiptHandle,
    });

    await this.client.send(deleteCommand);

    // Then enqueue a new message with updated attempts
    const newBody = JSON.stringify({
      runId,
      attempts: (message.attempts ?? 0) + 1,
      lastError: error,
    });

    const sendCommand = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: newBody,
      MessageAttributes: {
        runId: {
          DataType: "String",
          StringValue: runId,
        },
      },
    });

    await this.client.send(sendCommand);
    this.inFlightMessages.delete(runId);
  }

  async close(): Promise<void> {
    this.inFlightMessages.clear();
    this.client.destroy();
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Try to get queue attributes to verify connectivity
      const { GetQueueAttributesCommand } = await import("@aws-sdk/client-sqs");
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      });
      await this.client.send(command);
      return { healthy: true };
    } catch (err) {
      return { healthy: false, message: `SQS health check failed: ${err}` };
    }
  }
}
