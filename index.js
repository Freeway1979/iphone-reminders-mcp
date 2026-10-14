#!/usr/bin/env node
// MCP server: lets an AI assistant add, list and complete Apple Reminders on this Mac.
// iCloud syncs them to the iPhone, which shows the notification at the due time.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DEFAULT_LIST, DEFAULT_TIME, resolveDue, runHelper } from './lib.js';

const server = new McpServer({ name: 'iphone-reminders', version: '1.0.0' });

const text = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const failure = (err) => ({ isError: true, content: [{ type: 'text', text: err.message }] });

server.registerTool(
  'add_reminder',
  {
    description:
      `Add a to-do to Apple Reminders; it alerts on the user's iPhone at the due time. ` +
      `Without a time it defaults to ${DEFAULT_TIME}; without a date it uses the next ${DEFAULT_TIME} ` +
      `(today, or tomorrow if that has passed). Use repeat for recurring reminders such as "every day at 8:30pm".`,
    inputSchema: {
      title: z.string().min(1).describe('What to do, short, e.g. "Renew the TLS cert"'),
      notes: z.string().optional().describe('Optional details'),
      date: z.string().optional().describe('First due date, YYYY-MM-DD, local time'),
      time: z.string().optional().describe(`Due time HH:MM 24h, local time. Default ${DEFAULT_TIME}`),
      repeat: z.enum(['none', 'daily', 'weekdays', 'weekly', 'monthly']).optional()
        .describe('Recurrence. Default none'),
      list: z.string().optional().describe('Reminders list name. Default: the default list'),
    },
  },
  async ({ title, notes, date, time, repeat, list }) => {
    try {
      const args = ['add', '--title', title, '--due', resolveDue({ date, time })];
      if (notes) args.push('--notes', notes);
      if (repeat) args.push('--repeat', repeat);
      const targetList = list || DEFAULT_LIST;
      if (targetList) args.push('--list', targetList);
      return text(await runHelper(args));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  'list_reminders',
  {
    description: 'List open (not completed) Apple Reminders, soonest first, with their ids.',
    inputSchema: {
      list: z.string().optional().describe('Only this Reminders list'),
    },
  },
  async ({ list }) => {
    try {
      const args = ['list'];
      if (list) args.push('--list', list);
      return text(await runHelper(args));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  'complete_reminder',
  {
    description: 'Mark a reminder done. Get the id from list_reminders.',
    inputSchema: { id: z.string().min(1) },
  },
  async ({ id }) => {
    try {
      return text(await runHelper(['complete', '--id', id]));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  'list_reminder_lists',
  { description: 'Show the names of the Reminders lists.', inputSchema: {} },
  async () => {
    try {
      return text(await runHelper(['lists']));
    } catch (err) {
      return failure(err);
    }
  },
);

await server.connect(new StdioServerTransport());
