import Foundation
import StoreKit

enum BillingError: LocalizedError {
    case pending
    case cancelled
    case unknown
    case productNotFound
    case verificationFailed

    var errorDescription: String? {
        switch self {
        case .pending: return "Purchase is pending approval."
        case .cancelled: return "Purchase cancelled."
        case .unknown: return "Unknown billing error."
        case .productNotFound: return "Product not found."
        case .verificationFailed: return "Transaction verification failed."
        }
    }
}

struct VerifiedPurchasePayload: Codable {
    let productId: String
    let transactionId: String
    let originalTransactionId: String
    let signedTransaction: String
    let pending: Bool
    let cancelled: Bool
}
