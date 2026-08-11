import Foundation
import UIKit
import Vision
import CoreImage

struct QualityReport: Identifiable, Codable {
    let id = UUID()
    var score: Double
    var warnings: [String]
    var passedChecks: [String]

    var grade: String {
        if score >= 0.90 { return "Excellent" }
        if score >= 0.78 { return "Good" }
        if score >= 0.62 { return "Review" }
        return "Needs attention"
    }
}

actor QualityInspector {
    static let shared = QualityInspector()

    func inspect(
        original: UIImage,
        candidate: UIImage,
        mask: UIImage?
    ) async -> QualityReport {
        var score = 1.0
        var warnings: [String] = []
        var passed: [String] = []

        let tone = ImageProcessor.globalToneDifference(original: original, candidate: candidate, excluding: mask)
        if tone > 32 {
            score -= 0.16
            warnings.append("Noticeable color/exposure drift outside the intended edit.")
        } else {
            passed.append("Color/exposure continuity")
        }

        let pixelDrift = ImageProcessor.outsideMaskDifference(original: original, candidate: candidate, mask: mask)
        if pixelDrift > 18 {
            score -= 0.20
            warnings.append("Unexpected changes were detected outside the selected area.")
        } else {
            passed.append("Unselected-area preservation")
        }

        let seam = ImageProcessor.boundaryDifference(original: original, candidate: candidate, mask: mask)
        if seam > 34 {
            score -= 0.16
            warnings.append("The edit boundary may need additional blending.")
        } else {
            passed.append("Boundary blending")
        }

        let faceResult = await compareFaces(original: original, candidate: candidate)
        score -= faceResult.penalty
        warnings.append(contentsOf: faceResult.warnings)
        passed.append(contentsOf: faceResult.passed)

        return QualityReport(
            score: max(0, min(1, score)),
            warnings: warnings,
            passedChecks: passed
        )
    }

    private func compareFaces(
        original: UIImage,
        candidate: UIImage
    ) async -> (penalty: Double, warnings: [String], passed: [String]) {
        guard let a = original.cgImage, let b = candidate.cgImage else {
            return (0.08, ["Could not run face consistency check."], [])
        }

        do {
            async let facesA = faceBoxes(in: a)
            async let facesB = faceBoxes(in: b)
            let (oa, ob) = try await (facesA, facesB)

            if oa.count != ob.count {
                return (0.18, ["Face count changed between source and result."], [])
            }

            guard !oa.isEmpty else {
                return (0, [], ["No face drift detected"])
            }

            let sortedA = oa.sorted { $0.midX < $1.midX }
            let sortedB = ob.sorted { $0.midX < $1.midX }

            var maxDelta = 0.0
            for (fa, fb) in zip(sortedA, sortedB) {
                let centerDelta = hypot(fa.midX - fb.midX, fa.midY - fb.midY)
                let sizeDelta = abs(fa.width - fb.width) + abs(fa.height - fb.height)
                maxDelta = max(maxDelta, centerDelta + sizeDelta)
            }

            if maxDelta > 0.12 {
                return (0.16, ["A face moved or changed size more than expected."], [])
            }

            return (0, [], ["Face position/size consistency"])
        } catch {
            return (0.04, ["Face consistency check was unavailable."], [])
        }
    }

    private func faceBoxes(in image: CGImage) async throws -> [CGRect] {
        try await withCheckedThrowingContinuation { continuation in
            let request = VNDetectFaceRectanglesRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let boxes = (request.results as? [VNFaceObservation])?.map(\.boundingBox) ?? []
                continuation.resume(returning: boxes)
            }

            let handler = VNImageRequestHandler(cgImage: image)
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try handler.perform([request])
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}
