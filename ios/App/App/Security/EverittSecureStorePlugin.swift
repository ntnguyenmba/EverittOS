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
        CAPPluginMethod(name: "remove", return