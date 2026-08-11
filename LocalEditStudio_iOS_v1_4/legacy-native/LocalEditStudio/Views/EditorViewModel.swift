import SwiftUI
import PhotosUI
import UIKit

@MainActor
final class EditorViewModel: ObservableObject {
    enum QualityPreset: String, CaseIterable, Identifiable {
        case quick = "Quick"
        case balanced = "Balanced"
        case high = "High Detail"

        var id: String { rawValue }

        var steps: Double {
            switch self {
            case .quick: return 10
            case .balanced: return 16
            case .high: return 24
            }
        }

        var help: String {
            switch self {
            case .quick: return "Fast preview"
            case .balanced: return "Best everyday balance"
            case .high: return "Slower, more refinement"
            }
        }
    }

    enum EditIntent: String, CaseIterable, Identifiable {
        case retouch = "Retouch"
        case replacement = "Replace"
        case creative = "Creative"

        var id: String { rawValue }

        var helperText: String {
            switch self {
            case .retouch:
                return "Preserve the original photo as much as possible while correcting the selected area."
            case .replacement:
                return "Best for swapping garments, objects, or localized content while holding the rest of the image steady."
            case .creative:
                return "Allows more freedom for larger transformations."
            }
        }

        var defaultPreserve: Double {
            switch self {
            case .retouch: return 0.78
            case .replacement: return 0.62
            case .creative: return 0.38
            }
        }
    }

    @Published var selectedPhotoItem: PhotosPickerItem?
    @Published var sourceImage: UIImage?
    @Published var resultImages: [UIImage] = []
    @Published var selectedResultIndex = 0
    @Published var strokes: [MaskStroke] = []
    @Published var automaticMask: UIImage?
    @Published var brushSize: Double = 70
    @Published var isErasing = false

    @Published var prompt = ""
    @Published var negativePrompt = ""
    @Published var selectedAreaOnly = true
    @Published var editIntent: EditIntent = .replacement
    @Published var preserveOriginal: Double = 0.62
    @Published var quality: QualityPreset = .balanced
    @Published var guidance: Double = 7
    @Published var seedText = "12345"
    @Published var variationCount = 1

    @Published var lockIdentity = true
    @Published var lockGeometry = true
    @Published var lockScene = true
    @Published var photorealismAssist = true
    @Published var preserveLightingAssist = true

    @Published var isGenerating = false
    @Published var progress: Double = 0
    @Published var status = ""
    @Published var errorMessage: String?

    private var generationTask: Task<Void, Never>?

    var effectivePrompt: String {
        var parts = [prompt.trimmingCharacters(in: .whitespacesAndNewlines)]

        if photorealismAssist {
            parts.append("photorealistic natural texture, realistic camera detail")
        }
        if preserveLightingAssist {
            parts.append("preserve the source lighting, perspective, and surrounding scene")
        }
        if lockIdentity {
            parts.append("preserve the person's visible identity, facial appearance, hair, and distinguishing details")
        }
        if lockGeometry {
            parts.append("preserve visible body proportions, silhouette, and overall geometry unless the selected edit requires a localized change")
        }
        if lockScene {
            parts.append("preserve background content and all unselected regions")
        }

        return parts.filter { !$0.isEmpty }.joined(separator: ", ")
    }

    var preservationProfile: GenerationService.PreservationProfile {
        if lockIdentity && lockGeometry && lockScene {
            return .strict
        }
        if lockIdentity || lockGeometry || lockScene {
            return .balanced
        }
        return .flexible
    }

    var selectedResult: UIImage? {
        guard resultImages.indices.contains(selectedResultIndex) else { return nil }
        return resultImages[selectedResultIndex]
    }

