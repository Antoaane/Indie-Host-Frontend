import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import {
  conversationParamsSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  markReadSchema,
  sendMessageSchema,
} from './messaging.schemas.js';
import { MessagingService } from './messaging.service.js';

export const messagingPlugin = fp(async (fastify) => {
  const service = new MessagingService(fastify.prisma);

  fastify.get('/messaging/conversations', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const query = listConversationsQuerySchema.parse(request.query);
    const conversations = await service.listConversations(query, request.auth);
    reply.send(conversations);
  });

  fastify.post('/messaging/conversations', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const payload = createConversationSchema.parse(asObject(request.body));
    const conversation = await service.createConversation(payload, request.auth);

    if (!conversation) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (conversation === 'forbidden') {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.code(201).send(conversation);
  });

  fastify.get('/messaging/conversations/:conversationId/messages', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const { conversationId } = conversationParamsSchema.parse(request.params);
    const query = listConversationsQuerySchema.parse(request.query);

    const messages = await service.listMessages(conversationId, request.auth, query.guestTempId);

    if (!messages) {
      reply.code(404).send({ message: 'Conversation not found.' });
      return;
    }

    if (messages === 'forbidden') {
      reply.code(403).send({ message: 'Not authorized for this conversation.' });
      return;
    }

    reply.send(messages);
  });

  fastify.post('/messaging/conversations/:conversationId/messages', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const { conversationId } = conversationParamsSchema.parse(request.params);
    const payload = sendMessageSchema.parse(asObject(request.body));

    const message = await service.sendMessage(conversationId, payload, request.auth);

    if (!message) {
      reply.code(404).send({ message: 'Conversation not found.' });
      return;
    }

    if (message === 'forbidden') {
      reply.code(403).send({ message: 'Not authorized for this conversation.' });
      return;
    }

    reply.code(201).send(message);
  });

  fastify.patch('/messaging/messages/:messageId/read', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const { messageId } = markReadSchema.parse(request.params);
    const query = listConversationsQuerySchema.parse(request.query);

    const message = await service.markMessageRead(messageId, request.auth, query.guestTempId);

    if (!message) {
      reply.code(404).send({ message: 'Message not found.' });
      return;
    }

    if (message === 'forbidden') {
      reply.code(403).send({ message: 'Not authorized for this message.' });
      return;
    }

    reply.send(message);
  });
});
