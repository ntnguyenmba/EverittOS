import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(EverittBillingPlugin)
public class EverittBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EverittBilling"
    public let jsName = "EverittBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProductIds", returnType: CAPPluginReturnPromise)
    ]

    private let defaultProductIds = [
        "com.everittventures.everittos.pro.monthly.v3",
        "com.everittventures.everittos.business.monthly.v2",
        "com.everittventures.everittos.starter.monthly.v4",
        "com.everittventures.everittos.growth.monthly.v2",
        "com.everittventures.everittos.enterprise.monthly.v2"
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
                        "priceCurrencyCode": product.priceFormatStyle.currencyCode,
                        "billingPeriod": "monthly"
                    ]
                }
                call.resolve(["products": mapped])
            } catch {
                call.reject("Store products are temporarily unavailable.")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("This plan is temporarily unavailable.")
            return
        }

        Task {
            do {
                var products = await StoreKitBillingManager.shared.products
                if !products.contains(where: { $0.id == productId }) {
                    products = try await StoreKitBillingManager.shared.loadProducts(productIDs: [productId])
                }
                guard let product = products.first(where: { $0.id == productId }) else {
                    call.reject("This plan is temporarily unavailable.")
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
                call.reject("We could not complete the purchase. Please try again.")
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
                call.reject("We could not restore purchases. Please try again.")
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
