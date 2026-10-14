#!/bin/sh
# Stand-in for bin/reminders-helper: echoes the args it got as JSON.
if [ "$1" = "complete" ] && [ "$3" = "bad" ]; then echo '{"error":"No reminder with id bad"}'; exit 1; fi
node -e 'console.log(JSON.stringify({mock:true,args:process.argv.slice(1)}))' "$@"
