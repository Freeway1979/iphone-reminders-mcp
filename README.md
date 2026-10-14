# iphone-reminders-mcp

Tell your AI "remind me to renew the cert" and get a native Apple Reminder that
alerts on your iPhone at 20:30 (or whatever time you choose).

```
AI client (Claude Desktop / Cowork / Claude Code)
   │  MCP over stdio
   ▼
index.js (Node) ──► bin/reminders-helper (Swift, EventKit) ──► Reminders on your Mac
                                                                 │ iCloud sync
                                                                 ▼
                                                        iPhone notification at due time
```

Why EventKit and not iCloud CalDAV: since iOS 13 / macOS Catalina, Reminders no longer
syncs over CalDAV, so the only supported way to write real reminders is through
EventKit on a Mac signed in to the same iCloud account.

## Tools exposed

| Tool | What it does |
|---|---|
| `add_reminder` | `title`, optional `notes`, `date` (YYYY-MM-DD), `time` (HH:MM, default 20:30), `repeat` (`none`/`daily`/`weekdays`/`weekly`/`monthly`), `list` |
| `list_reminders` | Open reminders, soonest first, with ids |
| `complete_reminder` | Mark one done by id |
| `list_reminder_lists` | Names of your Reminders lists |

With no date, the reminder goes to the next 20:30: today, or tomorrow if 20:30 has
already passed.

## Install (on your Mac, about 5 minutes)

```sh
xcode-select --install          # once, if you don't have the Swift compiler
cd ~/code/iphone-reminders-mcp  # wherever you put this folder
npm install
npm run build                   # compiles bin/reminders-helper
./bin/reminders-helper lists    # sanity check; macOS asks for Reminders access
```

**Open the Reminders app on the Mac once.** Until it has been launched, reminders written
through EventKit don't fire alerts or sync.

On iPhone: **Settings → [your name] → iCloud → Reminders** must be on, and the Mac
must be signed in to the same Apple ID.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "iphone-reminders": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/andy/code/iphone-reminders-mcp/index.js"],
      "env": {
        "REMINDER_DEFAULT_TIME": "20:30",
        "REMINDER_DEFAULT_LIST": "Reminders"
      }
    }
  }
}
```

Use the full path from `which node`. GUI apps don't load your shell `PATH`, so a plain
`"node"` often fails, especially with nvm. Restart Claude Desktop afterwards. Cowork
sessions linked to this Mac can then use the same tools.

### Claude Code

```sh
claude mcp add iphone-reminders -s user -e REMINDER_DEFAULT_TIME=20:30 -- "$(which node)" ~/code/iphone-reminders-mcp/index.js
```

## Configuration (env)

| Variable | Default | Meaning |
|---|---|---|
| `REMINDER_DEFAULT_TIME` | `20:30` | Time used when you don't say one |
| `REMINDER_DEFAULT_LIST` | your default list | Reminders list to put items in |
| `REMINDERS_HELPER` | `./bin/reminders-helper` | Path to the Swift helper |

## Usage examples

- "Remind me to call Bob" → today or tomorrow at 20:30
- "Every day at 8:30pm remind me to review alarms" → `repeat: daily`
- "Weekdays 9:00 check the MSP deploy" → `repeat: weekdays`, `time: 09:00`
- "What's on my reminder list?" / "Mark the Bob one done"

## Notes and troubleshooting

- **Repeating reminders advance when you tick them off.** If you don't complete
  yesterday's daily reminder, it stays overdue and today's occurrence isn't created
  until you do. That's how Apple Reminders works.
- **Permission.** The first call asks for Reminders access. When the request comes
  through Claude Desktop, macOS may attribute it to Claude. If you see "Reminders
  access denied", open **System Settings → Privacy & Security → Reminders** and enable
  the app listed (Claude, Terminal or reminders-helper).
- The helper uses the Mac's local time zone. Your iPhone shows the reminder at the
  same absolute time.

## Tests

```sh
npm test   # date logic and MCP wiring against a mock helper; no Mac needed
```
