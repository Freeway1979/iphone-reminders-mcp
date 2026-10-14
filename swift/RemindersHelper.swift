// reminders-helper — tiny EventKit CLI used by the MCP server.
// Writes to Apple Reminders on this Mac; iCloud syncs it to the iPhone.
//
//   reminders-helper lists
//   reminders-helper add --title T --due "2026-10-12 20:30" [--notes N] [--repeat none|daily|weekdays|weekly|monthly] [--list NAME]
//   reminders-helper list [--list NAME]
//   reminders-helper complete --id ID
//
// Every command prints one JSON object on stdout. Failures print {"error": "..."} and exit 1.

import EventKit
import Foundation

let store = EKEventStore()

func out(_ obj: Any) {
    let data = try! JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

func fail(_ msg: String) -> Never {
    out(["error": msg])
    exit(1)
}

func parseArgs(_ argv: [String]) -> [String: String] {
    var opts: [String: String] = [:]
    var i = 0
    while i < argv.count {
        let key = argv[i]
        guard key.hasPrefix("--") else { fail("Unexpected argument: \(key)") }
        guard i + 1 < argv.count else { fail("Missing value for \(key)") }
        opts[String(key.dropFirst(2))] = argv[i + 1]
        i += 2
    }
    return opts
}

func requestAccess() {
    let sem = DispatchSemaphore(value: 0)
    var granted = false
    var accessError: Error?
    if #available(macOS 14.0, *) {
        store.requestFullAccessToReminders { ok, err in granted = ok; accessError = err; sem.signal() }
    } else {
        store.requestAccess(to: .reminder) { ok, err in granted = ok; accessError = err; sem.signal() }
    }
    sem.wait()
    if !granted {
        fail("Reminders access denied (\(accessError?.localizedDescription ?? "no permission")). "
            + "Allow it in System Settings → Privacy & Security → Reminders, then retry.")
    }
}

let dateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = "yyyy-MM-dd HH:mm"
    return f
}()

func reminderList(named name: String?) -> EKCalendar {
    guard let name = name, !name.isEmpty else {
        guard let cal = store.defaultCalendarForNewReminders() else { fail("No default Reminders list") }
        return cal
    }
    guard let cal = store.calendars(for: .reminder).first(where: { $0.title == name }) else {
        let names = store.calendars(for: .reminder).map { $0.title }.joined(separator: ", ")
        fail("No Reminders list named \"\(name)\". Available: \(names)")
    }
    return cal
}

func recurrenceRule(_ kind: String) -> EKRecurrenceRule? {
    switch kind {
    case "", "none":
        return nil
    case "daily":
        return EKRecurrenceRule(recurrenceWith: .daily, interval: 1, end: nil)
    case "weekly":
        return EKRecurrenceRule(recurrenceWith: .weekly, interval: 1, end: nil)
    case "monthly":
        return EKRecurrenceRule(recurrenceWith: .monthly, interval: 1, end: nil)
    case "weekdays":
        let days = (2...6).map { EKRecurrenceDayOfWeek(EKWeekday(rawValue: $0)!) } // Mon–Fri
        return EKRecurrenceRule(recurrenceWith: .weekly, interval: 1, daysOfTheWeek: days,
                                daysOfTheMonth: nil, monthsOfTheYear: nil, weeksOfTheYear: nil,
                                daysOfTheYear: nil, setPositions: nil, end: nil)
    default:
        fail("Unknown repeat value: \(kind). Use none, daily, weekdays, weekly or monthly.")
    }
}

func describe(_ r: EKReminder) -> [String: Any] {
    var obj: [String: Any] = [
        "id": r.calendarItemIdentifier,
        "title": r.title ?? "",
        "list": r.calendar.title,
        "repeats": r.hasRecurrenceRules,
    ]
    if let notes = r.notes, !notes.isEmpty { obj["notes"] = notes }
    if let comps = r.dueDateComponents, let due = Calendar.current.date(from: comps) {
        obj["due"] = dateFormatter.string(from: due)
    }
    return obj
}

func add(_ opts: [String: String]) {
    guard let title = opts["title"], !title.isEmpty else { fail("--title is required") }
    guard let dueText = opts["due"], let due = dateFormatter.date(from: dueText) else {
        fail("--due is required, format \"yyyy-MM-dd HH:mm\"")
    }
    let r = EKReminder(eventStore: store)
    r.title = title
    r.notes = opts["notes"]
    r.calendar = reminderList(named: opts["list"])
    r.dueDateComponents = Calendar.current.dateComponents(
        [.year, .month, .day, .hour, .minute], from: due)
    r.addAlarm(EKAlarm(absoluteDate: due)) // the notification on iPhone/Mac/Watch
    if let rule = recurrenceRule(opts["repeat"] ?? "none") {
        r.addRecurrenceRule(rule)
    }
    do {
        try store.save(r, commit: true)
    } catch {
        fail("Could not save reminder: \(error.localizedDescription)")
    }
    out(describe(r))
}

func list(_ opts: [String: String]) {
    let cals: [EKCalendar]? = opts["list"].map { [reminderList(named: $0)] }
    let predicate = store.predicateForIncompleteReminders(
        withDueDateStarting: nil, ending: nil, calendars: cals)
    let sem = DispatchSemaphore(value: 0)
    var items: [[String: Any]] = []
    store.fetchReminders(matching: predicate) { reminders in
        items = (reminders ?? []).map(describe)
        sem.signal()
    }
    sem.wait()
    items.sort { ($0["due"] as? String ?? "9999") < ($1["due"] as? String ?? "9999") }
    out(["reminders": items])
}

func complete(_ opts: [String: String]) {
    guard let id = opts["id"], !id.isEmpty else { fail("--id is required") }
    guard let r = store.calendarItem(withIdentifier: id) as? EKReminder else {
        fail("No reminder with id \(id)")
    }
    r.isCompleted = true
    do {
        try store.save(r, commit: true)
    } catch {
        fail("Could not complete reminder: \(error.localizedDescription)")
    }
    out(["completed": true, "title": r.title ?? ""])
}

let argv = Array(CommandLine.arguments.dropFirst())
guard let command = argv.first else { fail("Usage: reminders-helper lists|add|list|complete [--opts]") }
let opts = parseArgs(Array(argv.dropFirst()))
requestAccess()

switch command {
case "lists": out(["lists": store.calendars(for: .reminder).map { $0.title }])
case "add": add(opts)
case "list": list(opts)
case "complete": complete(opts)
default: fail("Unknown command: \(command)")
}
