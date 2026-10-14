#!/bin/sh
# Builds the EventKit helper. Needs Xcode Command Line Tools: xcode-select --install
set -e
cd "$(dirname "$0")"
mkdir -p bin
swiftc -O swift/RemindersHelper.swift -o bin/reminders-helper \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker swift/Info.plist
codesign --force --sign - --identifier local.andy.reminders-helper bin/reminders-helper
echo "Built bin/reminders-helper"