    func loadSelectedPhoto() async {
        guard let item = selectedPhotoItem else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else {
                throw NSError(
                    domain: "LocalEditStudio.Photo",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Could not load this photo."]
                )
            }
            sourceImage = image.normalized()
            resultImages = []
            selectedResultIndex = 0
            strokes = []
            automaticMask = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func applyIntentPreset(_ intent: EditIntent) {
        editIntent = intent
        preserveOriginal = intent.defaultPreserve
        switch intent {
        case .retouch:
            lockIdentity = true
            lockGeometry = true
            lockScene = true
        case .replacement:
            lockIdentity = true
            lockGeometry = true
            lockScene = true
        case .creative:
            lockIdentity = true
            lockGeometry = false
            lockScene = true
        }
    }

    func generate(modelURL: URL, history: HistoryStore) {
        guard let sourceImage else {
            errorMessage = "Choose a photo first."
            return
        }
        guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Type the edit you want."
            return
        }

        var mask: UIImage?
        if selectedAreaOnly {
            if let automaticMask {
                mask = automaticMask
            } else {
                guard !strokes.isEmpty else {
                    errorMessage = "Paint over the area you want changed, use Smart Select, or switch to Whole image."
                    return
                }
                mask = ImageProcessor.renderMask(size: sourceImage.size, strokes: strokes)
            }
        }

        generationTask?.cancel()
        resultImages = []
        selectedResultIndex = 0
        isGenerating = true
        progress = 0
        status = "Preparing"

        let baseSeed = UInt32(seedText) ?? UInt32.random(in: 0...UInt32.max)
        let total = max(1, variationCount)

        generationTask = Task {
            for index in 0..<total {
                if Task.isCancelled { break }

                let seed = baseSeed &+ UInt32(index)
                let request = GenerationService.Request(
                    prompt: effectivePrompt,
                    negativePrompt: negativePrompt,
                    sourceImage: sourceImage,
                    mask: mask,
                    strength: Float(1.0 - preserveOriginal * 0.55),
                    steps: Int(quality.steps),
                    guidance: Float(guidance),
                    seed: seed,
                    modelURL: modelURL,
                    selectedAreaOnly: selectedAreaOnly,
                    preservationProfile: preservationProfile,
                    preferredCandidateCount: editIntent == .retouch ? 4 : 3
                )

                do {
                    let result = try await GenerationService.shared.generate(
                        request: request
                    ) { update in
                        Task { @MainActor in
                            let local = update.fraction
                            self.progress = (Double(index) + local) / Double(total)
                            self.status = total == 1
                                ? update.message
                                : "Variation \(index + 1)/\(total) • \(update.message)"
                        }
                    }

                    if Task.isCancelled { break }

                    await MainActor.run {
                        self.resultImages.append(result)
                        history.add(image: result, prompt: self.effectivePrompt, seed: seed)
                    }
                } catch {
                    await MainActor.run {
                        self.errorMessage = error.localizedDescription
                    }
                    break
                }
            }

            await MainActor.run {
                self.isGenerating = false
                self.progress = self.resultImages.isEmpty ? 0 : 1
                self.status = self.resultImages.isEmpty ? "Stopped" : "Done"
            }
        }
    }

    func cancel() {
        generationTask?.cancel()
        generationTask = nil
        isGenerating = false
        status = "Cancelled"
    }

    func useSelectedResultAsSource() {
        guard let selectedResult else { return }
        sourceImage = selectedResult.normalized()
        strokes = []
        automaticMask = nil
        resultImages = []
        selectedResultIndex = 0
    }


    func applySmartMask(mode: SmartMaskService.SmartMaskMode) {
        guard let sourceImage else {
            errorMessage = "Choose a photo first."
            return
        }

        Task {
            do {
                let mask = try await SmartMaskService.shared.mask(for: sourceImage, mode: mode)
                await MainActor.run {
                    self.automaticMask = ImageProcessor.resized(mask, to: sourceImage.size)
                    self.strokes = []
                    self.status = "\(mode.rawValue) selected"
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }

    func undoStroke() { _ = strokes.popLast() }
    func clearMask() { strokes.removeAll(); automaticMask = nil }
    func randomizeSeed() { seedText = String(UInt32.random(in: 0...UInt32.max)) }
}

extension UIImage {
    func normalized() -> UIImage {
        if imageOrientation == .up { return self }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
