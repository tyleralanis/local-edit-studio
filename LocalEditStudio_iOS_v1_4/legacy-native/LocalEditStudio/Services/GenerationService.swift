import Foundation
import UIKit
import CoreML
import StableDiffusion

actor GenerationService {
    static let shared = GenerationService()

    enum PreservationProfile: String, CaseIterable {
        case strict
        case balanced
        case flexible

        var guidanceBoost: Float {
            switch self {
            case .strict: return 0.6
            case .balanced: return 0.25
            case .flexible: return 0.0
            }
        }

        var strengthMultiplier: Float {
            switch self {
            case .strict: return 0.86
            case .balanced: return 1.0
            case .flexible: return 1.08
            }
        }

        var candidateCount: Int {
            switch self {
            case .strict: return 4
            case .balanced: return 3
            case .flexible: return 2
            }
        }
    }

    struct Request {
        var prompt: String
        var negativePrompt: String
        var sourceImage: UIImage
        var mask: UIImage?
        var strength: Float
        var steps: Int
        var guidance: Float
        var seed: UInt32
        var modelURL: URL
        var selectedAreaOnly: Bool
        var preservationProfile: PreservationProfile
        var preferredCandidateCount: Int
    }

    struct Update {
        var fraction: Double
        var message: String
    }

    func generate(
        request: Request,
        progress: @escaping @Sendable (Update) -> Void
    ) throws -> UIImage {
        progress(.init(fraction: 0.02, message: "Loading model"))

        let mlConfig = MLModelConfiguration()
        mlConfig.computeUnits = .cpuAndNeuralEngine

        let pipeline = try StableDiffusionPipeline(
            resourcesAt: request.modelURL,
            controlNet: [],
            configuration: mlConfig,
            disableSafety: false,
            reduceMemory: true
        )

        try pipeline.loadResources()
        defer { pipeline.unloadResources() }

        var sourceForGeneration = request.sourceImage
        var maskRect: CGRect? = nil

        if request.selectedAreaOnly, let mask = request.mask,
           let rect = ImageProcessor.cropBox(from: mask) {
            maskRect = rect
            sourceForGeneration = ImageProcessor.crop(request.sourceImage, rect: rect) ?? request.sourceImage
        }

        let modelInput = ImageProcessor.squareForModel(sourceForGeneration, side: 512)
        guard let cg = modelInput.cgImage else {
            throw NSError(
                domain: "LocalEditStudio.Generation",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Could not prepare the source image."]
            )
        }

        let internalCandidates = max(request.preferredCandidateCount, request.preservationProfile.candidateCount)
        var bestScore = Double.greatestFiniteMagnitude
        var bestImage: UIImage?

        for candidateIndex in 0..<internalCandidates {
            var cfg = PipelineConfiguration(prompt: request.prompt)
            cfg.negativePrompt = request.negativePrompt
            cfg.startingImage = cg
            cfg.strength = min(0.98, request.strength * request.preservationProfile.strengthMultiplier)
            cfg.stepCount = request.steps
            cfg.seed = request.seed &+ UInt32(candidateIndex)
            cfg.guidanceScale = request.guidance + request.preservationProfile.guidanceBoost
            cfg.schedulerType = .dpmSolverMultistepScheduler
            cfg.imageCount = 1

            let candidateImages = try pipeline.generateImages(configuration: cfg) { p in
                let localFraction = Double(p.step) / Double(max(1, cfg.stepCount))
                let globalBase = Double(candidateIndex) / Double(max(1, internalCandidates))
                let globalSpan = 1.0 / Double(max(1, internalCandidates))
                progress(.init(
                    fraction: 0.10 + (globalBase + localFraction * globalSpan) * 0.78,
                    message: "Candidate \(candidateIndex + 1)/\(internalCandidates) • step \(p.step)/\(cfg.stepCount)"
                ))
                return true
            }

            guard let outCG = candidateImages.first ?? nil else { continue }
            let rawGenerated = UIImage(cgImage: outCG, scale: 1, orientation: .up)
            let finalCandidate: UIImage

            if request.selectedAreaOnly,
               let mask = request.mask,
               let rect = maskRect {
                let fitted = ImageProcessor.resized(rawGenerated, to: rect.size)
                finalCandidate = ImageProcessor.composite(
                    original: request.sourceImage,
                    generated: fitted,
                    mask: mask,
                    rect: rect
                )
            } else {
                finalCandidate = ImageProcessor.resized(rawGenerated, to: request.sourceImage.size)
            }

            let score = ImageProcessor.preservationScore(
                original: request.sourceImage,
                candidate: finalCandidate,
                mask: request.mask,
                rect: maskRect
            )

            if score < bestScore {
                bestScore = score
                bestImage = finalCandidate
            }
        }

        progress(.init(fraction: 0.94, message: "Selecting best match"))
        guard let bestImage else {
            throw NSError(
                domain: "LocalEditStudio.Generation",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "The model did not return an image."]
            )
        }

        progress(.init(fraction: 0.98, message: "Finishing"))
        return bestImage
    }
}
