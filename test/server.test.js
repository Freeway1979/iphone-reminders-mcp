import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP tools call the helper with the right args', async () => {
  const client = new Client({ name: 't', version: '0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: ['index.js'],
    env: { ...process.env, REMINDERS_HELPER: './test/mock-helper.sh', REMINDER_DEFAULT_LIST: 'Todo' },
  }));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(),
    ['add_reminder', 'complete_reminder', 'list_reminder_lists', 'list_reminders']);

  const add = await client.callTool({ name: 'add_reminder',
    arguments: { title: 'Renew cert', date: '2026-10-12', repeat: 'daily' } });
  const args = JSON.parse(add.content[0].text).args;
  assert.deepEqual(args, ['add', '--title', 'Renew cert', '--due', '2026-10-12 20:30',
    '--repeat', 'daily', '--list', 'Todo']);

  const bad = await client.callTool({ name: 'complete_reminder', arguments: { id: 'bad' } });
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /No reminder with id bad/);

  const badTime = await client.callTool({ name: 'add_reminder', arguments: { title: 'x', time: '8pm' } });
  assert.equal(badTime.isError, true);
  await client.close();
});
