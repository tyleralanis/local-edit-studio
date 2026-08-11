import SwiftUI
import PhotosUI
import UIKit

@MainActor
final class CompositeViewModel: ObservableObject {
    @Published var basePhotoItem: PhotosPickerItem?
    @Published var donorPhotoItem: PhotosPickerItem?

    @Published var baseImage: UIImage?
    @Published var donorImage: UIImage?
    @Published var extractedSubject: UIImage?
    @Published var resultImage: UIImage?

    @Published var center = CGPoint(x: 0.5, y: 0.55)
    @Published var scale: CGFloat = 1.0
    @Published var rotation: Double = 0
    @Published var opacity: Double = 1
    @Published var shadow: Double = 0.15
    @Published var floorAnchor: Double = 0.82
    @Published var perspectiveScale: Double = 0.45
    @Published var layerOrder: CompositeRenderer.LayerOrder = .donorInFront
    @Published var baseSubjectMask: UIImage?

    @Published var isExtracting = false
    @Published var status = ""
    @Published var errorMessage: String?

    func loadBase() async {
        guard let item = basePhotoItem else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else {
                throw NSError(domain: "Composite", code: 1,
                              userInfo: [NSLocalizedDescriptionKey: "Could not load the base photo."])
            }
            baseImage = image.normalized()
            resultImage = nil
            Task {
                do {
                    let mask = try await SmartMaskService.shared.mask(for: image.normalized(), mode: .person)
                    await MainActor.run {
                        self.baseSubjectMask = ImageProcessor.resized(mask, to: image.size)
                    }
                } catch {
                    await MainActor.run {
                        self.baseSubjectMask = nil
                    }
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadDonor() async {
        guard let item = donorPhotoItem else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else {
                throw NSError(domain: "Composite", code: 2,
                              userInfo: [NSLocalizedDescriptionKey: "Could not load the donor photo."])
            }
            donorImage = image.normalized()
            extractedSubject = nil
            resultImage = nil
            await extract()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func extract() async {
        guard let donorImage else { return }
        isExtracting = true
        status = "Finding the person…"

        do {
            let subject = try await ForegroundExtractionService.shared.extractForeground(from: donorImage)
            extractedSubject = subject
            status = "Subject ready"
        } catch {
            errorMessage = error.localizedDescription
            status = "Extraction failed"
        }

        isExtracting = false
    }

    func render() {
        guard let baseImage, let extractedSubject else {
            errorMessage = "Choose both photos and extract the donor person first."
            return
        }

        resultImage = CompositeRenderer.render(
            base: baseImage,
            subject: extractedSubject,
            normalizedCenter: center,
            scale: scale,
            rotation: CGFloat(rotation * .pi / 180),
            opacity: opacity,
            shadow: shadow,
            floorAnchor: floorAnchor,
            perspectiveScale: perspectiveScale,
            layerOrder: layerOrder,
            baseSubjectMask: baseSubjectMask
        )
    }

    func resetPlacement() {
        center = CGPoint(x: 0.5, y: 0.55)
        scale = 1
        rotation = 0
        opacity = 1
        shadow = 0.15
        floorAnchor = 0.82
        perspectiveScale = 0.45
        layerOrder = .donorInFront
        resultImage = nil
    }
}
