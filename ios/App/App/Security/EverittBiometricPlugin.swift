import Foundation
import Capacitor
import LocalAuthentication

@objc(EverittBiometricPlugin)
public class EverittBiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EverittBiometric"
    public let jsName = "EverittBiometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verify", returnType: CAPPluginReturnPromise)
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        let type: String
        switch context.biometryType {
        case .faceID: type = "face"
        case .touchID: type = "fingerprint"
        default: type = "none"
        }
        call.resolve(["available": available, "type": type])
    }

    @objc func verify(_ call: CAPPluginCall) {
        let context = LAContext()
        context.localizedCancelTitle = "Use PIN"
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            call.resolve(["verified": false, "unavailable": true])
            return
        }
        let reason = call.getString("reason") ?? "Unlock EverittOS"
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authError in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["verified": true])
                    return
                }
                let code = (authError as? LAError)?.code
                let canceled = code == .userCancel || code == .systemCancel || code == .appCancel
                call.resolve(["verified": false, "canceled": canceled])
            }
        }
    }
}
