import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(EverittBillingPlugin)
public class EverittBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EverittBillingPlugin"
    public let jsName = "EverittBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProductIds", returnType: CAPPluginReturnPromise)
    ]

    private let defaultProductIds = [
        "com.everittventures.everittos.pro.monthly",
        "com.everittventures.everittos.business.monthly"
    ]

    @objc func loadProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? defaultProductIds
        Task {
            do {
                let products = try await StoreKitBillingManager.shared.loadProducts(productIDs: Set(ids))
                let mapped = products.map { product -> [String: Any] in
                    [
                        "productId": product.id,
                        "title": product.displayName,
                        "description": product.description,
                        "price": product.displayPrice,
                        "priceCurrencyCode": product.priceFormatStyle.locale.currency?.identifier ?? "",
                        "billingPeriod": "monthly"
                    ]
                }
                call.resolve(["products": mapped])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("productId is required")
            return
        }

        Task {
            do {
                var products = StoreKitBillingManager.shared.products
                if !products.contains(where: { $0.id == productId }) {
                    products = try await StoreKitBillingManager.shared.loadProducts(productIDs: [productId])
                }
                guard let product = products.first(where: { $0.id == productId }) else {
                    call.reject("Product not found")
                    return
                }
                let payload = try await StoreKitBillingManager.shared.purchase(product)
                call.resolve([
                    "productId": payload.productId,
                    "transactionId": payload.transactionId,
                    "originalTransactionId": payload.originalTransactionId,
                    "signedTransaction": payload.signedTransaction,
                    "pending": payload.pending,
                    "cancelled": payload.cancelled
                ])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                let purchases = try await StoreKitBillingManager.shared.restore()
                let mapped = purchases.map { purchase -> [String: Any] in
                    [
                        "productId": purchase.productId,
                        "transactionId": purchase.transactionId,
                        "originalTransactionId": purchase.originalTransactionId,
                        "signedTransaction": purchase.signedTransaction,
                        "pending": purchase.pending,
                        "cancelled": purchase.cancelled
                    ]
                }
                call.resolve(["purchases": mapped])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task {
            await StoreKitBillingManager.shared.manageSubscriptions()
            call.resolve(["opened": true])
        }
    }

    @objc func getProductIds(_ call: CAPPluginCall) {
        call.resolve(["productIds": defaultProductIds])
    }
}
