import Foundation
import UIKit
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins

actor SmartMaskService {
    static let shared = SmartMaskService()

    enum SmartMaskMode: String, CaseIterable, Identifiable {
        case person = "Person"
        case foreground = "Foreground object"
        case background = "Background"

        var id: String { rawValue }
    }

    func mask(for image: UIImage, mode: SmartMaskMode) throws -> UIImage {
        guard let cgImage = image.normalized().cgImage else {
            throw NSError(domain: "SmartMask", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Could not read the photo."])
        }

        switch mode {
        case .person:
            return try personMask(cgImage: cgImage)
        case .foreground:
            return try foregroundMask(cgImage: cgImage)
        case .background:
            let foreground = try foregroundMask(cgImage: cgImage)
            return invert(foreground)
        }
    }

    @available(iOS 17.0, *)
    func foregroundMask(cgImage: CGImage) throws -> UIImage {
        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage)
        try handler.perform([request])

        guard let result = request.results?.first else {
            throw NSError(domain: "SmartMask", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "No foreground object was detected."])
        }

        let buffer = try result.generateScaledMaskForImage(
            forInstances: result.allInstances,
            from: handler
        )
        return imageFromMaskBuffer(buffer)
    }

    func personMask(cgImage: CGImage) throws -> UIImage {
        let request = VNGeneratePersonSegmentationRequest()
        request.qualityLevel = .accurate
        request.outputPixelFormat = kCVPixelFormatType_OneComponent8

        let handler = VNImageRequestHandler(cgImage: cgImage)
        try handler.perform([request])

        guard let result = request.results?.first else {
            throw NSError(domain: "SmartMask", code: 3,
                          userInfo: [NSLocalizedDescriptionKey: "No person mask was produced."])
        }
        return imageFromMaskBuffer(result.pixelBuffer)
    }

    private func imageFromMaskBuffer(_ buffer: CVPixelBuffer) -> UIImage {
        let ci = CIImage(cvPixelBuffer: buffer)
        let context = CIContext()
        let rect = ci.extent
        guard let cg = context.createCGImage(ci, from: rect) else {
            return UIImage()
        }
        return UIImage(cgImage: cg, scale: 1, orientation: .up)
    }

    private func invert(_ image: UIImage) -> UIImage {
        guard let ci = CIImage(image: image) else { return image }
        let filter = CIFilter.colorInvert()
        filter.inputImage = ci
        let context = CIContext()
        guard let out = filter.outputImage,
              let cg = context.createCGImage(out, from: out.extent) else { return image }
        return UIImage(cgImage: cg, scale: 1, orientation: .up)
    }
}
