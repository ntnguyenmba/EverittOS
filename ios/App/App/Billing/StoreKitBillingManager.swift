import Foundation
import StoreKit
import UIKit

@MainActor
final class StoreKitBillingManager: ObservableObject {
    static let shared = StoreKitBillingManager()

    @Published private(set) var products: [Product] = []

    private var updatesTask: Task<Void, Never>?

    private init() {
        updatesTask = observeTransactionUpdates()
    }

    deinit {
        updatesTask?.cancel()
    }

    func loadProducts(productIDs: Set<String>) async throws -> [Product] {
        products = try await Product.products(for: productIDs)
        return products
    }

    func purchase(_ product: Product) async throws -> VerifiedPurchasePayload {
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            let payload = VerifiedPurchasePayload(
                productId: transaction.productID,
                transactionId: String(transaction.id),
                originalTransactionId: String(transaction.originalID),
                signedTransaction: verification.jwsRepresentation,
                pending: false,
                cancelled: false
            )
            await transaction.finish()
            return payload

        case .pending:
            return VerifiedPurchasePayload(
                productId: product.id,
                transactionId: "",
                originalTransactionId: "",
                signedTransaction: "",
                pending: true,
                cancelled: false
            )

        case .userCancelled:
            return VerifiedPurchasePayload(
                productId: product.id,
                transactionId: "",
                originalTransactionId: "",
                signedTransaction: "",
                pending: false,
                cancelled: true
            )

        @unknown default:
            throw BillingError.unknown
        }
    }

    func currentEntitlementPurchases() async -> [VerifiedPurchasePayload] {
        var results: [VerifiedPurchasePayload] = []
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(result) else { continue }
            results.append(
                VerifiedPurchasePayload(
                    productId: transaction.productID,
                    transactionId: String(transaction.id),
                    originalTransactionId: String(transaction.originalID),
                    signedTransaction: result.jwsRepresentation,
                    pending: false,
                    cancelled: false
                )
            )
        }
        return results
    }

    func restore() async throws -> [VerifiedPurchasePayload] {
        try await AppStore.sync()
        return await currentEntitlementPurchases()
    }

    func manageSubscriptions() async {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
        try? await AppStore.showManageSubscriptions(in: scene)
    }

    private func observeTransactionUpdates() -> Task<Void, Never> {
        Task { [weak self] in
            for await update in Transaction.updates {
                guard let transaction = try? self?.checkVerified(update) else { continue }
                await transaction.finish()
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw BillingError.verificationFailed
        case .verified(let safe):
            return safe
        }
    }
}
