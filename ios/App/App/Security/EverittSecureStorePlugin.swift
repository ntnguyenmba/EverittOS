import Foundation
import Capacitor
import Security

@objc(EverittSecureStorePlugin)
public class EverittSecureStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EverittSecureStore"
    public let jsName = "EverittSecureStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]

    private let service = "com.everittventures.everittos.secure"

    private func query(_ key: String) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value"), let data = value.data(using: .utf8) else {
            call.reject("Invalid secure value."); return
        }
        let base = query(key)
        SecItemDelete(base as CFDictionary)
        var insert = base
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(insert as CFDictionary, nil)
        status == errSecSuccess ? call.resolve() : call.reject("Could not save secure value.")
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("Invalid secure key."); return }
        var read = query(key)
        read[kSecReturnData as String] = true
        read[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(read as CFDictionary, &item)
        if status == errSecItemNotFound { call.resolve(["value": NSNull()]); return }
        guard status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
            call.reject("Could not read secure value."); return
        }
        call.resolve(["value": value])
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("Invalid secure key."); return }
        let status = SecItemDelete(query(key) as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound { call.resolve(); return }
        call.reject("Could not remove secure value.")
    }
}
