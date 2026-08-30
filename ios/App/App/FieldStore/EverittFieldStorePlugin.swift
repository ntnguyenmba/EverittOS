import Foundation
import Capacitor
import SQLite3

@objc(EverittFieldStorePlugin)
public class EverittFieldStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EverittFieldStore"
    public let jsName = "EverittFieldStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "putRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listOutbox", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeOutbox", returnType: CAPPluginReturnPromise)
    ]

    private var db: OpaquePointer?

    public override func load() {
        super.load()
        openDatabase()
    }

    deinit { if db != nil { sqlite3_close(db) } }

    private func openDatabase() {
        guard db == nil else { return }
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        let url = base.appendingPathComponent("everitt-field.sqlite")
        guard sqlite3_open(url.path, &db) == SQLITE_OK else { db = nil; return }
        sqlite3_exec(db, "CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, updated_at REAL NOT NULL, PRIMARY KEY(kind, record_key));", nil, nil, nil)
        sqlite3_exec(db, "CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, created_at REAL NOT NULL);", nil, nil, nil)
    }

    private func bind(_ statement: OpaquePointer?, _ index: Int32, _ value: String) {
        sqlite3_bind_text(statement, index, (value as NSString).utf8String, -1, nil)
    }

    @objc func putRecord(_ call: CAPPluginCall) {
        guard let kind = call.getString("kind"), let key = call.getString("key"), let json = call.getString("json") else { call.reject("Invalid field record."); return }
        openDatabase(); guard db != nil else { call.reject("Field cache unavailable."); return }
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, "INSERT INTO records(kind,record_key,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,record_key) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at;", -1, &stmt, nil)
        bind(stmt, 1, kind); bind(stmt, 2, key); bind(stmt, 3, json); sqlite3_bind_double(stmt, 4, Date().timeIntervalSince1970)
        let ok = sqlite3_step(stmt) == SQLITE_DONE; sqlite3_finalize(stmt)
        ok ? call.resolve() : call.reject("Could not save field record.")
    }

    @objc func getRecord(_ call: CAPPluginCall) {
        guard let kind = call.getString("kind"), let key = call.getString("key") else { call.reject("Invalid field record."); return }
        openDatabase(); guard db != nil else { call.resolve(["json": NSNull()]); return }
        var stmt: OpaquePointer?; sqlite3_prepare_v2(db, "SELECT json FROM records WHERE kind=? AND record_key=? LIMIT 1;", -1, &stmt, nil)
        bind(stmt, 1, kind); bind(stmt, 2, key)
        if sqlite3_step(stmt) == SQLITE_ROW, let text = sqlite3_column_text(stmt, 0) { let json = String(cString: text); sqlite3_finalize(stmt); call.resolve(["json": json]); return }
        sqlite3_finalize(stmt); call.resolve(["json": NSNull()])
    }

    @objc func queue(_ call: CAPPluginCall) {
        guard let type = call.getString("type"), let key = call.getString("key"), let json = call.getString("json") else { call.reject("Invalid queued change."); return }
        openDatabase(); guard db != nil else { call.reject("Field cache unavailable."); return }
        var stmt: OpaquePointer?; sqlite3_prepare_v2(db, "INSERT INTO outbox(type,record_key,json,created_at) VALUES(?,?,?,?);", -1, &stmt, nil)
        bind(stmt, 1, type); bind(stmt, 2, key); bind(stmt, 3, json); sqlite3_bind_double(stmt, 4, Date().timeIntervalSince1970)
        let ok = sqlite3_step(stmt) == SQLITE_DONE; sqlite3_finalize(stmt); ok ? call.resolve() : call.reject("Could not queue field change.")
    }

    @objc func listOutbox(_ call: CAPPluginCall) {
        openDatabase(); guard db != nil else { call.resolve(["items": []]); return }
        var stmt: OpaquePointer?; sqlite3_prepare_v2(db, "SELECT id,type,record_key,json FROM outbox ORDER BY id ASC;", -1, &stmt, nil)
        var items: [[String: Any]] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let id = sqlite3_column_int64(stmt, 0)
            let type = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            let key = sqlite3_column_text(stmt, 2).map { String(cString: $0) } ?? ""
            let json = sqlite3_column_text(stmt, 3).map { String(cString: $0) } ?? "{}"
            items.append(["id": id, "type": type, "key": key, "json": json])
        }
        sqlite3_finalize(stmt); call.resolve(["items": items])
    }

    @objc func removeOutbox(_ call: CAPPluginCall) {
        guard let id = call.getInt("id") else { call.reject("Invalid queue id."); return }
        openDatabase(); var stmt: OpaquePointer?; sqlite3_prepare_v2(db, "DELETE FROM outbox WHERE id=?;", -1, &stmt, nil); sqlite3_bind_int64(stmt, 1, Int64(id)); sqlite3_step(stmt); sqlite3_finalize(stmt); call.resolve()
    }
}
